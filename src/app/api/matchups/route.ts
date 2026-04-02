import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  try {
    // Get current week
    const [weekRows] = await pool.query<any[]>(
      `SELECT week_label FROM S9.current_week LIMIT 1`
    );
    const currentWeek = weekRows?.[0]?.week_label || "WEEK 1";

    // Get requested week or default to current
    const { searchParams } = new URL(request.url);
    const week = searchParams.get("week") || currentWeek;

    // Fetch matchups for the requested week
    const [rows] = await pool.query<any[]>(
      `
        SELECT
          week_label  AS week,
          game,
          away_id,
          away_name,
          awayTeam    AS away_team,
          away_pts,
          home_id,
          home_name,
          homeTeam    AS home_team,
          home_pts,
          scenario
        FROM S9.weekly_matchups
        WHERE week_label = ?
        ORDER BY game ASC
      `,
      [week]
    );

    const matchups = (rows ?? []).map((r: any) => ({
      week: String(r.week ?? ""),
      game: r.game != null ? String(r.game) : null,
      away_id: r.away_id != null ? String(r.away_id) : null,
      away_name: r.away_name != null ? String(r.away_name) : null,
      away_team: r.away_team != null ? String(r.away_team).trim() : null,
      away_pts: r.away_pts != null ? Number(r.away_pts) : null,
      home_id: r.home_id != null ? String(r.home_id) : null,
      home_name: r.home_name != null ? String(r.home_name) : null,
      home_team: r.home_team != null ? String(r.home_team).trim() : null,
      home_pts: r.home_pts != null ? Number(r.home_pts) : null,
      scenario: r.scenario != null ? String(r.scenario) : null,
    }));

    return NextResponse.json({ currentWeek, matchups });
  } catch (err: any) {
    console.error("GET /api/matchups error:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to fetch matchups" },
      { status: 500 }
    );
  }
}
