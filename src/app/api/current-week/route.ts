/**
 * /api/current-week?week=WEEK+8
 *
 * Returns series-level data for the current (or requested) week.
 * Aggregates individual game results into team-vs-team series.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // Get current week
    const [weekRows] = await pool.query<any[]>(
      `SELECT week_label FROM S9.current_week LIMIT 1`
    );
    const currentWeek = weekRows?.[0]?.week_label || 'WEEK 1';

    // Use requested week or default to current
    const week = req.nextUrl.searchParams.get('week') || currentWeek;

    // Get all weeks for the week selector
    const [allWeeks] = await pool.query<any[]>(
      `SELECT DISTINCT week_label FROM S9.weekly_matchups ORDER BY CAST(SUBSTRING_INDEX(week_label, ' ', -1) AS UNSIGNED) ASC`
    );
    const weeks = (allWeeks ?? []).map((r: any) => r.week_label);

    // Fetch all matchups for the week
    const [rows] = await pool.query<any[]>(
      `SELECT
        awayTeam,
        homeTeam,
        awayPts,
        homePts
      FROM S9.weekly_matchups
      WHERE week_label = ?
      ORDER BY game ASC`,
      [week]
    );

    // Aggregate into series: group by team pair, count wins
    const seriesMap = new Map<string, {
      awayTeam: string;
      homeTeam: string;
      awayWins: number;
      homeWins: number;
    }>();

    for (const r of rows ?? []) {
      const away = (r.awayTeam ?? '').trim();
      const home = (r.homeTeam ?? '').trim();
      if (!away || !home) continue;

      const key = `${away}|${home}`;
      if (!seriesMap.has(key)) {
        seriesMap.set(key, { awayTeam: away, homeTeam: home, awayWins: 0, homeWins: 0 });
      }

      const series = seriesMap.get(key)!;
      const aPts = Number(r.awayPts ?? 0);
      const hPts = Number(r.homePts ?? 0);

      // Only count if game has been played (both have points or at least one > 0)
      if (aPts > 0 || hPts > 0) {
        if (aPts > hPts) series.awayWins++;
        else if (hPts > aPts) series.homeWins++;
      }
    }

    const series = Array.from(seriesMap.values());

    return NextResponse.json({
      currentWeek,
      showWeek: week,
      weeks,
      series,
    });
  } catch (err: any) {
    console.error('GET /api/current-week error:', err);
    return NextResponse.json(
      { error: err.message ?? 'Failed to fetch current week' },
      { status: 500 }
    );
  }
}
