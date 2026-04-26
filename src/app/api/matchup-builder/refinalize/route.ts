// POST /api/matchup-builder/refinalize — captain or admin pushes pending subs
// to the Sheet (only the changed rows) and triggers a seed sync.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getSheets } from "@/lib/googleSheets";
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

async function triggerSeed() {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const key = process.env.SEED_API_KEY;
  if (!key) throw new Error("Missing SEED_API_KEY");
  const url = `${baseUrl}/api/seed-mysql?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Seed failed: ${res.status} ${txt}`);
  }
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
    const { week, awayTeam, homeTeam } = body;
    if (!week || !awayTeam || !homeTeam) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const isAwayCaptain = captainTeams.some((t) => teamKey(t) === teamKey(awayTeam));
    const isHomeCaptain = captainTeams.some((t) => teamKey(t) === teamKey(homeTeam));
    if (!isAdmin && !isAwayCaptain && !isHomeCaptain) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      return NextResponse.json({ error: "Draft not finalized" }, { status: 400 });
    }

    const [pendingRows] = await conn.query(
      `SELECT slot, away_ncxid, home_ncxid FROM S9.matchup_draft
       WHERE week_label = ? AND away_team = ? AND home_team = ? AND pending_sub = 1
       ORDER BY slot`,
      [week, awayTeam, homeTeam]
    );
    const pending = pendingRows as any[];
    if (pending.length === 0) {
      await conn.rollback();
      return NextResponse.json({ error: "No pending subs to apply" }, { status: 400 });
    }

    // Map slot -> sheet row_index
    const [gameRows] = await conn.query(
      `SELECT game, row_index FROM S9.weekly_matchups
       WHERE week_label = ? AND awayTeam = ? AND homeTeam = ?
       ORDER BY CAST(game AS UNSIGNED) ASC`,
      [week, awayTeam, homeTeam]
    );
    const gameList = (gameRows as any[]).map((r: any) => ({
      game: parseInt(r.game, 10),
      rowIndex: Number(r.row_index) || 0,
    }));
    if (gameList.length !== 7) {
      await conn.rollback();
      return NextResponse.json(
        { error: `Expected 7 games in weekly_matchups, found ${gameList.length}` },
        { status: 500 }
      );
    }
    const missingRowIndex = gameList.find((g) => !g.rowIndex);
    if (missingRowIndex) {
      await conn.rollback();
      return NextResponse.json(
        { error: `Game ${missingRowIndex.game} has no row_index — run /api/seed-mysql first` },
        { status: 500 }
      );
    }

    const sheets = getSheets();
    const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
    const weekTab = week;

    const batchData: { range: string; values: any[][] }[] = [];
    for (const p of pending) {
      const slotIdx = Number(p.slot) - 1;
      const game = gameList[slotIdx];
      if (!game) continue;
      batchData.push(
        { range: `${weekTab}!B${game.rowIndex}`, values: [[p.away_ncxid]] },
        { range: `${weekTab}!J${game.rowIndex}`, values: [[p.home_ncxid]] },
      );
    }

    if (batchData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: "RAW", data: batchData },
      });
    }

    await conn.query(
      `UPDATE S9.matchup_draft SET pending_sub = 0
       WHERE week_label = ? AND away_team = ? AND home_team = ? AND pending_sub = 1`,
      [week, awayTeam, homeTeam]
    );

    await conn.commit();

    try {
      await triggerSeed();
    } catch (seedErr) {
      console.error("[matchup-builder/refinalize] Seed sync failed:", seedErr);
    }

    return NextResponse.json({ ok: true, slotsUpdated: pending.length });
  } catch (err: any) {
    await conn.rollback();
    console.error("[matchup-builder/refinalize]", err);
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 500 });
  } finally {
    conn.release();
  }
}
