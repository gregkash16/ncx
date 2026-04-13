// POST /api/matchup-builder/veto  —  Away captain vetoes the home pick
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getSheets } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

const ADMIN_DISCORD_IDS = ["349349801076195329", "986330724212801557"] as const;

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "").trim().replace(/[<@!>]/g, "").replace(/\D/g, "");
}
function norm(v: unknown) { return String(v ?? "").trim(); }
function teamKey(s: string): string { return String(s ?? "").trim().toUpperCase(); }

type SheetsClient = ReturnType<typeof getSheets>;

async function getCaptainTeamsForDiscord(
  sheets: SheetsClient, spreadsheetId: string, discordId: string
): Promise<string[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId, range: "NCXID!K2:O25", valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = res.data.values ?? [];
  const teams: string[] = [];
  for (const r of rows) {
    const team = norm(r?.[0]);
    const disc = normalizeDiscordId(r?.[4]);
    if (team && disc === discordId) teams.push(team);
  }
  return teams;
}

export async function POST(req: NextRequest) {
  const conn = await pool.getConnection();
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const discordId = normalizeDiscordId((session.user as any).discordId ?? (session.user as any).id);
    const isAdmin = (ADMIN_DISCORD_IDS as readonly string[]).includes(discordId);
    const sheets = getSheets();
    const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
    const captainTeams = await getCaptainTeamsForDiscord(sheets, spreadsheetId, discordId);

    const body = await req.json();
    const { week, awayTeam, homeTeam, slot } = body;

    const isAwayCaptain = captainTeams.some((t) => teamKey(t) === teamKey(awayTeam));
    if (!isAwayCaptain && !isAdmin) {
      return NextResponse.json({ error: "Only away captain can veto" }, { status: 403 });
    }

    await conn.beginTransaction();

    const [seriesRows] = await conn.query(
      "SELECT * FROM S9.matchup_draft_series WHERE week_label = ? AND away_team = ? AND home_team = ? FOR UPDATE",
      [week, awayTeam, homeTeam]
    );
    const series = (seriesRows as any[])[0];
    if (!series) { await conn.rollback(); return NextResponse.json({ error: "Draft not found" }, { status: 404 }); }
    if (series.veto_used) { await conn.rollback(); return NextResponse.json({ error: "Veto already used" }, { status: 400 }); }
    if (slot === 7) { await conn.rollback(); return NextResponse.json({ error: "Cannot veto on matchup 7" }, { status: 400 }); }
    if (series.current_slot !== slot) { await conn.rollback(); return NextResponse.json({ error: "Not the current slot" }, { status: 400 }); }

    const [slotRows] = await conn.query(
      "SELECT * FROM S9.matchup_draft WHERE week_label = ? AND away_team = ? AND home_team = ? AND slot = ? FOR UPDATE",
      [week, awayTeam, homeTeam, slot]
    );
    const slotRow = (slotRows as any[])[0];
    if (!slotRow || slotRow.status !== "awaiting_veto_window") {
      await conn.rollback();
      return NextResponse.json({ error: "Not in veto window" }, { status: 400 });
    }

    // Save vetoed player, clear home pick, mark vetoed, set veto_used on series
    await conn.query(
      "UPDATE S9.matchup_draft SET vetoed_home_ncxid = home_ncxid, home_ncxid = NULL, home_name = NULL, vetoed = 1, status = 'awaiting_home' WHERE id = ?",
      [slotRow.id]
    );
    await conn.query(
      "UPDATE S9.matchup_draft_series SET veto_used = 1 WHERE id = ?",
      [series.id]
    );

    await conn.commit();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    await conn.rollback();
    console.error("[matchup-builder/veto]", err);
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 500 });
  } finally {
    conn.release();
  }
}
