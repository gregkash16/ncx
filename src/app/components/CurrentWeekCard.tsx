// src/app/components/CurrentWeekCard.tsx
// Server Component: no 'use client'
import type React from "react";
import Link from "next/link";
import { teamSlug } from "@/lib/slug";
import {
  fetchMatchupsDataCached,
  type MatchRow,
} from "@/lib/googleSheets";
import { getTeamPrimaryHex } from "@/theme/teams";

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

/* ───────────────────────── Win Boxes ───────────────────────── */

function WinBoxes({
  wins,
  direction = "right",
  color,
}: {
  wins: number;
  direction?: "left" | "right";
  color: string;
}) {
  const count = Math.max(0, Math.min(4, wins));
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 4 }).map((_, i) => {
        const filled = direction === "left" ? i < count : i >= 4 - count;
        return (
          <span
            key={i}
            className="inline-block size-4 rounded-[3px] border"
            style={
              filled
                ? {
                    backgroundColor: color,
                    borderColor: color,
                    boxShadow: `0 0 6px ${color}66`,
                  }
                : {
                    backgroundColor: "#27272a",
                    borderColor: "#3f3f46",
                  }
            }
          />
        );
      })}
    </div>
  );
}

/* ───────────────────────── Logo ───────────────────────── */

function Logo({
  name,
  side,
  size = 28,
}: {
  name: string;
  side: "left" | "right";
  size?: number;
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
      ].join(" ")}
      decoding="async"
      loading="lazy"
    />
  );
}

/* ───────────────────────── Week helpers ───────────────────────── */

function parseWeekNum(label?: string): number | null {
  if (!label) return null;
  const m = label.trim().match(/week\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}
function normalizeWeekTab(label?: string | null) {
  const n = parseWeekNum(label ?? undefined);
  if (n) return `WEEK ${n}`;
  return String(label ?? "").trim().toUpperCase() || "WEEK 1";
}

/* ───────────────────────── Series builder ───────────────────────── */

function buildSeriesFromMatches(matches: MatchRow[]): SeriesRow[] {
  type SeriesAgg = {
    leftTeam: string;
    rightTeam: string;
    leftWins: number;
    rightWins: number;
  };

  const map = new Map<string, SeriesAgg>();

  for (const m of matches) {
    const away = (m.awayTeam ?? "").trim();
    const home = (m.homeTeam ?? "").trim();
    if (!away || !home) continue;

    const gameNum = toInt(m.game);
    const seriesNo =
      typeof m.seriesNo === "number" && m.seriesNo > 0
        ? m.seriesNo
        : gameNum > 0
        ? Math.ceil(gameNum / 7)
        : 0;
    if (!seriesNo) continue;

    const a = away.localeCompare(home) <= 0 ? away : home;
    const b = away.localeCompare(home) <= 0 ? home : away;
    const key = `${seriesNo}|${a}|${b}`;

    let agg = map.get(key);
    if (!agg) {
      agg = { leftTeam: away, rightTeam: home, leftWins: 0, rightWins: 0 };
      map.set(key, agg);
    }

    const awayPts = Number(String(m.awayPts ?? "").trim() || "NaN");
    const homePts = Number(String(m.homePts ?? "").trim() || "NaN");
    if (Number.isFinite(awayPts) && Number.isFinite(homePts) && awayPts !== homePts) {
      const winner = awayPts > homePts ? away : home;
      if (winner === agg.leftTeam) agg.leftWins += 1;
      else if (winner === agg.rightTeam) agg.rightWins += 1;
    }
  }

  return Array.from(map.values()).map((agg) => ({
    awayTeam: agg.leftTeam,
    awayWins: agg.leftWins,
    homeTeam: agg.rightTeam,
    homeWins: agg.rightWins,
  }));
}

/* ───────────────────────── Component ───────────────────────── */

export default async function CurrentWeekCard({
  activeWeek,
  selectedWeek,
}: {
  activeWeek: string;
  selectedWeek?: string | null;
}) {
  let weekLabelForCard: string;
  let matches: MatchRow[] = [];

  if (selectedWeek && selectedWeek.trim()) {
    const { weekTab, matches: fetched } =
      await fetchMatchupsDataCached(selectedWeek);
    weekLabelForCard = weekTab;
    matches = fetched ?? [];
  } else {
    const { weekTab, matches: fetched } =
      await fetchMatchupsDataCached();
    weekLabelForCard = weekTab;
    matches = fetched ?? [];
  }

  const targetTab = normalizeWeekTab(weekLabelForCard);
  const activeWeekNorm = normalizeWeekTab(activeWeek);

  const series = buildSeriesFromMatches(matches);

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800">
      <h2 className="text-2xl font-extrabold text-center mb-4">
        {targetTab === activeWeekNorm ? "Current Week" : "Week View"} — {targetTab}
      </h2>

      <ul className="space-y-3">
        {series.map((m, i) => {
          const gamesPlayed = m.awayWins + m.homeWins;
          const gamesLeft = Math.max(0, 7 - gamesPlayed);

          return (
            <li key={i}>
              <div className="grid grid-cols-[1fr_260px_1fr] items-center gap-4 border border-zinc-800 rounded-xl px-6 py-4 bg-zinc-950/60">
                {/* Away */}
                <div className="flex items-center text-zinc-300">
                  <Logo name={m.awayTeam} side="left" />
                  <span className="break-words">{m.awayTeam}</span>
                </div>

                {/* Center */}
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-4">
                    <WinBoxes
                      wins={m.awayWins}
                      direction="left"
                      color={getTeamPrimaryHex(m.awayTeam) ?? "#0f172a"}
                    />
                    <div className="font-bold text-xl text-zinc-100">
                      {m.awayWins} : {m.homeWins}
                    </div>
                    <WinBoxes
                      wins={m.homeWins}
                      direction="right"
                      color={getTeamPrimaryHex(m.homeTeam) ?? "#0f172a"}
                    />
                  </div>
                  <div className="text-xs text-zinc-400">
                    {gamesLeft} game{gamesLeft === 1 ? "" : "s"} remaining
                  </div>
                </div>

                {/* Home */}
                <div className="flex items-center justify-end text-zinc-300">
                  <span className="break-words">{m.homeTeam}</span>
                  <Logo name={m.homeTeam} side="right" />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
