import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { rebuildStreamDiscordPost } from "@/lib/streamDiscord";

const ADMIN_DISCORD_IDS = ["349349801076195329", "986330724212801557"];

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/[<@!>]/g, "")
    .replace(/\D/g, "");
}

function isAdmin(discordId: string): boolean {
  return ADMIN_DISCORD_IDS.includes(discordId);
}

async function getSetupWeek(): Promise<string> {
  const [rows] = await pool.query<any[]>(
    `SELECT schedule_week, week_label FROM S9.current_week LIMIT 1`
  );
  const r = rows?.[0];
  return r?.schedule_week || r?.week_label || "WEEK 1";
}

export async function POST(request: NextRequest) {
  try {
    const nativeDiscordId = request.headers.get("x-discord-id");
    const session = nativeDiscordId ? null : await getServerSession(authOptions);

    if (!session?.user && !nativeDiscordId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const discordId = nativeDiscordId
      ? normalizeDiscordId(nativeDiscordId)
      : normalizeDiscordId(
          (session!.user as any).discordId ?? (session!.user as any).id
        );
    if (!isAdmin(discordId)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const currentWeek = await getSetupWeek();
    await rebuildStreamDiscordPost(currentWeek);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("POST /api/stream-signup/discord error:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to update Discord" },
      { status: 500 }
    );
  }
}
