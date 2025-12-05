// src/app/components/CurrentWeekCard.tsx
// Server Component: no 'use client'
import type React from "react";
import Link from "next/link";
import { teamSlug } from "@/lib/slug";
import {
  fetchMatchupsDataCached,
  type MatchRow,
} from "@/lib/googleSheets";

type SeriesRow = {
  awayTeam: string;
  awayWins: number;
  homeTeam: string;
  homeWins: number;
};

function toInt(val: unknown): number {
  const n = parseInt(String(val ?? "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function WinBoxes({
  wins,
  direction = "right",
}: {
  wins: number;
  direction?: "left" | "right";
}) {
  const count = Math.max(0, Math.min(4, wins)); // clamp between 0–4
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 4 }).map((_, i) => {
        const filled = direction === "left" ? i < count : i >= 4 - count;
        return (
          <span
            key={i}
            className={[
              "inline-block size-3.5 rounded-[3px] border transition-colors duration-200",
              filled
                ? "bg-green-500/90 border-green-500/80 shadow-[0_0_6px_rgba(34,197,94,0.35)]"
                : "bg-zinc-800 border-zinc-700",
            ].join(" ")}
          />
        );
      })}
    </div>
  );
}

function Logo({
  name,
  side,
  size = 28,
  className = "",
}: {
  name: string;
  side: "left" | "right";
  size?: number;
  className?: string;
}) {
  const src = `/logos/${teamSlug(name)}.webp`;
  return (
    <img
      src={src}
      alt={name || "Team"}
      width={size}
      height={size}
      className={[
        "inline-block shrink-0 object-contain",
        side === "left" ? "mr-2" : "ml-2",
        className,
      ].join(" ")}
      decoding="async"
      loading="lazy"
    />
  );
}

function parseWeekNum(label: string | undefined): number | null {
  if (!label) return null;
  const m = label.trim().match(/week\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}
function formatWeekLabel(n: number) {
  return `WEEK ${n}`;
}
function normalizeWeekTab(label?: string | null) {
  const n = parseWeekNum(label ?? undefined);
  if (n) return `WEEK ${n}`;
  return String(label ?? "").trim().toUpperCase() || "WEEK 1";
}

/**
 * Build series rows from weekly_matchups in MySQL.
 * We treat each 7-game block (seriesNo) between a pair of teams as a series.
 * Wins are derived from game points.
 */
function buildSeriesFromMatches(matches: MatchRow[]): SeriesRow[] {
  type SeriesAgg = {
    teamA: string;
    teamB: string;
    winsA: number;
    winsB: number;
  };

  const map = new Map<string, SeriesAgg>();

  for (const m of matches) {
    const rawAway = (m.awayTeam ?? "").trim();
    const rawHome = (m.homeTeam ?? "").trim();
    if (!rawAway || !rawHome) continue;

    // Determine series number (already computed in MatchRow, but fall back if missing)
    const gameNum = toInt(m.game);
    const seriesNo =
      typeof m.seriesNo === "number" && m.seriesNo > 0
        ? m.seriesNo
        : gameNum > 0
        ? Math.ceil(gameNum / 7)
        : 0;
    if (!seriesNo) continue;

    // Sort teams to get a stable "left/right" order
    const [teamA, teamB] =
      rawAway.localeCompare(rawHome) <= 0
        ? [rawAway, rawHome]
        : [rawHome, rawAway];

    const key = `${seriesNo}|${teamA}|${teamB}`;

    let agg = map.get(key);
    if (!agg) {
      agg = { teamA, teamB, winsA: 0, winsB: 0 };
      map.set(key, agg);
    }

    // Try to award a win if scores are filled
    const awayPts = Number(String(m.awayPts ?? "").trim() || "NaN");
    const homePts = Number(String(m.homePts ?? "").trim() || "NaN");
    const awayValid = Number.isFinite(awayPts);
    const homeValid = Number.isFinite(homePts);

    if (awayValid && homeValid && awayPts !== homePts) {
      const winnerName = awayPts > homePts ? rawAway : rawHome;
      if (winnerName === agg.teamA) agg.winsA += 1;
      else if (winnerName === agg.teamB) agg.winsB += 1;
    }
  }

  const series: SeriesRow[] = [];
  for (const agg of map.values()) {
    series.push({
      awayTeam: agg.teamA,
      awayWins: agg.winsA,
      homeTeam: agg.teamB,
      homeWins: agg.winsB,
    });
  }

  return series;
}

export default async function CurrentWeekCard({
  activeWeek,
  selectedWeek,
}: {
  activeWeek: string;
  selectedWeek?: string | null;
}) {
  // 🔹 Match the logic from page.tsx exactly:
  // - If selectedWeek is valid, fetch that week.
  // - Otherwise, fetch the active week.
  let weekLabelForCard: string;
  let matches: MatchRow[] = [];

  try {
    if (selectedWeek && selectedWeek.trim()) {
      const { weekTab, matches: fetched } = await fetchMatchupsDataCached(
        selectedWeek
      );
      weekLabelForCard = weekTab;
      matches = fetched ?? [];
    } else {
      const { weekTab, matches: fetched } = await fetchMatchupsDataCached();
      weekLabelForCard = weekTab;
      matches = fetched ?? [];
    }
  } catch (err: any) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-red-800/60">
        <h2 className="text-xl font-semibold text-red-400">
          Couldn’t load current week
        </h2>
        <p className="mt-2 text-zinc-400">
          {process.env.NODE_ENV !== "production" && (
            <>
              <span className="block">
                {String(err?.message ?? "MySQL / matchups load error")}
              </span>
            </>
          )}
        </p>
      </div>
    );
  }

  const targetTab = normalizeWeekTab(weekLabelForCard);
  const activeWeekNorm = normalizeWeekTab(activeWeek);

  const activeNum = parseWeekNum(activeWeek);
  const pastWeeks =
    activeNum && activeNum > 0
      ? Array.from({ length: activeNum }, (_, i) => formatWeekLabel(i + 1))
      : [];

  // Build series rows (aggregate per 7-game block & team pair)
  const series = buildSeriesFromMatches(matches);

  const items = series.map((s) => {
    const seriesOver = s.awayWins >= 4 || s.homeWins >= 4;
    const awayWinner = seriesOver && s.awayWins >= 4 && s.awayWins > s.homeWins;
    const homeWinner = seriesOver && s.homeWins >= 4 && s.homeWins > s.awayWins;
    return { ...s, seriesOver, awayWinner, homeWinner };
  });

  const GREEN = "34,197,94";
  const RED = "239,68,68";

  const btnBase =
    "group relative overflow-hidden rounded-xl border bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-pink-500/50";
  const gradient =
    "pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100";

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-purple-500/40 transition w-full">
      <h2 className="text-2xl font-extrabold text-center uppercase bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 text-transparent bg-clip-text drop-shadow-[0_0_20px_rgba(255,0,255,0.25)] mb-4 tracking-wide">
        {targetTab === activeWeekNorm ? "Current Week" : "Week View"} —{" "}
        {targetTab}
      </h2>

      {/* Week selector strip */}
      {activeNum && activeNum > 1 && (
        <div className="flex flex-wrap justify-center gap-2 mb-5">
          {pastWeeks.map((wk) => {
            const selected = wk.toUpperCase() === targetTab.toUpperCase();
            const isActive =
              wk.toUpperCase() === activeWeekNorm.toUpperCase();

            // 🔗 Always stay on Current Week tab when switching weeks
            const href =
              wk === activeWeek
                ? "/?tab=current"
                : `/?tab=current&w=${encodeURIComponent(wk)}`;

            return (
              <Link
                key={wk}
                href={href}
                scroll={false}
                className={[
                  btnBase,
                  isActive
                    ? "border-yellow-400/70"
                    : selected
                    ? "border-cyan-400/60"
                    : "border-purple-500/40",
                ].join(" ")}
              >
                <span
                  className={[
                    gradient,
                    isActive
                      ? "bg-gradient-to-r from-yellow-400/20 via-amber-400/20 to-yellow-300/20"
                      : "bg-gradient-to-r from-pink-600/20 via-purple-500/20 to-cyan-500/20",
                    selected ? "opacity-100" : "",
                  ].join(" ")}
                />
                <span className="relative z-10">{wk}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Matchup grid */}
      {items.length === 0 ? (
        <p className="mt-2 text-zinc-400">No matchups found.</p>
      ) : (
        <ul className="mt-3 space-y-3 text-base">
          {items.map((m, i) => {
            const leftColor = m.awayWinner ? RED : m.homeWinner ? GREEN : "0,0,0";
            const rightColor = m.homeWinner ? RED : m.awayWinner ? GREEN : "0,0,0";

            const gradientStyle: React.CSSProperties = m.seriesOver
              ? {
                  backgroundImage: `
                    linear-gradient(to left, rgba(${leftColor},0.35), rgba(0,0,0,0) 35%),
                    linear-gradient(to right, rgba(${rightColor},0.35), rgba(0,0,0,0) 35%)
                  `,
                }
              : {};

            const q = `${m.awayTeam} ${m.homeTeam}`;
            const href = `/?tab=matchups&w=${encodeURIComponent(
              targetTab
            )}&q=${encodeURIComponent(q)}`;

            return (
              <li key={i} className="list-none">
                <Link
                  href={href}
                  scroll={false}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border border-zinc-800 rounded-xl px-5 py-3 bg-zinc-950/60 relative overflow-hidden hover:border-purple-500/50 hover:bg-zinc-900/40 cursor-pointer"
                  style={gradientStyle}
                >
                  {/* Away (left) */}
                  <div
                    className={[
                      "flex items-center justify-start text-zinc-300",
                      m.awayWinner
                        ? "font-bold uppercase"
                        : m.homeWinner
                        ? "line-through"
                        : "",
                    ].join(" ")}
                  >
                    <Logo name={m.awayTeam} side="left" />
                    <span className="break-words">{m.awayTeam}</span>
                  </div>

                  {/* Center score / win boxes */}
                  <div className="flex items-center justify-center gap-3 z-10">
                    <WinBoxes wins={m.awayWins} direction="left" />
                    <div className="text-center min-w-[5.5rem] font-semibold text-zinc-100">
                      {m.awayWins} : {m.homeWins}
                    </div>
                    <WinBoxes wins={m.homeWins} direction="right" />
                  </div>

                  {/* Home (right) */}
                  <div
                    className={[
                      "flex items-center justify-end text-zinc-300",
                      m.homeWinner
                        ? "font-bold uppercase"
                        : m.awayWinner
                        ? "line-through"
                        : "",
                    ].join(" ")}
                  >
                    <span className="break-words">{m.homeTeam}</span>
                    <Logo name={m.homeTeam} side="right" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
