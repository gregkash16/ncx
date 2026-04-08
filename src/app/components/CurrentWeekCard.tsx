// src/app/components/CurrentWeekCard.tsx
// Server Component: no 'use client'

import type React from "react";
import Link from "next/link";
import { teamSlug } from "@/lib/slug";
import { fetchMatchupsDataCached, type MatchRow } from "@/lib/googleSheets";
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
  const TOTAL = 7;
  const CLINCH = 4; // box index (1-based) that wins the series
  const count = Math.max(0, Math.min(TOTAL, wins));

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: TOTAL }).map((_, i) => {
        // For "left" direction, boxes fill left-to-right (index 0 = first win)
        // For "right" direction, boxes fill right-to-left (index 6 = first win)
        const filled =
          direction === "left" ? i < count : i >= TOTAL - count;

        // Box 4 is the clincher — 0-based index 3 for "left", index 3 for "right"
        // For left: clincher is at position CLINCH-1 (index 3)
        // For right: clincher is at position TOTAL-CLINCH (index 3)
        const isClincher =
          direction === "left" ? i === CLINCH - 1 : i === TOTAL - CLINCH;

        return (
          <span
            key={i}
            className="inline-block size-4 rounded-[3px] border transition-all duration-200"
            style={
              filled
                ? {
                    backgroundColor: color,
                    borderColor: isClincher ? "#d4af37" : color,
                    boxShadow: isClincher
                      ? `0 0 8px ${color}99, 0 0 0 2px #d4af3788`
                      : `0 0 6px ${color}66`,
                  }
                : {
                    backgroundColor: "var(--ncx-bg-panel)",
                    borderColor: isClincher ? "#d4af37" : "var(--ncx-border)",
                    boxShadow: isClincher
                      ? "0 0 6px #d4af3766, 0 0 0 1px #d4af3744"
                      : undefined,
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

    if (
      Number.isFinite(awayPts) &&
      Number.isFinite(homePts) &&
      awayPts !== homePts
    ) {
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
  mobile,
}: {
  activeWeek: string;
  selectedWeek?: string | null;
  mobile?: boolean;
}) {
  let weekLabelForCard: string;
  let matches: MatchRow[] = [];

  if (selectedWeek && selectedWeek.trim()) {
    const { weekTab, matches: fetched } =
      await fetchMatchupsDataCached(selectedWeek);
    weekLabelForCard = weekTab;
    matches = fetched ?? [];
  } else {
    const { weekTab, matches: fetched } = await fetchMatchupsDataCached();
    weekLabelForCard = weekTab;
    matches = fetched ?? [];
  }

  const targetTab = normalizeWeekTab(weekLabelForCard);
  const activeWeekNorm = normalizeWeekTab(activeWeek);
  const series = buildSeriesFromMatches(matches);

  return (
    <div
      className="p-6 rounded-2xl border"
      style={{
        background: "var(--ncx-bg-panel)",
        borderColor: "var(--ncx-border)",
      }}
    >
      <h2
        className="text-2xl font-extrabold text-center mb-4"
        style={{ color: "var(--ncx-text-primary)" }}
      >
        {targetTab === activeWeekNorm ? "Current Week" : "Week View"} —{" "}
        {targetTab}
      </h2>

      <ul className="space-y-3">
        {series.map((m, i) => {
          const gamesPlayed = m.awayWins + m.homeWins;
          const gamesLeft = Math.max(0, 7 - gamesPlayed);

          const href = mobile
            ? `/m/matchups?w=${encodeURIComponent(targetTab)}&q=${encodeURIComponent(m.homeTeam)}`
            : `/?tab=matchups&w=${encodeURIComponent(targetTab)}&q=${encodeURIComponent(m.homeTeam)}`;

          return (
            <li key={i}>
              <Link
                href={href}
                className="block rounded-xl focus:outline-none"
                style={{
                  outlineColor: "rgb(var(--ncx-primary) / 0.4)",
                }}
              >
                {/* Mobile: simple row */}
                <div
                  className="flex md:hidden items-center justify-between rounded-xl px-4 py-3"
                  style={{
                    background: "rgb(0 0 0 / 0.25)",
                    border: "1px solid var(--ncx-border)",
                  }}
                >
                  <div
                    className="flex items-center gap-2"
                    style={{ color: "var(--ncx-text-muted)" }}
                  >
                    <Logo name={m.awayTeam} side="left" size={24} />
                    <span className="text-sm">{m.awayTeam}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div
                      className="font-bold text-xl tabular-nums"
                      style={{ color: "var(--ncx-text-primary)" }}
                    >
                      {m.awayWins} : {m.homeWins}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--ncx-text-muted)" }}
                    >
                      {gamesLeft} game{gamesLeft === 1 ? "" : "s"} left
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    style={{ color: "var(--ncx-text-muted)" }}
                  >
                    <span className="text-sm">{m.homeTeam}</span>
                    <Logo name={m.homeTeam} side="right" size={24} />
                  </div>
                </div>

                {/* Desktop: full grid with win boxes */}
                <div
                  className="hidden md:grid items-center gap-x-4 rounded-xl px-6 py-4 transition-colors"
                  style={{
                    gridTemplateColumns: "1fr auto auto auto 1fr",
                    gridTemplateRows: "auto auto",
                    background: "rgb(0 0 0 / 0.25)",
                    border: "1px solid var(--ncx-border)",
                  }}
                >
                  {/* Away team */}
                  <div
                    className="flex items-center gap-2 col-start-1"
                    style={{ color: "var(--ncx-text-muted)" }}
                  >
                    <Logo name={m.awayTeam} side="left" />
                    <span className="break-words">{m.awayTeam}</span>
                  </div>

                  {/* Away boxes */}
                  <div className="flex justify-end col-start-2">
                    <WinBoxes
                      wins={m.awayWins}
                      direction="left"
                      color={getTeamPrimaryHex(m.awayTeam) ?? "#0f172a"}
                    />
                  </div>

                  {/* Score */}
                  <div
                    className="font-bold text-2xl text-center col-start-3 tabular-nums"
                    style={{ color: "var(--ncx-text-primary)", minWidth: "4rem" }}
                  >
                    {m.awayWins} : {m.homeWins}
                  </div>

                  {/* Home boxes */}
                  <div className="flex justify-start col-start-4">
                    <WinBoxes
                      wins={m.homeWins}
                      direction="right"
                      color={getTeamPrimaryHex(m.homeTeam) ?? "#0f172a"}
                    />
                  </div>

                  {/* Home team */}
                  <div
                    className="flex items-center justify-end gap-2 col-start-5"
                    style={{ color: "var(--ncx-text-muted)" }}
                  >
                    <span className="break-words">{m.homeTeam}</span>
                    <Logo name={m.homeTeam} side="right" />
                  </div>

                  {/* Games remaining — spans full width */}
                  <div
                    className="text-xs text-center col-span-5 mt-1"
                    style={{ color: "var(--ncx-text-muted)" }}
                  >
                    {gamesLeft} game{gamesLeft === 1 ? "" : "s"} remaining
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}