// src/app/api/tts/matchup/route.ts
// Unadvertised lookup endpoint used by the TTS Reporter object.
// Given a game number (and optional week), returns the away/home NCXID/name/team
// plus the sheet rowIndex so the Lua can later call /api/tts/report.
//
// No auth — TTS scripts are visible to anyone with the mod so a shared secret
// buys nothing. Endpoint is unadvertised; we trust players to report honestly.

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function norm(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeWeekLabel(label: string): string {
  const s = (label ?? "").trim();
  if (!s) return "";
  const m1 = s.match(/week\s*(\d+)/i);
  if (m1) return `WEEK ${parseInt(m1[1], 10)}`;
  const num = Number(s);
  if (Number.isInteger(num) && num > 0) return `WEEK ${num}`;
  return s.toUpperCase();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameRaw = norm(searchParams.get("game"));
    const weekRaw = norm(searchParams.get("week"));
    if (!gameRaw) {
      return NextResponse.json(
        { ok: false, reason: "MISSING_GAME" },
        { status: 400 }
      );
    }

    let weekLabel = normalizeWeekLabel(weekRaw);
    if (!weekLabel) {
      const [cw] = await pool.query<any[]>(
        "SELECT week_label FROM S9.current_week LIMIT 1"
      );
      weekLabel = norm(cw?.[0]?.week_label) || "WEEK 1";
    }

    const [rows] = await pool.query<any[]>(
      `SELECT week_label, game, row_index, awayId, awayName, awayTeam,
              homeId, homeName, homeTeam, scenario
         FROM S9.weekly_matchups
        WHERE week_label = ? AND game = ?
        LIMIT 1`,
      [weekLabel, gameRaw]
    );

    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!row) {
      return NextResponse.json(
        { ok: false, reason: "NOT_FOUND", weekLabel, game: gameRaw },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      weekLabel: norm(row.week_label),
      game: norm(row.game),
      rowIndex: Number(row.row_index) || 0,
      awayNcxId: norm(row.awayId).toUpperCase(),
      awayName: norm(row.awayName),
      awayTeam: norm(row.awayTeam),
      homeNcxId: norm(row.homeId).toUpperCase(),
      homeName: norm(row.homeName),
      homeTeam: norm(row.homeTeam),
      scenario: norm(row.scenario),
      alreadyReported: Boolean(norm(row.scenario)),
    });
  } catch (err: any) {
    console.error("GET /api/tts/matchup error:", err);
    return NextResponse.json(
      { ok: false, reason: "SERVER_ERROR", message: err?.message },
      { status: 500 }
    );
  }
}
