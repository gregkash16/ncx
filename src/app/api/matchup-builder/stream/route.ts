// /api/matchup-builder/stream — Server-Sent Events feed for a single series.
// Replaces 4s client polling with a persistent stream that only emits when
// state actually changes. The server polls MySQL every 2s and emits the light
// state payload whenever its hash changes, plus a comment heartbeat every 25s.

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCaptainTeams } from "@/lib/captains";
import { createHash } from "crypto";
import { buildLightState } from "../state/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADMIN_DISCORD_IDS = ["349349801076195329", "986330724212801557"] as const;
const POLL_MS = 2000;
const HEARTBEAT_MS = 25000;

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "").trim().replace(/[<@!>]/g, "").replace(/\D/g, "");
}
function teamKey(s: string): string {
  return String(s ?? "").trim().toUpperCase();
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionId = session?.user
    ? normalizeDiscordId((session.user as any).discordId ?? (session.user as any).id)
    : "";
  const headerRaw = (req.headers.get("x-discord-id") ?? "").trim();
  const isAppleAuth = headerRaw.startsWith("apple-") && process.env.DEMO_MODE === "true";
  const headerId = isAppleAuth ? "" : normalizeDiscordId(headerRaw);
  const discordId = sessionId || headerId;
  if (!discordId && !isAppleAuth) return errorResponse("Not authenticated", 401);

  const isAdmin = isAppleAuth || (ADMIN_DISCORD_IDS as readonly string[]).includes(discordId);

  const week = req.nextUrl.searchParams.get("week");
  const awayTeam = req.nextUrl.searchParams.get("away");
  const homeTeam = req.nextUrl.searchParams.get("home");
  if (!week || !awayTeam || !homeTeam) {
    return errorResponse("week, away, home required", 400);
  }

  const captainTeams = await getCaptainTeams(discordId);
  const isAwayCaptain = captainTeams.some((t) => teamKey(t) === teamKey(awayTeam));
  const isHomeCaptain = captainTeams.some((t) => teamKey(t) === teamKey(homeTeam));
  if (!isAdmin && !isAwayCaptain && !isHomeCaptain) return errorResponse("Forbidden", 403);

  const myRole: "away_captain" | "home_captain" | "admin" = isAdmin
    ? "admin"
    : isAwayCaptain
      ? "away_captain"
      : "home_captain";

  const encoder = new TextEncoder();
  const signal = req.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      let lastHash = "";

      const send = (payload: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          /* controller already closed */
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (pollTimer) clearInterval(pollTimer);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      signal.addEventListener("abort", cleanup);

      // Tell the browser to wait 5s before auto-reconnecting on disconnect.
      send(`retry: 5000\n\n`);

      const pushIfChanged = async (): Promise<void> => {
        if (closed) return;
        try {
          const state = await buildLightState(week!, awayTeam!, homeTeam!, myRole);
          if (!state) {
            send(`event: error\ndata: ${JSON.stringify({ error: "Draft not initialized" })}\n\n`);
            return;
          }
          const json = JSON.stringify(state);
          const hash = createHash("sha1").update(json).digest("hex");
          if (hash !== lastHash) {
            lastHash = hash;
            send(`data: ${json}\n\n`);
          }
        } catch (err: any) {
          console.error("[matchup-builder/stream]", err);
          send(`event: error\ndata: ${JSON.stringify({ error: err.message ?? "poll error" })}\n\n`);
        }
      };

      // Stream stays open across finalize so post-finalize substitutions
      // still propagate live between the two captains. Closes on
      // req.signal.abort (client unmount) only.
      await pushIfChanged();

      pollTimer = setInterval(pushIfChanged, POLL_MS);

      heartbeatTimer = setInterval(() => {
        send(`: heartbeat\n\n`);
      }, HEARTBEAT_MS);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
