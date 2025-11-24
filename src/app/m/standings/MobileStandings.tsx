// src/app/m/standings/MobileStandings.tsx
// Server component (no 'use client')
import Link from "next/link";
import Image from "next/image";
import { teamSlug } from "@/lib/slug";
import { getSheets, fetchMatchupsDataCached } from "@/lib/googleSheets";

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
  const src = slug ? `/logos/${slug}.png` : `/logos/default.png`; // absolute path
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
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border";
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

export default async function MobileStandings() {
  const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
  const sheets = await getSheets();

  // --- Overall standings (same as before) ---
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

  // --- Series streaks from WEEK tabs (same logic as desktop) ---
  let weekResults: Map<string, SeriesResult>[] | null = null;

  try {
    const { weekTab: activeWeek } = await fetchMatchupsDataCached();
    const activeNum = parseWeekNum(activeWeek);

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
  }

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 text-center text-neutral-300">
        No standings data found.
      </div>
    );
  }

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
        <h2 className="mb-3 text-xl font-extrabold tracking-wide bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
          Standings
        </h2>

        <ul className="space-y-2">
          {data.map((t, i) => {
            const slug = teamSlug(t.team);
            const href = slug ? `/m/team/${encodeURIComponent(slug)}` : undefined;
            const { dir, count } = getStreakForTeam(t.team, weekResults);

            const content = (
              <>
                {/* Top row: rank + team + streak pill */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-right text-sm font-semibold text-neutral-400">
                      {t.rank || i + 1}
                    </span>
                    <Logo name={t.team} size={24} />
                    <span className="truncate text-sm font-medium text-neutral-200">
                      {t.team}
                    </span>
                  </div>
                  <StreakPill dir={dir} count={count} />
                </div>

                {/* Bottom row: stats — never wraps horizontally */}
                <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-neutral-300">
                  <div className="rounded-lg bg-neutral-900/60 px-2 py-1 text-center">
                    <div className="uppercase text-[10px] tracking-wide text-neutral-400">
                      W
                    </div>
                    <div className="font-semibold tabular-nums">{t.wins}</div>
                  </div>
                  <div className="rounded-lg bg-neutral-900/60 px-2 py-1 text-center">
                    <div className="uppercase text-[10px] tracking-wide text-neutral-400">
                      L
                    </div>
                    <div className="font-semibold tabular-nums">{t.losses}</div>
                  </div>
                  <div className="rounded-lg bg-neutral-900/60 px-2 py-1 text-center">
                    <div className="uppercase text-[10px] tracking-wide text-neutral-400">
                      GW
                    </div>
                    <div className="font-semibold tabular-nums">
                      {t.gameWins}
                    </div>
                  </div>
                  <div className="rounded-lg bg-neutral-900/60 px-2 py-1 text-center">
                    <div className="uppercase text-[10px] tracking-wide text-neutral-400">
                      Pts
                    </div>
                    <div className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 tabular-nums">
                      {t.points}
                    </div>
                  </div>
                </div>
              </>
            );

            return (
              <li
                key={`${t.rank}-${t.team}`}
                className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-2.5"
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

        {/* Link to Playoff Bracket */}
        <div className="mt-4 flex justify-center">
          <Link
            href="/m/playoffs"
            prefetch={false}
            className="inline-block rounded-xl border border-cyan-500/40 bg-neutral-950/80 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400 transition"
          >
            🏆 View Playoff Bracket
          </Link>
        </div>
      </div>
    </section>
  );
}
