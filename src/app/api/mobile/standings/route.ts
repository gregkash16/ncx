/**
 * GET /api/mobile/standings
 * Returns standings with playoff clinch/elimination flags
 *
 * Returns: {
 *   teams: Array<{
 *     rank: number,
 *     team: string,
 *     wins: number,
 *     losses: number,
 *     gameWins: number,
 *     points: number,
 *     streak: { dir: "up" | "down" | null, count: number },
 *     clinched: boolean,
 *     eliminated: boolean
 *   }>
 * }
 */

import { NextResponse } from "next/server";
import { fetchOverallStandingsCached, fetchMatchupsDataCached } from "@/lib/googleSheets";
import {
  formatWeekLabel,
  getStreakForTeam,
  computeRemainingSeriesPerTeam,
  isTeamClinched,
  isTeamEliminated,
  parseWeekNum,
} from "@/lib/standingsLogic";
import { getSheets } from "@/lib/googleSheets";

async function loadWeekSeriesResults(
  sheets: any,
  spreadsheetId: string,
  weekLabel: string
): Promise<Map<string, "win" | "loss">> {
  const result = new Map<string, "win" | "loss">();

  try {
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${weekLabel}!A1:Q120`,
      valueRenderOption: "FORMATTED_VALUE",
    });

    const data: any[][] = resp.data.values ?? [];

    // visually row 10,20,... => indices 9,19,... => rowNum starts at 9
    for (let rowNum = 9; rowNum < 120; rowNum += 10) {
      const idx = rowNum - 1;
      const row = data[idx] ?? [];

      const awayTeam = String(row[3] ?? "").trim();
      const homeTeam = String(row[11] ?? "").trim();
      if (!awayTeam && !homeTeam) continue;

      const toInt = (val: unknown) => {
        const n = parseInt(String(val ?? "").trim(), 10);
        return Number.isFinite(n) ? n : 0;
      };

      const awayWins = toInt(row[4]);
      const homeWins = toInt(row[12]);

      const seriesOver = awayWins >= 4 || homeWins >= 4;
      if (!seriesOver) continue;

      if (awayWins === homeWins) continue;

      const awayResult: "win" | "loss" = awayWins > homeWins ? "win" : "loss";
      const homeResult: "win" | "loss" = homeWins > awayWins ? "win" : "loss";

      if (awayTeam) result.set(awayTeam, awayResult);
      if (homeTeam) result.set(homeTeam, homeResult);
    }
  } catch {
    // Sheet doesn't exist or error reading it
  }

  return result;
}

export async function GET(req: Request) {
  try {
    const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
    const sheets = getSheets();

    // Fetch standings
    const standings = await fetchOverallStandingsCached();

    // Get active week
    let activeNum: number | null = null;
    let weekResults: Map<string, "win" | "loss">[] | null = null;

    try {
      const { weekTab: activeWeek } = await fetchMatchupsDataCached();
      activeNum = parseWeekNum(activeWeek);

      if (activeNum && activeNum > 0) {
        const tmp: Map<string, "win" | "loss">[] = [];

        for (let n = 1; n <= activeNum; n++) {
          const wkLabel = formatWeekLabel(n);
          const map = await loadWeekSeriesResults(sheets, spreadsheetId, wkLabel);
          tmp.push(map);
        }

        weekResults = tmp;
      }
    } catch {
      // Continue without week results
    }

    // Compute playoff flags
    const playoffFlags: Record<string, { clinched: boolean; eliminated: boolean }> = {};

    if (standings.length > 0 && weekResults && activeNum) {
      try {
        const remainingSeriesPerTeam = await computeRemainingSeriesPerTeam(
          weekResults,
          activeNum
        );

        const teamWindows = standings.map((t) => {
          const remaining = remainingSeriesPerTeam[t.team] ?? 0;
          return {
            team: t.team,
            wins: t.wins,
            gameWins: t.gameWins,
            remaining,
            minWins: t.wins,
            maxWins: t.wins + remaining,
            minGW: t.gameWins,
            maxGW: t.gameWins + remaining * 4,
          };
        });

        for (const t of teamWindows) {
          const clinched = isTeamClinched(t, teamWindows);
          const eliminated = !clinched && isTeamEliminated(t, teamWindows);
          playoffFlags[t.team] = { clinched, eliminated };
        }
      } catch {
        // Continue without playoff flags
      }
    }

    // Build response
    const teams = standings.map((t) => {
      const { dir, count } = getStreakForTeam(t.team, weekResults);
      const flags = playoffFlags[t.team] ?? { clinched: false, eliminated: false };

      return {
        rank: t.rank,
        team: t.team,
        wins: t.wins,
        losses: t.losses,
        gameWins: t.gameWins,
        points: t.points,
        streak: { dir, count },
        clinched: flags.clinched,
        eliminated: flags.eliminated,
      };
    });

    return NextResponse.json({ teams });
  } catch (e) {
    console.error("[mobile/standings] GET error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
