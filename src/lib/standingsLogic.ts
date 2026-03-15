/**
 * Standings logic extracted from MobileStandings.tsx
 * Used by both web and mobile APIs
 */

import { fetchTeamScheduleAllCached } from "./googleSheets";

export type SeriesResult = "win" | "loss";

const MAX_WEEKS_FOR_PLAYOFF_MATH = 10;

export type TeamPlayoffWindow = {
  team: string;
  wins: number;
  gameWins: number;
  remaining: number;
  minWins: number;
  maxWins: number;
  minGW: number;
  maxGW: number;
};

function toInt(val: unknown): number {
  const n = parseInt(String(val ?? "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

export function parseWeekNum(label: string | undefined | null): number | null {
  if (!label) return null;
  const m = label.trim().match(/week\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

export function formatWeekLabel(n: number) {
  return `WEEK ${n}`;
}

/**
 * Given per-week result maps (index 0 = WEEK 1, etc),
 * compute the current series streak for a team by
 * walking backwards from the latest week.
 */
export function getStreakForTeam(
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
    if (!res) continue;

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

export async function computeRemainingSeriesPerTeam(
  weekResults: Map<string, SeriesResult>[] | null,
  activeWeekNum: number | null
): Promise<Record<string, number>> {
  const schedule = await fetchTeamScheduleAllCached();
  const remaining: Record<string, number> = {};

  for (const row of schedule) {
    const away = row.away;
    const home = row.home;

    const weekNum = parseWeekNum(row.week);
    if (!weekNum || weekNum > MAX_WEEKS_FOR_PLAYOFF_MATH) continue;

    if (away) remaining[away] = (remaining[away] ?? 0) + 1;
    if (home) remaining[home] = (remaining[home] ?? 0) + 1;
  }

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

  for (const k of Object.keys(remaining)) {
    if (remaining[k] < 0) remaining[k] = 0;
  }

  return remaining;
}

function canOtherPossiblyThreatenTeam(
  other: TeamPlayoffWindow,
  team: TeamPlayoffWindow
): boolean {
  const teamWorstWins = team.minWins;
  const teamWorstGW = team.minGW;

  const otherBestWins = other.maxWins;
  const otherBestGW = other.maxGW;

  if (otherBestWins > teamWorstWins) return true;
  if (otherBestWins === teamWorstWins && otherBestGW >= teamWorstGW) return true;
  return false;
}

export function isTeamClinched(
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

export function isTeamEliminated(
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

/**
 * Compute playoff clinch/elimination flags for all teams
 */
export async function computePlayoffFlags(
  teams: Array<{ team: string; wins: number; gameWins: number }>,
  weekResults: Map<string, SeriesResult>[] | null,
  activeWeekNum: number | null
): Promise<Record<string, { clinched: boolean; eliminated: boolean }>> {
  if (teams.length === 0 || !weekResults || !activeWeekNum) {
    return {};
  }

  const remainingSeriesPerTeam = await computeRemainingSeriesPerTeam(
    weekResults,
    activeWeekNum
  );

  const teamWindows: TeamPlayoffWindow[] = teams.map((t) => {
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

  const flags: Record<string, { clinched: boolean; eliminated: boolean }> = {};
  for (const t of teamWindows) {
    const clinched = isTeamClinched(t, teamWindows);
    const eliminated = !clinched && isTeamEliminated(t, teamWindows);
    flags[t.team] = { clinched, eliminated };
  }

  return flags;
}
