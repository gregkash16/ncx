// src/app/components/StandingsPanel.tsx
import Image from "next/image";
import { fetchTeamScheduleAllCached } from "@/lib/googleSheets";
import { pool } from "@/lib/db";

/* ---------------------------------------------
   Types
--------------------------------------------- */

type SeriesResult = "win" | "loss";

type OverallRow = {
  rank: number;
  team: string;
  wins: number;
  losses: number;
  gameWins: number;
  points: number;
};

type WeeklySeriesRow = {
  weekLabel: string;
  awayTeam: string;
  homeTeam: string;
  awayWins: number;
  homeWins: number;
};

type WeekResult = {
  weekNum: number;
  result: SeriesResult;
};

type TeamResultsMap = Record<string, WeekResult[]>;

type TeamPlayoffWindow = {
  team: string;
  wins: number; // current series wins
  gameWins: number; // current game wins
  remaining: number; // series remaining
  minWins: number;
  maxWins: number;
  minGW: number;
  maxGW: number;
};

const MAX_WEEKS_FOR_PLAYOFF_MATH = 10;

/* ---------------------------------------------
   Helpers
--------------------------------------------- */

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

/* ---------------------------------------------
   DB helpers
--------------------------------------------- */

async function fetchOverallStandingsFromDb(): Promise<OverallRow[]> {
  const [rows] = await pool.query<any[]>(
    `
      SELECT
        t.\`rank\`      AS overall_rank,
        t.\`team\`      AS team,
        t.\`wins\`      AS wins,
        t.\`losses\`    AS losses,
        t.\`game_wins\` AS gameWins,
        t.\`points\`    AS points
      FROM \`overall_standings\` AS t
      ORDER BY t.\`rank\` ASC
    `
  );

  return (rows ?? []).map((r) => ({
    rank: Number(r.overall_rank),
    team: String(r.team ?? ""),
    wins: Number(r.wins ?? 0),
    losses: Number(r.losses ?? 0),
    gameWins: Number(r.gameWins ?? 0),
    points: Number(r.points ?? 0),
  }));
}

/**
 * Aggregate weekly_matchups into per-week series:
 * one row per (week_label, awayTeam, homeTeam) with SUM of game wins.
 */
async function fetchWeeklySeriesRows(): Promise<WeeklySeriesRow[]> {
  const [rows] = await pool.query<any[]>(
    `
      SELECT
        week_label       AS weekLabel,
        awayTeam         AS awayTeam,
        homeTeam         AS homeTeam,
        SUM(awayW)       AS awayWins,
        SUM(homeW)       AS homeWins
      FROM weekly_matchups
      GROUP BY week_label, awayTeam, homeTeam
      ORDER BY week_label ASC
    `
  );

  return (rows ?? []).map((r) => ({
    weekLabel: String(r.weekLabel ?? ""),
    awayTeam: String(r.awayTeam ?? "").trim(),
    homeTeam: String(r.homeTeam ?? "").trim(),
    awayWins: Number(r.awayWins ?? 0),
    homeWins: Number(r.homeWins ?? 0),
  }));
}

/**
 * Build per-team week-by-week series results.
 * Only counts a series if one side has 4+ wins and more than the other.
 */
function buildTeamResults(seriesRows: WeeklySeriesRow[]): TeamResultsMap {
  const map: TeamResultsMap = {};

  for (const row of seriesRows) {
    const weekNum = parseWeekNum(row.weekLabel);
    if (!weekNum) continue;

    const { awayTeam, homeTeam, awayWins, homeWins } = row;
    if (!awayTeam && !homeTeam) continue;

    // no games played
    if (awayWins === 0 && homeWins === 0) continue;

    // ignore ties or incomplete series (<4 wins on both sides)
    if (awayWins === homeWins) continue;
    if (awayWins < 4 && homeWins < 4) continue;

    let winner: string | null = null;
    let loser: string | null = null;

    if (awayWins > homeWins) {
      winner = awayTeam;
      loser = homeTeam;
    } else if (homeWins > awayWins) {
      winner = homeTeam;
      loser = awayTeam;
    }

    if (!winner || !loser) continue;

    if (!map[winner]) map[winner] = [];
    if (!map[loser]) map[loser] = [];

    map[winner].push({ weekNum, result: "win" });
    map[loser].push({ weekNum, result: "loss" });
  }

  // sort each team's results by week ascending
  for (const team of Object.keys(map)) {
    map[team].sort((a, b) => a.weekNum - b.weekNum);
  }

  return map;
}

/**
 * Compute current streak for a team using the aggregated results.
 */
function getStreakForTeamFromResults(
  teamName: string,
  teamResults: TeamResultsMap
): { dir: "up" | "down" | null; count: number } {
  const results = teamResults[teamName];
  if (!results || results.length === 0) {
    return { dir: null, count: 0 };
  }

  let last: SeriesResult | null = null;
  let count = 0;

  for (let i = results.length - 1; i >= 0; i--) {
    const res = results[i].result;
    if (!last) {
      last = res;
      count = 1;
    } else if (res === last) {
      count++;
    } else {
      break;
    }
  }

  if (!last) return { dir: null, count: 0 };
  return { dir: last === "win" ? "up" : "down", count };
}

/* ---------------------------------------------
   Playoff math (clinch / elimination)
--------------------------------------------- */

async function computeRemainingSeriesPerTeam(
  teamResults: TeamResultsMap
): Promise<Record<string, number>> {
  const schedule = await fetchTeamScheduleAllCached();
  const scheduled: Record<string, number> = {};

  // scheduled series per team, capped to MAX_WEEKS_FOR_PLAYOFF_MATH
  for (const row of schedule) {
    const weekNum = parseWeekNum(row.week);
    if (!weekNum || weekNum > MAX_WEEKS_FOR_PLAYOFF_MATH) continue;

    const away = row.away;
    const home = row.home;
    if (away) scheduled[away] = (scheduled[away] ?? 0) + 1;
    if (home) scheduled[home] = (scheduled[home] ?? 0) + 1;
  }

  // completed series per team (length of results array)
  const completed: Record<string, number> = {};
  for (const [team, results] of Object.entries(teamResults)) {
    completed[team] = results.length;
  }

  const remaining: Record<string, number> = {};
  for (const [team, totalScheduled] of Object.entries(scheduled)) {
    const done = completed[team] ?? 0;
    const rem = totalScheduled - done;
    remaining[team] = rem > 0 ? rem : 0;
  }

  return remaining;
}

function canTeamStillMakeTop16(
  team: TeamPlayoffWindow,
  all: TeamPlayoffWindow[]
): boolean {
  // Best case for THIS team, worst case for everyone else
  const snapshot = all.map((t) => {
    const isTarget = t.team === team.team;

    const wins = isTarget ? t.maxWins : t.minWins;
    const gw = isTarget ? t.maxGW : t.minGW;

    return { team: t.team, wins, gw };
  });

  snapshot.sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    return b.gw - a.gw;
  });

  const rank = snapshot.findIndex((s) => s.team === team.team) + 1;
  return rank <= 16; // can still finish 16th or better
}

function hasTeamClinchedTop16(
  team: TeamPlayoffWindow,
  all: TeamPlayoffWindow[]
): boolean {
  // Worst case for THIS team, best case for everyone else
  const snapshot = all.map((t) => {
    const isTarget = t.team === team.team;

    const wins = isTarget ? t.minWins : t.maxWins;
    const gw = isTarget ? t.minGW : t.maxGW;

    return { team: t.team, wins, gw };
  });

  snapshot.sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    return b.gw - a.gw;
  });

  const rank = snapshot.findIndex((s) => s.team === team.team) + 1;
  return rank <= 16; // even in worst case, still 16th or better
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
  const upCls = "bg-emerald-500/10 border-emerald-400/60 text-emerald-300";
  const downCls = "bg-red-500/10 border-red-400/60 text-red-300";

  const cls = dir === "up" ? upCls : downCls;
  const arrow = dir === "up" ? "↑" : "↓";

  return (
    <span className={`${base} ${cls}`}>
      <span>{arrow}</span>
      <span>{count}</span>
    </span>
  );
}

/* ---------------------------------------------
   Main component
--------------------------------------------- */

export default async function StandingsPanel() {
  let data: OverallRow[] = [];
  let errorMsg: string | null = null;

  // 1) Standings from MySQL
  try {
    data = await fetchOverallStandingsFromDb();
  } catch (e) {
    console.error("❌ fetchOverallStandingsFromDb ERROR:", e);
    errorMsg = "Database unavailable. Please try again.";
  }

  if (errorMsg) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-sm text-amber-300 text-center">
        {errorMsg}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-sm text-zinc-400 text-center">
        No data.
      </div>
    );
  }

  // 2) Build team results from weekly_matchups
  let teamResults: TeamResultsMap = {};
  try {
    const seriesRows = await fetchWeeklySeriesRows();
    teamResults = buildTeamResults(seriesRows);
  } catch (e) {
    console.error("❌ fetchWeeklySeriesRows / buildTeamResults ERROR:", e);
    teamResults = {};
  }

  // 3) Playoff flags
  let playoffFlags: Record<string, { clinched: boolean; eliminated: boolean }> =
    {};

  try {
    const remainingSeriesPerTeam = await computeRemainingSeriesPerTeam(
      teamResults
    );

    const teams: TeamPlayoffWindow[] = data.map((row) => {
      const wins = toInt(row.wins);
      const gameWins = toInt(row.gameWins);
      const remaining = remainingSeriesPerTeam[row.team] ?? 0;

      const minWins = wins;
      const maxWins = wins + remaining;

      const minGW = gameWins;
      const maxGW = gameWins + remaining * 7;

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
      const clinched = hasTeamClinchedTop16(t, teams);
      const canStillMake = canTeamStillMakeTop16(t, teams);
      const eliminated = !clinched && !canStillMake;

      playoffFlags[t.team] = { clinched, eliminated };
    }
  } catch (e) {
    console.error("❌ playoff math ERROR:", e);
    playoffFlags = {};
  }

  // 4) Render
  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800">
      <h2 className="text-2xl font-bold tracking-wide text-center mb-4">
        <span className="text-pink-400">OVERALL</span>{" "}
        <span className="text-cyan-400">STANDINGS</span>
      </h2>

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
              const logoSrc = `/logos/${slug}.webp`;
              const href = `/?tab=team&team=${encodeURIComponent(slug)}`;

              const { dir, count } = getStreakForTeamFromResults(
                row.team,
                teamResults
              );

              const flags =
                playoffFlags[row.team] ?? { clinched: false, eliminated: false };

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
