"use client";

import { useMemo } from "react";
import PlayerDMLink from "@/app/components/PlayerDMLink";

type Row = {
  game: string;
  awayTeam: string;
  homeTeam: string;
  awayName?: string;
  homeName?: string;
  awayId?: string;
  homeId?: string;
  awayPts?: string | number;
  homePts?: string | number;
  scenario?: string;

  // deep links
  awayDiscordId?: string | null;
  homeDiscordId?: string | null;
  awayDiscordTag?: string | null;
  homeDiscordTag?: string | null;
};
type ScheduleMap = Record<string, { day: string; slot: string }>;

function parseIntSafe(v: any): number {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

export default function MatchCard({
  row,
  scheduleOn,
  scheduleMap,
  onSelect,
}: {
  row: Row;
  scheduleOn: boolean;
  scheduleMap: ScheduleMap;
  onSelect?: (row: Row) => void;
}) {
  const awayScore = parseIntSafe(row.awayPts);
  const homeScore = parseIntSafe(row.homePts);
  const isDone = Boolean(String(row.scenario || "").trim());
  const winner: "away" | "home" | "tie" =
    awayScore > homeScore ? "away" : homeScore > awayScore ? "home" : "tie";

  const sched =
    scheduleOn && scheduleMap?.[row.game]
      ? `${String(scheduleMap[row.game].day || "").toUpperCase()} • ${String(
          scheduleMap[row.game].slot || ""
        ).toUpperCase()}`
      : "";

  const baseRing = isDone
    ? "ring-[rgb(var(--ncx-primary-rgb)/0.22)]"
    : "ring-[rgb(var(--ncx-secondary-rgb)/0.22)]";
  const baseGlow = isDone
    ? "shadow-[0_10px_30px_rgb(var(--ncx-primary-rgb)/0.08)]"
    : "shadow-[0_10px_30px_rgb(var(--ncx-secondary-rgb)/0.08)]";

  const scorePill = useMemo(() => {
    const cls =
      winner === "away"
        ? "bg-[rgb(var(--ncx-secondary-rgb)/0.12)] text-[rgb(var(--ncx-secondary-rgb))] border-[rgb(var(--ncx-secondary-rgb)/0.30)]"
        : winner === "home"
        ? "bg-[rgb(var(--ncx-primary-rgb)/0.12)] text-[rgb(var(--ncx-primary-rgb))] border-[rgb(var(--ncx-primary-rgb)/0.30)]"
        : "bg-[rgb(255_255_255/0.08)] text-[var(--ncx-text-primary)] border-[var(--ncx-border)]";
    return `inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-lg border ${cls}`;
  }, [winner]);

  return (
    <article
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={() => onSelect?.(row)}
      onKeyDown={(e) => {
        if (!onSelect) return;
        if (e.key === "Enter" || e.key === " ") onSelect(row);
      }}
      className={[
        "relative rounded-2xl bg-[var(--ncx-bg-panel)] border border-[var(--ncx-border)]",
        "ring-1",
        baseRing,
        baseGlow,
        "shadow-lg",
        "p-4",
        onSelect ? "cursor-pointer active:scale-[0.99] transition" : "",
      ].join(" ")}
    >
      {/* Header row: GAME + chips */}
      <header className="mb-3 flex items-center justify-between gap-2">
        <span
          className={[
            "inline-flex items-center rounded-md px-2 py-1 text-[11px] font-bold",
            isDone
              ? "bg-[rgb(var(--ncx-primary-rgb)/0.70)] text-white"
              : "bg-[rgb(var(--ncx-secondary-rgb)/0.70)] text-white",
          ].join(" ")}
        >
          GAME {row.game}
        </span>

        <div className="flex items-center gap-2">
          {sched ? (
            <span className="inline-flex items-center rounded-md bg-[rgb(0_0_0/0.28)] border border-[var(--ncx-border)] px-2 py-1 text-[11px] text-[var(--ncx-text-primary)]">
              {sched}
            </span>
          ) : null}
          <span
            className={[
              "inline-flex items-center rounded-md px-2 py-1 text-[11px] border",
              isDone
                ? "bg-[rgb(16_185_129/0.12)] text-[rgb(110_231_183)] border-[rgb(16_185_129/0.30)]"
                : "bg-[rgb(0_0_0/0.18)] text-[var(--ncx-text-muted)] border-[var(--ncx-border)]",
            ].join(" ")}
            title={row.scenario || "No Scenario"}
          >
            {row.scenario || "No Scenario"}
          </span>
        </div>
      </header>

      {/* Teams around score (no logos) */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* Away */}
        <div className="min-w-0 flex items-center gap-2">
          <span
            className={`truncate text-base ${
              winner === "away"
                ? "text-[rgb(var(--ncx-secondary-rgb))] font-semibold"
                : "text-[var(--ncx-text-muted)]"
            }`}
          >
            {row.awayTeam || "TBD"}
          </span>
        </div>

        {/* Score pill */}
        <div className="text-center">
          <span className={scorePill}>
            <span>{awayScore}</span>
            <span className="opacity-60">:</span>
            <span>{homeScore}</span>
          </span>
        </div>

        {/* Home */}
        <div className="min-w-0 flex items-center justify-end gap-2">
          <span
            className={`truncate text-base text-right ${
              winner === "home"
                ? "text-[rgb(var(--ncx-primary-rgb))] font-semibold"
                : "text-[var(--ncx-text-muted)]"
            }`}
          >
            {row.homeTeam || "TBD"}
          </span>
        </div>
      </div>

      {/* Players with Discord deep links */}
      <footer className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px] text-[var(--ncx-text-primary)]">
        <div className="flex items-center gap-2">
          <PlayerDMLink
            name={row.awayName || "—"}
            discordId={row.awayDiscordId}
            titleSuffix={row.awayDiscordTag ? `@${row.awayDiscordTag}` : "Open DM"}
            className="truncate font-medium text-[rgb(var(--ncx-secondary-rgb))]"
          />
          {row.awayId ? (
            <span className="shrink-0 rounded-full bg-[rgb(0_0_0/0.28)] border border-[var(--ncx-border)] px-2 py-0.5 text-[11px] text-[var(--ncx-text-muted)] font-mono">
              {row.awayId}
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2">
          {row.homeId ? (
            <span className="shrink-0 rounded-full bg-[rgb(0_0_0/0.28)] border border-[var(--ncx-border)] px-2 py-0.5 text-[11px] text-[var(--ncx-text-muted)] font-mono">
              {row.homeId}
            </span>
          ) : null}
          <PlayerDMLink
            name={row.homeName || "—"}
            discordId={row.homeDiscordId}
            titleSuffix={row.homeDiscordTag ? `@${row.homeDiscordTag}` : "Open DM"}
            className="truncate font-medium text-[rgb(var(--ncx-primary-rgb))] text-right"
          />
        </div>
      </footer>
    </article>
  );
}
