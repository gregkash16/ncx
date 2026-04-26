// /api/matchup-builder/state — GET: thin polling payload (no rosters, no weeks).
// Used by clients that have already loaded the full builder and only need to
// track series + slot state changes. ~1 KB payload vs ~25 KB for the full GET.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getCaptainTeams } from "@/lib/captains";
import { ensureMatchupDraftColumns } from "@/lib/matchupDraftMigration";

export const dynamic = "force-dynamic";

const ADMIN_DISCORD_IDS = ["349349801076195329", "986330724212801557"] as const;

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "").trim().replace(/[<@!>]/g, "").replace(/\D/g, "");
}
function teamKey(s: string): string {
  return String(s ?? "").trim().toUpperCase();
}

export type LightDraftState = {
  series: {
    currentSlot: number;
    vetoUsed: boolean;
    finalized: boolean;
    finalizedAt: string | null;
  };
  slots: Array<{
    slot: number;
    awayNcxid: string | null;
    awayName: string | null;
    homeNcxid: string | null;
    homeName: string | null;
    status: "awaiting_away" | "awaiting_home" | "awaiting_veto_window" | "locked";
    vetoed: boolean;
    vetoedHomeNcxid: string | null;
    pendingSub: boolean;
  }>;
  myRole: "away_captain" | "home_captain" | "admin";
  isMyTurn: boolean;
  assignedAwayIds: string[];
  assignedHomeIds: string[];
};

export async function buildLightState(
  week: string,
  awayTeam: string,
  homeTeam: string,
  myRole: "away_captain" | "home_captain" | "admin"
): Promise<LightDraftState | null> {
  await ensureMatchupDraftColumns();
  const [[seriesRows], [slotRows]] = await Promise.all([
    pool.query(
      "SELECT current_slot, veto_used, finalized, finalized_at FROM S9.matchup_draft_series WHERE week_label = ? AND away_team = ? AND home_team = ?",
      [week, awayTeam, homeTeam]
    ),
    pool.query(
      "SELECT slot, away_ncxid, away_name, home_ncxid, home_name, status, vetoed, vetoed_home_ncxid, pending_sub FROM S9.matchup_draft WHERE week_label = ? AND away_team = ? AND home_team = ? ORDER BY slot",
      [week, awayTeam, homeTeam]
    ),
  ]);
  const seriesRow = (seriesRows as any[])[0];
  if (!seriesRow) return null;

  const slots = (slotRows as any[]).map((s: any) => ({
    slot: s.slot,
    awayNcxid: s.away_ncxid,
    awayName: s.away_name,
    homeNcxid: s.home_ncxid,
    homeName: s.home_name,
    status: s.status,
    vetoed: !!s.vetoed,
    vetoedHomeNcxid: s.vetoed_home_ncxid ?? null,
    pendingSub: !!s.pending_sub,
  }));

  const currentSlot = slots.find((s) => s.slot === seriesRow.current_slot);
  let isMyTurn = false;
  if (currentSlot && !seriesRow.finalized) {
    if (currentSlot.status === "awaiting_away" && (myRole === "away_captain" || myRole === "admin")) isMyTurn = true;
    else if (currentSlot.status === "awaiting_home" && (myRole === "home_captain" || myRole === "admin")) isMyTurn = true;
    else if (currentSlot.status === "awaiting_veto_window" && (myRole === "away_captain" || myRole === "admin")) isMyTurn = true;
  }

  const assignedAwayIds = slots.filter((s) => s.awayNcxid).map((s) => s.awayNcxid as string);
  const assignedHomeIds = slots.filter((s) => s.homeNcxid).map((s) => s.homeNcxid as string);

  return {
    series: {
      currentSlot: seriesRow.current_slot,
      vetoUsed: !!seriesRow.veto_used,
      finalized: !!seriesRow.finalized,
      finalizedAt: seriesRow.finalized_at,
    },
    slots,
    myRole,
    isMyTurn,
    assignedAwayIds,
    assignedHomeIds,
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionId = session?.user
      ? normalizeDiscordId((session.user as any).discordId ?? (session.user as any).id)
      : "";
    const headerRaw = (req.headers.get("x-discord-id") ?? "").trim();
    const isAppleAuth = headerRaw.startsWith("apple-") && process.env.DEMO_MODE === "true";
    const headerId = isAppleAuth ? "" : normalizeDiscordId(headerRaw);
    const discordId = sessionId || headerId;
    if (!discordId && !isAppleAuth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const isAdmin = isAppleAuth || (ADMIN_DISCORD_IDS as readonly string[]).includes(discordId);

    const week = req.nextUrl.searchParams.get("week");
    const awayTeam = req.nextUrl.searchParams.get("away");
    const homeTeam = req.nextUrl.searchParams.get("home");
    if (!week || !awayTeam || !homeTeam) {
      return NextResponse.json({ error: "week, away, home are required" }, { status: 400 });
    }

    const captainTeams = await getCaptainTeams(discordId);
    const isAwayCaptain = captainTeams.some((t) => teamKey(t) === teamKey(awayTeam));
    const isHomeCaptain = captainTeams.some((t) => teamKey(t) === teamKey(homeTeam));
    if (!isAdmin && !isAwayCaptain && !isHomeCaptain) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const myRole: "away_captain" | "home_captain" | "admin" = isAdmin
      ? "admin"
      : isAwayCaptain
        ? "away_captain"
        : "home_captain";

    const state = await buildLightState(week, awayTeam, homeTeam, myRole);
    if (!state) {
      return NextResponse.json({ error: "Draft not initialized — load the full builder first" }, { status: 404 });
    }
    return NextResponse.json(state);
  } catch (err: any) {
    console.error("[matchup-builder/state GET]", err);
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 500 });
  }
}
