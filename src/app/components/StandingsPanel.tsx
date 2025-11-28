// src/app/components/StandingsPanel.tsx
import Image from "next/image";
import {
  fetchOverallStandingsCached,
  fetchMatchupsDataCached,
  getSheets,
  fetchTeamScheduleAllCached, // ⬅️ NEW
} from "@/lib/googleSheets";

type SeriesResult = "win" | "loss";

function teamNameToSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toInt(val: unknown): number {
  const n = parseInt(String(val ?? "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function parseWeekNum(label: string | undefined | null): number | null {
  if (!label) return null;
  const m = label.trim().match(/week\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function formatWeekLabel(n: number) {
  return `WEEK ${n}`;
}

/**
 * Load one WEEK tab and return a map of
 *   teamName -> "win" | "loss"
 * based on series results (best of 7).
 */
async function loadWeekSeriesResults(
  sheets: ReturnType<typeof getSheets>,
  spreadsheetId: string,
  weekLabel: string
): Promise<Map<string, SeriesResult>> {
  const result = new Map<string, SeriesResult>();

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${weekLabel}!A1:Q120`,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const data: any[][] = resp.data.values ?? [];

  // same grid as CurrentWeekCard / TeamSchedulePanel:
  // visually row 10,20,... => indices 9,19,... => rowNum starts at 9
  for (let rowNum = 9; rowNum < 120; rowNum += 10) {
    const idx = rowNum - 1;
    const row = data[idx] ?? [];

    const awayTeam = String(row[3] ?? "").trim();
    const homeTeam = String(row[11] ?? "").trim();
    if (!awayTeam && !homeTeam) continue;

    const awayWins = toInt(row[4]);
    const homeWins = toInt(row[12]);

    const seriesOver = awayWins >= 4 || homeWins >= 4;
    if (!seriesOver) continue;

    if (awayWins === homeWins) {
      // shouldn't really happen in best-of-7; ignore if it does
      continue;
    }

    const awayResult: SeriesResult = awayWins > homeWins ? "win" : "loss";
    const homeResult: SeriesResult = homeWins > awayWins ? "win" : "loss";

    if (awayTeam) result.set(awayTeam, awayResult);
    if (homeTeam) result.set(homeTeam, homeResult);
  }

  return result;
}

/**
 * Given per-week result maps (index 0 = WEEK 1, etc),
 * compute the current series streak for a team by
 * walking backwards from the latest week.
 */
function getStreakForTeam(
  teamName: string,
  weekResults: Map<string, SeriesResult>[] | null
): { dir: "up" | "down" | null; count: number } {
  if (!weekResults || weekResults.length === 0) {
    return { dir: null, count: 0 };
  }

  let last: SeriesResult | null = null;
  let count = 0;

  for (let i = weekResults.length - 1; i >= 0; i--) {
    const map = weekResults[i];
    const res = map.get(teamName);
    if (!res) continue; // no completed series for this team that week

    if (!last) {
      last = res;
      count = 1;
    } else if (res === last) {
      count++;
    } else {
      break;
    }
  }

  if (!last || count === 0) return { dir: null, count: 0 };
  return { dir: last === "win" ? "up" : "down", count };
}

function StreakPill({
  dir,
  count,
}: {
  dir: "up" | "down" | null;
  count: number;
}) {
  if (!dir || count <= 0) return null;

  const base =
    "inline-flex items-center justify-end gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border";
  const upCls =
    "bg-emerald-500/10 border-emerald-400/60 text-emerald-300";
  const downCls =
    "bg-red-500/10 border-red-400/60 text-red-300";

  const cls = dir === "up" ? upCls : downCls;
  const arrow = dir === "up" ? "↑" : "↓";

  return (
    <span className={`${base} ${cls}`}>
      <span>{arrow}</span>
      <span>{count}</span>
    </span>
  );
}

/** -------------------- Playoff math helpers -------------------- **/

type TeamPlayoffWindow = {
  team: string;
  wins: number;     // current series wins
  gameWins: number; // current game wins

  remaining: number; // remaining series (not yet finished)
  minWins: number;
  maxWins: number;
  minGW: number;
  maxGW: number;
};

/**
 * Compute remaining series for each team, using the
 * SCHEDULE overview and completed series from WEEK tabs.
 *
 * - Season is 10 weeks, 1 series per week per team.
 * - We count total scheduled series (from SCHEDULE),
 *   then subtract completed series (from weekResults).
 */

// Treat the season as if it were only this many weeks long
const MAX_WEEKS_FOR_PLAYOFF_MATH = 10;

async function computeRemainingSeriesPerTeam(
  weekResults: Map<string, SeriesResult>[] | null,
  activeWeekNum: number | null
): Promise<Record<string, number>> {
  const schedule = await fetchTeamScheduleAllCached(); // [{week, away, home}, ...]
  const remaining: Record<string, number> = {};

  // Total scheduled series per team, but only up to MAX_WEEKS_FOR_PLAYOFF_MATH
  for (const row of schedule) {
    const away = row.away;
    const home = row.home;

    // row.week looks like "WEEK 1", "WEEK 2", ...
    const weekNum = parseWeekNum(row.week);
    if (!weekNum || weekNum > MAX_WEEKS_FOR_PLAYOFF_MATH) {
      continue; // pretend weeks 9–10 don't exist
    }

    if (away) remaining[away] = (remaining[away] ?? 0) + 1;
    if (home) remaining[home] = (remaining[home] ?? 0) + 1;
  }

  // Subtract completed series from WEEK 1..min(activeWeekNum, MAX_WEEKS_FOR_PLAYOFF_MATH)
  if (weekResults && activeWeekNum) {
    const cappedActive = Math.min(activeWeekNum, MAX_WEEKS_FOR_PLAYOFF_MATH);

    for (let n = 1; n <= cappedActive; n++) {
      const idx = n - 1;
      const map = weekResults[idx];
      if (!map) continue;

      for (const teamName of map.keys()) {
        if (remaining[teamName] != null && remaining[teamName] > 0) {
          remaining[teamName] -= 1;
        }
      }
    }
  }

  // Clamp just in case
  for (const k of Object.keys(remaining)) {
    if (remaining[k] < 0) remaining[k] = 0;
  }

  return remaining;
}

/**
 * Can "other" possibly finish at or above "team" in the
 * worst-case for team / best-case for other, using
 * (wins, gameWins) with gameWins as the only tiebreaker
 * and points ignored.
 *
 * We treat ties in (wins, gameWins) as *dangerous* because
 * points could break them either way → so we consider a
 * tie as "could threaten" for clinch logic.
 */
function canOtherPossiblyThreatenTeam(
  other: TeamPlayoffWindow,
  team: TeamPlayoffWindow
): boolean {
  const teamWorstWins = team.minWins;
  const teamWorstGW = team.minGW;

  const otherBestWins = other.maxWins;
  const otherBestGW = other.maxGW;

  if (otherBestWins > teamWorstWins) return true;
  if (otherBestWins === teamWorstWins && otherBestGW >= teamWorstGW) return true; // tie or better on GW
  return false;
}

/**
 * Is this team mathematically clinched for a top-16 spot,
 * given (wins, gameWins) and ignoring points?
 *
 * A team is clinched if, even in their worst case, there
 * are at most 15 teams that can possibly finish at or
 * above them in (wins, gameWins).
 */
function isTeamClinched(
  team: TeamPlayoffWindow,
  all: TeamPlayoffWindow[]
): boolean {
  let threats = 0;

  for (const other of all) {
    if (other.team === team.team) continue;
    if (canOtherPossiblyThreatenTeam(other, team)) {
      threats++;
      if (threats > 15) return false;
    }
  }

  return threats <= 15;
}

/**
 * Is this team mathematically eliminated from a top-16 spot,
 * given (wins, gameWins) and ignoring points?
 *
 * A team is eliminated if, even in their best case, there
 * are already 16 teams that are guaranteed to finish strictly
 * ahead of them in (wins, gameWins).
 */
function isTeamEliminated(
  team: TeamPlayoffWindow,
  all: TeamPlayoffWindow[]
): boolean {
  const bestWins = team.maxWins;
  const bestGW = team.maxGW;

  let guaranteedAhead = 0;

  for (const other of all) {
    if (other.team === team.team) continue;

    const otherWorstWins = other.minWins;
    const otherWorstGW = other.minGW;

    // Other is guaranteed strictly ahead of team:
    // - more wins no matter what, OR
    // - same wins but strictly more GW no matter what.
    if (
      otherWorstWins > bestWins ||
      (otherWorstWins === bestWins && otherWorstGW > bestGW)
    ) {
      guaranteedAhead++;
      if (guaranteedAhead >= 16) return true;
    }
  }

  return false;
}

export default async function StandingsPanel() {
  let data: Awaited<ReturnType<typeof fetchOverallStandingsCached>> = [];
  let errorMsg: string | null = null;

  // 1) Fetch standings data
  try {
    data = await fetchOverallStandingsCached();
  } catch (e: any) {
    errorMsg =
      "We hit the Google Sheets read limit momentarily. Please try again in a minute.";
  }

  // 2) Compute series streaks from WEEK tabs
  let weekResults: Map<string, SeriesResult>[] | null = null;
  let activeNum: number | null = null;

  try {
    const spreadsheetId =
      process.env.NCX_LEAGUE_SHEET_ID || process.env.SHEETS_SPREADSHEET_ID;

    if (spreadsheetId) {
      const sheets = getSheets();

      // Use the same helper as the rest of the site to find the active week
      const { weekTab: activeWeek } = await fetchMatchupsDataCached();
      activeNum = parseWeekNum(activeWeek);

      if (activeNum && activeNum > 0) {
        const tmp: Map<string, SeriesResult>[] = [];

        // Load WEEK 1..activeNum sequentially
        for (let n = 1; n <= activeNum; n++) {
          const wkLabel = formatWeekLabel(n);
          try {
            const map = await loadWeekSeriesResults(
              sheets,
              spreadsheetId,
              wkLabel
            );
            tmp.push(map);
          } catch {
            // If a specific week tab fails, push an empty map so indexes still line up
            tmp.push(new Map());
          }
        }

        weekResults = tmp;
      }
    }
  } catch {
    // If anything fails here, we just won't show streaks or playoff flags
    weekResults = null;
    activeNum = null;
  }

  // 3) Playoff windows (min/max wins + game wins) and flags
  let playoffFlags: Record<
    string,
    {
      clinched: boolean;
      eliminated: boolean;
    }
  > = {};

  try {
    if (!errorMsg && data.length > 0 && weekResults && activeNum) {
      const remainingSeriesPerTeam = await computeRemainingSeriesPerTeam(
        weekResults,
        activeNum
      );

      const teams: TeamPlayoffWindow[] = data.map((row) => {
        const wins = toInt(row.wins);
        const gameWins = toInt(row.gameWins);
        const remaining = remainingSeriesPerTeam[row.team] ?? 0;

        const minWins = wins; // lose out
        const maxWins = wins + remaining; // win out

        const minGW = gameWins; // assume worst, no more game wins
        const maxGW = gameWins + remaining * 4; // assume best, sweep every remaining series

        return {
          team: row.team,
          wins,
          gameWins,
          remaining,
          minWins,
          maxWins,
          minGW,
          maxGW,
        };
      });

      playoffFlags = {};
      for (const t of teams) {
        const clinched = isTeamClinched(t, teams);
        const eliminated = !clinched && isTeamEliminated(t, teams);
        playoffFlags[t.team] = { clinched, eliminated };
      }
    }
  } catch {
    // If any playoff math fails, just don't show flags
    playoffFlags = {};
  }

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800">
      <h2 className="text-2xl font-bold tracking-wide text-center mb-4">
        <span className="text-pink-400">OVERALL</span>{" "}
        <span className="text-cyan-400">STANDINGS</span>
      </h2>

      {errorMsg ? (
        <p className="text-sm text-amber-300 text-center">{errorMsg}</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center">No data.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-zinc-200">
            <thead className="text-sm uppercase text-zinc-400">
              <tr className="[&>th]:py-2 [&>th]:px-2">
                <th className="w-14">Rank</th>
                <th>Team</th>
                <th className="text-right w-16">W</th>
                <th className="text-right w-16">L</th>
                <th className="text-right w-24">GW</th>
                <th className="text-right w-24">Pts</th>
                <th className="text-right w-24">Strk</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {data.map((row) => {
                const slug = teamNameToSlug(row.team);
                const logoSrc = `/logos/${slug}.png`;
                const href = `/?tab=team&team=${encodeURIComponent(slug)}`;

                const { dir, count } = getStreakForTeam(
                  row.team,
                  weekResults
                );

                const flags =
                  playoffFlags[row.team] ?? {
                    clinched: false,
                    eliminated: false,
                  };

                return (
                  <tr
                    key={`${row.rank}-${row.team}`}
                    className="border-t border-zinc-800 hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-2 px-2">{row.rank}</td>
                    <td className="py-2 px-2">
                      <a
                        href={href}
                        className="flex items-center gap-3 min-w-0 hover:underline underline-offset-2"
                      >
                        <span className="shrink-0 rounded-md overflow-hidden bg-zinc-800 border border-zinc-700 w-[28px] h-[28px] flex items-center justify-center">
                          <Image
                            src={logoSrc}
                            alt={`${row.team} logo`}
                            width={28}
                            height={28}
                            className="object-contain"
                            unoptimized
                          />
                        </span>
                        <span className="truncate">
                          {row.team}
                          {flags.clinched && (
                            <span className="ml-2 text-[11px] font-semibold text-emerald-400/70">
                              - ✓
                            </span>
                          )}
                          {!flags.clinched && flags.eliminated && (
                            <span className="ml-2 text-[11px] font-semibold text-red-400/70">
                              - x
                            </span>
                          )}
                        </span>
                      </a>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {row.wins}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {row.losses}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {row.gameWins}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {row.points}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <StreakPill dir={dir} count={count} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Link to Playoff Bracket */}
      <div className="mt-4 flex justify-center">
        <a
          href="/?tab=playoffs"
          className="inline-block rounded-xl border border-cyan-500/40 bg-zinc-950/70 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400 transition"
        >
          🏆 View Playoff Bracket
        </a>
      </div>
    </div>
  );
}
