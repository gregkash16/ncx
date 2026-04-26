// POST /api/matchup-builder/sub — captain or admin swaps an unselected player
// into a finalized slot. Marks the slot as pending_sub=1 until refinalize
// pushes it to the Sheet.

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

export async function POST(req: NextRequest) {
  await ensureMatchupDraftColumns();
  const conn = await pool.getConnection();
  try {
    const session = await getServerSession(authOptions);
    const sessionId = session?.user
      ? normalizeDiscordId((session.user as any).discordId ?? (session.user as any).id)
      : "";
    const headerRaw = (req.headers.get("x-discord-id") ?? "").trim();
    const isAppleAuth = headerRaw.startsWith("apple-") && process.env.DEMO_MODE === "true";
    const headerId = isAppleAuth ? "" : normalizeDiscordId(headerRaw);
    const discordId = sessionId || headerId;
    if (!discordId && !isAppleAuth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const isAdmin = isAppleAuth || (ADMIN_DISCORD_IDS as readonly string[]).includes(discordId);
    const captainTeams = await getCaptainTeams(discordId);

    const body = await req.json();
    const { week, awayTeam, homeTeam, slot, ncxid, side } = body;

    if (!week || !awayTeam || !homeTeam || !slot || !ncxid || !side) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (side !== "away" && side !== "home") {
      return NextResponse.json({ error: "Invalid side" }, { status: 400 });
    }

    const isAwayCaptain = captainTeams.some((t) => teamKey(t) === teamKey(awayTeam));
    const isHomeCaptain = captainTeams.some((t) => teamKey(t) === teamKey(homeTeam));

    if (side === "away" && !isAwayCaptain && !isAdmin) {
      return NextResponse.json({ error: "Not away captain" }, { status: 403 });
    }
    if (side === "home" && !isHomeCaptain && !isAdmin) {
      return NextResponse.json({ error: "Not home captain" }, { status: 403 });
    }

    await conn.beginTransaction();

    const [seriesRows] = await conn.query(
      "SELECT * FROM S9.matchup_draft_series WHERE week_label = ? AND away_team = ? AND home_team = ? FOR UPDATE",
      [week, awayTeam, homeTeam]
    );
    const series = (seriesRows as any[])[0];
    if (!series) {
      await conn.rollback();
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }
    if (!series.finalized) {
      await conn.rollback();
      return NextResponse.json({ error: "Draft not finalized — finish the draft first" }, { status: 400 });
    }

    // Validate the player is on the relevant team
    const team = side === "away" ? awayTeam : homeTeam;
    const [playerRows] = await conn.query(
      "SELECT ncxid, first_name, last_name FROM S9.individual_stats WHERE ncxid = ? AND team = ?",
      [ncxid, team]
    );
    const player = (playerRows as any[])[0];
    if (!player) {
      await conn.rollback();
      return NextResponse.json({ error: `Player not on ${side} team` }, { status: 400 });
    }

    // Lock the target slot
    const [slotRows] = await conn.query(
      "SELECT * FROM S9.matchup_draft WHERE week_label = ? AND away_team = ? AND home_team = ? AND slot = ? FOR UPDATE",
      [week, awayTeam, homeTeam, slot]
    );
    const slotRow = (slotRows as any[])[0];
    if (!slotRow) {
      await conn.rollback();
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }

    const currentNcxid = side === "away" ? slotRow.away_ncxid : slotRow.home_ncxid;
    if (currentNcxid === ncxid) {
      await conn.rollback();
      return NextResponse.json({ error: "Player already in this slot" }, { status: 400 });
    }

    // Make sure this player isn't already assigned to a different slot in this series
    const sideCol = side === "away" ? "away_ncxid" : "home_ncxid";
    const [assignedRows] = await conn.query(
      `SELECT slot FROM S9.matchup_draft
       WHERE week_label = ? AND away_team = ? AND home_team = ? AND ${sideCol} = ? AND slot != ?`,
      [week, awayTeam, homeTeam, ncxid, slot]
    );
    if ((assignedRows as any[]).length > 0) {
      await conn.rollback();
      return NextResponse.json({ error: "Player already in another slot" }, { status: 400 });
    }

    const playerName = `${player.first_name} ${player.last_name}`.trim();
    const nameCol = side === "away" ? "away_name" : "home_name";

    await conn.query(
      `UPDATE S9.matchup_draft
       SET ${sideCol} = ?, ${nameCol} = ?, pending_sub = 1
       WHERE id = ?`,
      [ncxid, playerName, slotRow.id]
    );

    await conn.commit();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    await conn.rollback();
    console.error("[matchup-builder/sub]", err);
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 500 });
  } finally {
    conn.release();
  }
}
