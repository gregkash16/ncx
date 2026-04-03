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
          week_label,
          game,
          awayId,
          awayName,
          awayTeam,
          awayPts,
          homeId,
          homeName,
          homeTeam,
          homePts,
          scenario
        FROM S9.weekly_matchups
        WHERE week_label = ?
        ORDER BY game ASC
      `,
      [week]
    );

    const matchups = (rows ?? []).map((r: any) => ({
      week: String(r.week_label ?? ""),
      game: r.game != null ? String(r.game) : null,
      away_id: r.awayId != null ? String(r.awayId) : null,
      away_name: r.awayName != null ? String(r.awayName) : null,
      away_team: r.awayTeam != null ? String(r.awayTeam).trim() : null,
      away_pts: r.awayPts != null ? Number(r.awayPts) : null,
      home_id: r.homeId != null ? String(r.homeId) : null,
      home_name: r.homeName != null ? String(r.homeName) : null,
      home_team: r.homeTeam != null ? String(r.homeTeam).trim() : null,
      home_pts: r.homePts != null ? Number(r.homePts) : null,
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
