// src/app/m/standings/MobileStandings.tsx
// Server component (no 'use client')
import Link from "next/link";
import Image from "next/image";
import { teamSlug } from "@/lib/slug";
import {
  getSheets,
  fetchMatchupsDataCached,
  fetchTeamScheduleAllCached,
} from "@/lib/googleSheets";

console.log("[SSR] MobileStandings render", new Date().toISOString());

type Row = {
  rank: string;
  team: string;
  wins: string;
  losses: string;
  gameWins: string;
  points: string;
};

type SeriesResult = "win" | "loss";

function Logo({
  name,
  size = 24,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const slug = teamSlug(name);
  const src = slug ? `/logos/${slug}.webp` : `/logos/default.png`; // absolute path
  return (
    <Image
      src={src}
      alt={name || "Team"}
      width={size}
      height={size}
      className={["inline-block object-contain shrink-0", className || ""].join(" ")}
      unoptimized
      loading="lazy"
      decoding="async"
    />
  );
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
  sheets: any,
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

    if (awayWins === homeWins) continue;

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

function StreakPill({
  dir,
  count,
}: {
  dir: "up" | "down" | null;
  count: number;
}) {
  if (!dir || count <= 0) return null;

  const base =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border";

  const upCls =
    "bg-[rgb(var(--ncx-success-rgb)/0.12)] border-[rgb(var(--ncx-success-rgb)/0.45)] text-[rgb(var(--ncx-success-rgb))]";
  const downCls =
    "bg-[rgb(var(--ncx-danger-rgb)/0.12)] border-[rgb(var(--ncx-danger-rgb)/0.45)] text-[rgb(var(--ncx-danger-rgb))]";

  const cls = dir === "up" ? upCls : downCls;
  const arrow = dir === "up" ? "↑" : "↓";

  return (
    <span className={`${base} ${cls}`}>
      <span>{arrow}</span>
      <span>{count}</span>
    </span>
  );
}

/** -------------------- Playoff math helpers (same as desktop) -------------------- **/

const MAX_WEEKS_FOR_PLAYOFF_MATH = 10;

type TeamPlayoffWindow = {
  team: string;
  wins: number;
  gameWins: number;

  remaining: number;
  minWins: number;
  maxWins: number;
  minGW: number;
  maxGW: number;
};

async function computeRemainingSeriesPerTeam(
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

function isTeamClinched(team: TeamPlayoffWindow, all: TeamPlayoffWindow[]): boolean {
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

function isTeamEliminated(team: TeamPlayoffWindow, all: TeamPlayoffWindow[]): boolean {
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

/** --------------------------- Component --------------------------- **/

export default async function MobileStandings() {
  const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
  const sheets = getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "OVERALL RECORD!A2:F25",
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = (res.data.values || []).filter(
    (r) =>
      (r?.[0] ?? "").toString().trim() !== "" &&
      (r?.[1] ?? "").toString().trim() !== ""
  );

  const data: Row[] = rows.map((r) => ({
    rank: String(r[0] ?? ""),
    team: String(r[1] ?? ""),
    wins: String(r[2] ?? ""),
    losses: String(r[3] ?? ""),
    gameWins: String(r[4] ?? ""),
    points: String(r[5] ?? ""),
  }));

  let weekResults: Map<string, SeriesResult>[] | null = null;
  let activeNum: number | null = null;

  try {
    const { weekTab: activeWeek } = await fetchMatchupsDataCached();
    activeNum = parseWeekNum(activeWeek);

    if (activeNum && activeNum > 0) {
      const tmp: Map<string, SeriesResult>[] = [];

      for (let n = 1; n <= activeNum; n++) {
        const wkLabel = formatWeekLabel(n);
        try {
          const map = await loadWeekSeriesResults(sheets, spreadsheetId, wkLabel);
          tmp.push(map);
        } catch {
          tmp.push(new Map());
        }
      }

      weekResults = tmp;
    }
  } catch {
    weekResults = null;
    activeNum = null;
  }

  let playoffFlags: Record<string, { clinched: boolean; eliminated: boolean }> = {};

  try {
    if (data.length > 0 && weekResults && activeNum) {
      const remainingSeriesPerTeam = await computeRemainingSeriesPerTeam(
        weekResults,
        activeNum
      );

      const teams: TeamPlayoffWindow[] = data.map((t) => {
        const wins = toInt(t.wins);
        const gameWins = toInt(t.gameWins);
        const remaining = remainingSeriesPerTeam[t.team] ?? 0;

        const minWins = wins;
        const maxWins = wins + remaining;

        const minGW = gameWins;
        const maxGW = gameWins + remaining * 4;

        return {
          team: t.team,
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
    playoffFlags = {};
  }

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-[var(--ncx-border)] bg-[var(--ncx-panel-bg)] p-4 text-center text-[var(--ncx-text-muted)]">
        No standings data found.
      </div>
    );
  }

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-[var(--ncx-border)] bg-[var(--ncx-panel-bg)] p-3 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
        <h2 className="mb-3 text-xl font-extrabold tracking-wide ncx-hero-title">
          Standings
        </h2>

        <ul className="space-y-2">
          {data.map((t, i) => {
            const slug = teamSlug(t.team);
            const href = slug ? `/m/team/${encodeURIComponent(slug)}` : undefined;
            const { dir, count } = getStreakForTeam(t.team, weekResults);

            const flags = playoffFlags[t.team] ?? { clinched: false, eliminated: false };

            const content = (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-right text-sm font-semibold text-[var(--ncx-text-muted)]">
                      {t.rank || i + 1}
                    </span>
                    <Logo name={t.team} size={24} />
                    <span className="truncate text-sm font-medium text-[var(--ncx-text-primary)]/90">
                      {t.team}
                      {flags.clinched && (
                        <span className="ml-1 text-[10px] font-semibold text-[rgb(var(--ncx-success-rgb)/0.75)]">
                          - ✓
                        </span>
                      )}
                      {!flags.clinched && flags.eliminated && (
                        <span className="ml-1 text-[10px] font-semibold text-[rgb(var(--ncx-danger-rgb)/0.75)]">
                          - x
                        </span>
                      )}
                    </span>
                  </div>
                  <StreakPill dir={dir} count={count} />
                </div>

                <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-[var(--ncx-text-primary)]/85">
                  <div className="rounded-lg bg-[rgb(0_0_0/0.28)] border border-[var(--ncx-border)] px-2 py-1 text-center">
                    <div className="uppercase text-[10px] tracking-wide text-[var(--ncx-text-muted)]">
                      W
                    </div>
                    <div className="font-semibold tabular-nums">{t.wins}</div>
                  </div>
                  <div className="rounded-lg bg-[rgb(0_0_0/0.28)] border border-[var(--ncx-border)] px-2 py-1 text-center">
                    <div className="uppercase text-[10px] tracking-wide text-[var(--ncx-text-muted)]">
                      L
                    </div>
                    <div className="font-semibold tabular-nums">{t.losses}</div>
                  </div>
                  <div className="rounded-lg bg-[rgb(0_0_0/0.28)] border border-[var(--ncx-border)] px-2 py-1 text-center">
                    <div className="uppercase text-[10px] tracking-wide text-[var(--ncx-text-muted)]">
                      GW
                    </div>
                    <div className="font-semibold tabular-nums">{t.gameWins}</div>
                  </div>
                  <div className="rounded-lg bg-[rgb(0_0_0/0.28)] border border-[var(--ncx-border)] px-2 py-1 text-center">
                    <div className="uppercase text-[10px] tracking-wide text-[var(--ncx-text-muted)]">
                      Pts
                    </div>
                    <div className="font-bold tabular-nums text-[rgb(var(--ncx-secondary-rgb))]">
                      {t.points}
                    </div>
                  </div>
                </div>
              </>
            );

            return (
              <li
                key={`${t.rank}-${t.team}`}
                className="rounded-2xl border border-[var(--ncx-border)] bg-[rgb(0_0_0/0.35)] p-2.5 hover:border-[rgb(var(--ncx-primary-rgb)/0.35)]"
              >
                {href ? (
                  <Link href={href} className="block" prefetch={false}>
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>

        {/*  
        <div className="mt-4 flex justify-center">
          <Link
            href="/m/playoffs"
            prefetch={false}
            className="inline-block rounded-xl border border-[rgb(var(--ncx-primary-rgb)/0.45)] bg-[rgb(0_0_0/0.35)] px-4 py-2 text-sm font-semibold text-[rgb(var(--ncx-primary-rgb))] hover:bg-[rgb(var(--ncx-primary-rgb)/0.12)] hover:border-[rgb(var(--ncx-primary-rgb)/0.60)] transition"
          >
            🏆 View Playoff Bracket
          </Link>
        </div>
      */}
      </div>
    </section>
  );
}
