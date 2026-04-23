import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getSheets } from "@/lib/googleSheets";
import { rebuildStreamDiscordPost } from "@/lib/streamDiscord";

const ADMIN_DISCORD_IDS = ["349349801076195329", "986330724212801557"];
const SPREADSHEET_ID = "1x4_rfPq-fPnJ2IT6WbNzBxVmomqU36fU24pnKuPaObw";

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
  try {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "SCHEDULE!J3",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const raw = String(res.data.values?.[0]?.[0] ?? "").trim();
    if (!raw) return "WEEK 1";
    if (/^\d+$/.test(raw)) return `WEEK ${raw}`;
    return raw.toUpperCase();
  } catch {
    const [weekRows] = await pool.query<any[]>(
      `SELECT week_label FROM S9.current_week LIMIT 1`
    );
    return weekRows?.[0]?.week_label || "WEEK 1";
  }
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
