// POST /api/matchup-builder/pick  —  Captain submits a player pick
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
    const { week, awayTeam, homeTeam, slot, ncxid, side } = body;

    if (!week || !awayTeam || !homeTeam || !slot || !ncxid || !side) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const isAwayCaptain = captainTeams.some((t) => teamKey(t) === teamKey(awayTeam));
    const isHomeCaptain = captainTeams.some((t) => teamKey(t) === teamKey(homeTeam));

    // Validate side matches role
    if (side === "away" && !isAwayCaptain && !isAdmin) {
      return NextResponse.json({ error: "Not away captain" }, { status: 403 });
    }
    if (side === "home" && !isHomeCaptain && !isAdmin) {
      return NextResponse.json({ error: "Not home captain" }, { status: 403 });
    }

    await conn.beginTransaction();

    // Lock the series row
    const [seriesRows] = await conn.query(
      "SELECT * FROM S9.matchup_draft_series WHERE week_label = ? AND away_team = ? AND home_team = ? FOR UPDATE",
      [week, awayTeam, homeTeam]
    );
    const series = (seriesRows as any[])[0];
    if (!series) { await conn.rollback(); return NextResponse.json({ error: "Draft not found" }, { status: 404 }); }
    if (series.finalized) { await conn.rollback(); return NextResponse.json({ error: "Draft already finalized" }, { status: 400 }); }
    if (series.current_slot !== slot) { await conn.rollback(); return NextResponse.json({ error: `Not the current slot (expected ${series.current_slot})` }, { status: 400 }); }

    // Get current slot
    const [slotRows] = await conn.query(
      "SELECT * FROM S9.matchup_draft WHERE week_label = ? AND away_team = ? AND home_team = ? AND slot = ? FOR UPDATE",
      [week, awayTeam, homeTeam, slot]
    );
    const slotRow = (slotRows as any[])[0];
    if (!slotRow) { await conn.rollback(); return NextResponse.json({ error: "Slot not found" }, { status: 404 }); }

    if (side === "away") {
      if (slotRow.status !== "awaiting_away") {
        await conn.rollback();
        return NextResponse.json({ error: "Not awaiting away pick" }, { status: 400 });
      }

      // Verify player is on away team and not already assigned
      const [playerRows] = await conn.query(
        "SELECT ncxid, first_name, last_name FROM S9.individual_stats WHERE ncxid = ? AND team = ?",
        [ncxid, awayTeam]
      );
      const player = (playerRows as any[])[0];
      if (!player) { await conn.rollback(); return NextResponse.json({ error: "Player not on away team" }, { status: 400 }); }

      // Check not already assigned in another slot
      const [assignedRows] = await conn.query(
        "SELECT slot FROM S9.matchup_draft WHERE week_label = ? AND away_team = ? AND home_team = ? AND away_ncxid = ? AND slot != ?",
        [week, awayTeam, homeTeam, ncxid, slot]
      );
      if ((assignedRows as any[]).length > 0) {
        await conn.rollback();
        return NextResponse.json({ error: "Player already assigned" }, { status: 400 });
      }

      const playerName = `${player.first_name} ${player.last_name}`.trim();
      await conn.query(
        "UPDATE S9.matchup_draft SET away_ncxid = ?, away_name = ?, status = 'awaiting_home' WHERE id = ?",
        [ncxid, playerName, slotRow.id]
      );
    } else {
      // side === "home"
      if (slotRow.status !== "awaiting_home") {
        await conn.rollback();
        return NextResponse.json({ error: "Not awaiting home pick" }, { status: 400 });
      }

      const [playerRows] = await conn.query(
        "SELECT ncxid, first_name, last_name FROM S9.individual_stats WHERE ncxid = ? AND team = ?",
        [ncxid, homeTeam]
      );
      const player = (playerRows as any[])[0];
      if (!player) { await conn.rollback(); return NextResponse.json({ error: "Player not on home team" }, { status: 400 }); }

      const [assignedRows] = await conn.query(
        "SELECT slot FROM S9.matchup_draft WHERE week_label = ? AND away_team = ? AND home_team = ? AND home_ncxid = ? AND slot != ?",
        [week, awayTeam, homeTeam, ncxid, slot]
      );
      if ((assignedRows as any[]).length > 0) {
        await conn.rollback();
        return NextResponse.json({ error: "Player already assigned" }, { status: 400 });
      }

      // Block vetoed player from being re-picked in the same slot
      if (slotRow.vetoed_home_ncxid && slotRow.vetoed_home_ncxid === ncxid) {
        await conn.rollback();
        return NextResponse.json({ error: "This player was vetoed for this matchup" }, { status: 400 });
      }

      const playerName = `${player.first_name} ${player.last_name}`.trim();

      // If veto already used, skip veto window — go straight to locked and advance
      if (series.veto_used) {
        await conn.query(
          "UPDATE S9.matchup_draft SET home_ncxid = ?, home_name = ?, status = 'locked' WHERE id = ?",
          [ncxid, playerName, slotRow.id]
        );
        // Advance to next slot
        if (slot < 7) {
          await conn.query(
            "UPDATE S9.matchup_draft_series SET current_slot = ? WHERE id = ?",
            [slot + 1, series.id]
          );
        }
      } else {
        // Veto still available — enter veto window
        await conn.query(
          "UPDATE S9.matchup_draft SET home_ncxid = ?, home_name = ?, status = 'awaiting_veto_window' WHERE id = ?",
          [ncxid, playerName, slotRow.id]
        );
      }
    }

    await conn.commit();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    await conn.rollback();
    console.error("[matchup-builder/pick]", err);
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 500 });
  } finally {
    conn.release();
  }
}
