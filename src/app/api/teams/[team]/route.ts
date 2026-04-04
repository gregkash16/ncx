// src/app/api/teams/[team]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { team: string } }
) {
  try {
    const teamSlug = decodeURIComponent(params.team).trim();

    // 1. Standings row for this team
    const [standRows] = await pool.query<any[]>(
      `SELECT \`rank\`, team, wins, losses, game_wins AS gameWins, points
       FROM S9.overall_standings
       WHERE team = ?
       LIMIT 1`,
      [teamSlug]
    );
    const standing = standRows?.[0]
      ? {
          rank: Number(standRows[0].rank),
          team: String(standRows[0].team),
          wins: Number(standRows[0].wins ?? 0),
          losses: Number(standRows[0].losses ?? 0),
          gameWins: Number(standRows[0].gameWins ?? 0),
          points: Number(standRows[0].points ?? 0),
        }
      : null;

    // 2. Roster — players on this team from individual_stats
    const [rosterRows] = await pool.query<any[]>(
      `SELECT
         \`rank\`, ncxid, first, last, pick, team, faction,
         wins, losses, points, plms, games,
         winPct, ppg, efficiency, war, h2h, potato, sos
       FROM S9.individual_stats
       WHERE team = ?
       ORDER BY pick ASC, first ASC`,
      [teamSlug]
    );
    const roster = (rosterRows ?? []).map((r: any) => ({
      rank: Number(r.rank ?? 0),
      ncxid: String(r.ncxid ?? ""),
      first: String(r.first ?? ""),
      last: String(r.last ?? ""),
      pick: Number(r.pick ?? 0),
      team: String(r.team ?? ""),
      faction: String(r.faction ?? ""),
      wins: Number(r.wins ?? 0),
      losses: Number(r.losses ?? 0),
      points: Number(r.points ?? 0),
      plms: Number(r.plms ?? 0),
      games: Number(r.games ?? 0),
      winPct: Number(r.winPct ?? 0),
      ppg: Number(r.ppg ?? 0),
      efficiency: Number(r.efficiency ?? 0),
      war: Number(r.war ?? 0),
      h2h: Number(r.h2h ?? 0),
      potato: Number(r.potato ?? 0),
      sos: Number(r.sos ?? 0),
    }));

    // 3. Schedule — team_schedule rows involving this team
    const [schedRows] = await pool.query<any[]>(
      `SELECT week_label, away_team, home_team
       FROM S9.team_schedule
       WHERE away_team = ? OR home_team = ?
       ORDER BY CAST(SUBSTRING_INDEX(week_label, ' ', -1) AS UNSIGNED) ASC`,
      [teamSlug, teamSlug]
    );

    // 4. For each schedule row, aggregate series results from weekly_matchups
    const scheduleWeeks = (schedRows ?? []).map((r: any) => ({
      week: String(r.week_label ?? ""),
      away: String(r.away_team ?? ""),
      home: String(r.home_team ?? ""),
    }));

    // Batch-fetch all matchup results for weeks this team plays
    const weekLabels = [...new Set(scheduleWeeks.map((s) => s.week))];
    let matchupsByWeek: Record<string, any[]> = {};

    if (weekLabels.length > 0) {
      const placeholders = weekLabels.map(() => "?").join(",");
      const [mRows] = await pool.query<any[]>(
        `SELECT week_label, awayTeam, homeTeam, awayPts, homePts
         FROM S9.weekly_matchups
         WHERE week_label IN (${placeholders})
           AND (awayTeam = ? OR homeTeam = ?)
         ORDER BY week_label, game ASC`,
        [...weekLabels, teamSlug, teamSlug]
      );
      for (const m of mRows ?? []) {
        const wk = String(m.week_label);
        if (!matchupsByWeek[wk]) matchupsByWeek[wk] = [];
        matchupsByWeek[wk].push(m);
      }
    }

    const schedule = scheduleWeeks.map((s) => {
      const games = matchupsByWeek[s.week] ?? [];
      let awayWins = 0;
      let homeWins = 0;
      let gamesPlayed = 0;

      for (const g of games) {
        const aPts = Number(g.awayPts ?? 0);
        const hPts = Number(g.homePts ?? 0);
        if (aPts > 0 || hPts > 0) {
          gamesPlayed++;
          if (aPts > hPts) awayWins++;
          else if (hPts > aPts) homeWins++;
        }
      }

      let status: "SCHEDULED" | "IN_PROGRESS" | "FINAL" = "SCHEDULED";
      if (gamesPlayed > 0) {
        status = awayWins >= 4 || homeWins >= 4 ? "FINAL" : "IN_PROGRESS";
      }

      return {
        week: s.week,
        away: s.away,
        home: s.home,
        awayWins,
        homeWins,
        status,
      };
    });

    return NextResponse.json({ ok: true, standing, roster, schedule });
  } catch (err: any) {
    console.error("GET /api/teams/[team] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load team" },
      { status: 500 }
    );
  }
}
