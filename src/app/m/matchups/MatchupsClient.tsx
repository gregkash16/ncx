// src/app/m/matchups/MatchupsClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { teamSlug } from "@/lib/slug";
import MatchCard from "./MatchCard";

type MatchRow = {
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

  awayDiscordId?: string | null;
  homeDiscordId?: string | null;
  awayDiscordTag?: string | null;
  homeDiscordTag?: string | null;
};

type Payload = {
  rows: MatchRow[];
  weekLabel: string; // shown data label (selected or active)
  activeWeek: string; // true active week for max bound
  scheduleWeek: string;
  scheduleMap: Record<string, { day: string; slot: string }>;
};

function parseWeekNum(label?: string | null): number | null {
  if (!label) return null;
  const m = label.trim().match(/week\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}
function formatWeekLabel(n: number) {
  return `WEEK ${n}`;
}
function gameNum(g: string): number {
  const m = (g || "").match(/^\d+/);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
}

/** Choose ONE team from q by checking against actual team names. */
function pickTeamFilter(q: string, rows: MatchRow[]): string {
  const tokens = (q || "")
    .split(/[+\s]+/g)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!tokens.length) return "";

  const allTeams = Array.from(
    new Set(
      rows
        .flatMap((r) => [r.awayTeam, r.homeTeam])
        .filter(Boolean) as string[]
    )
  );
  const teamBySlug = new Map(allTeams.map((t) => [teamSlug(t), t]));

  for (const tok of tokens) {
    const s = teamSlug(tok);
    const exact = teamBySlug.get(s);
    if (exact) return exact;
  }
  for (const tok of tokens) {
    const s = teamSlug(tok);
    const found = allTeams.find((t) => {
      const ts = teamSlug(t);
      return ts.includes(s) || s.includes(ts);
    });
    if (found) return found;
  }
  return tokens[0];
}

export default function MatchupsClient({ payload }: { payload: Payload }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const {
    rows: baseRows = [],
    weekLabel = "",
    activeWeek = "",
    scheduleWeek = "",
    scheduleMap = {},
  } = payload ?? ({} as Payload);

  // Initialize from URL (?q may be "AWAY HOME" from Current)
  const qFromUrlRaw = (sp.get("q") ?? "").trim();
  const qFromUrlTeam = useMemo(
    () => pickTeamFilter(qFromUrlRaw, baseRows),
    [qFromUrlRaw, baseRows]
  );
  const wFromUrl = (sp.get("w") ?? "").trim();

  const [query, setQuery] = useState(qFromUrlTeam);
  const [onlyCompleted, setOnlyCompleted] = useState(false);
  const [onlyScheduled, setOnlyScheduled] = useState(false);

  useEffect(() => {
    setQuery(qFromUrlTeam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qFromUrlTeam]);

  const activeNum = useMemo(() => parseWeekNum(activeWeek), [activeWeek]);
  const selectedNum = useMemo(
    () => parseWeekNum(wFromUrl || weekLabel),
    [wFromUrl, weekLabel]
  );

  const isCurrentSelected = useMemo(() => {
    if (!activeNum) return true;
    return !selectedNum || selectedNum === activeNum;
  }, [activeNum, selectedNum]);

  const weekPills = useMemo(() => {
    if (!activeNum || activeNum <= 0) return [activeWeek].filter(Boolean);
    return Array.from({ length: activeNum }, (_, i) => formatWeekLabel(i + 1));
  }, [activeNum, activeWeek]);

  const scheduleOn =
    Boolean(weekLabel) &&
    Boolean(scheduleWeek) &&
    weekLabel.trim() === scheduleWeek.trim();

  const rows = useMemo(() => {
    const q = (query || "").toLowerCase().trim();
    let arr = Array.isArray(baseRows) ? [...baseRows] : [];

    if (q) {
      const team = pickTeamFilter(query, baseRows);
      const teamIsKnown = baseRows.some(
        (r) =>
          r.awayTeam.toLowerCase() === team.toLowerCase() ||
          r.homeTeam.toLowerCase() === team.toLowerCase()
      );
      if (team && teamIsKnown) {
        arr = arr.filter(
          (m) =>
            m.awayTeam.toLowerCase() === team.toLowerCase() ||
            m.homeTeam.toLowerCase() === team.toLowerCase()
        );
      } else {
        arr = arr.filter((m) =>
          [
            m.awayId,
            m.homeId,
            m.awayName,
            m.homeName,
            m.awayTeam,
            m.homeTeam,
            m.scenario,
          ]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
        );
      }
    }

    arr = arr.filter((m) => {
      const isCompleted = Boolean(String(m.scenario || "").trim());
      if (onlyCompleted && !isCompleted) return false;
      if (onlyScheduled && isCompleted) return false;
      return true;
    });

    arr.sort((a, b) => gameNum(String(a.game)) - gameNum(String(b.game)));
    return arr;
  }, [baseRows, query, onlyCompleted, onlyScheduled]);

  function setUrlQuery(nextQ: string | null) {
    const params = new URLSearchParams(Array.from(sp.entries()));
    if (nextQ && nextQ.trim()) params.set("q", nextQ.trim());
    else params.delete("q");
    const next = params.toString();
    const href = next ? `${pathname}?${next}` : pathname;
    router.replace(href, { scroll: false });
  }

  function onSelectRow(row: MatchRow) {
    const combined = `${row.awayTeam} ${row.homeTeam}`.trim();
    setUrlQuery(combined);
    const singleTeam =
      pickTeamFilter(combined, baseRows) || row.awayTeam || row.homeTeam;
    setQuery(singleTeam);

    requestAnimationFrame(() => {
      document
        .querySelector<HTMLInputElement>('[aria-label="Filter matchups"]')
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function goWeek(wk: string) {
    const params = new URLSearchParams(Array.from(sp.entries()));
    if (wk.toUpperCase() === activeWeek.toUpperCase()) params.delete("w");
    else params.set("w", wk);
    const next = params.toString();
    const href = next ? `${pathname}?${next}` : pathname;
    router.replace(href, { scroll: false });
  }

  // Token-driven button base (reused in Current view)
  const btnBase =
    "group relative overflow-hidden rounded-md border bg-[var(--ncx-bg-panel)] px-3 py-1.5 text-xs font-semibold text-[var(--ncx-text-primary)] shadow transition active:scale-[0.98]";
  const glowBase =
    "pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100";

  return (
    <div className="mx-auto max-w-screen-sm px-3 py-5">
      <div className="rounded-2xl bg-[var(--ncx-bg-elev)] border border-[var(--ncx-border)] p-3 shadow-[0_4px_20px_rgb(0_0_0/0.25)]">
        <h2 className="mb-3 text-center text-[15px] font-extrabold tracking-wide text-transparent bg-clip-text bg-[var(--ncx-hero-gradient)]">
          WEEKLY MATCHUPS{" "}
          {weekLabel ? (
            <span className="text-[var(--ncx-text-muted)]">• {weekLabel}</span>
          ) : null}
        </h2>

        {/* Week pills */}
        {activeNum && activeNum > 1 && (
          <div className="mb-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => goWeek(activeWeek)}
              className={[btnBase, "border-[rgb(var(--ncx-warn-rgb)/0.55)]"].join(
                " "
              )}
            >
              <span
                className={[
                  glowBase,
                  "bg-[linear-gradient(90deg,rgb(var(--ncx-warn-rgb)/0.18),rgb(var(--ncx-warn-rgb)/0.10),rgb(var(--ncx-warn-rgb)/0.18))]",
                  "opacity-100",
                ].join(" ")}
              />
              <span className="relative z-10">Current</span>
            </button>

            {weekPills.map((wk) => {
              const selected =
                wk.toUpperCase() === weekLabel.toUpperCase() && !isCurrentSelected;
              const isActive = wk.toUpperCase() === activeWeek.toUpperCase();

              const borderCls = isActive
                ? "border-[rgb(var(--ncx-warn-rgb)/0.55)]"
                : selected
                ? "border-[rgb(var(--ncx-primary-rgb)/0.45)]"
                : "border-[rgb(var(--ncx-accent-rgb)/0.35)]";

              const glow = isActive
                ? "bg-[linear-gradient(90deg,rgb(var(--ncx-warn-rgb)/0.18),rgb(var(--ncx-warn-rgb)/0.10),rgb(var(--ncx-warn-rgb)/0.18))]"
                : "bg-[linear-gradient(90deg,rgb(var(--ncx-secondary-rgb)/0.16),rgb(var(--ncx-accent-rgb)/0.14),rgb(var(--ncx-primary-rgb)/0.16))]";

              return (
                <button
                  key={wk}
                  type="button"
                  onClick={() => goWeek(wk)}
                  className={[btnBase, borderCls].join(" ")}
                >
                  <span
                    className={[
                      glowBase,
                      glow,
                      selected ? "opacity-100" : "",
                    ].join(" ")}
                  />
                  <span className="relative z-10">{wk}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Sticky filter bar */}
        <div className="sticky top-0 z-20 -mx-3 mb-4 border-b border-[var(--ncx-border)] bg-[color:rgb(var(--ncx-bg-rgb)/0.80)] px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-[color:rgb(var(--ncx-bg-rgb)/0.55)]">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              inputMode="text"
              placeholder="Filter by NCXID, Name, Team, or Scenario..."
              className="w-full rounded-lg border border-[var(--ncx-border)] bg-[var(--ncx-bg-panel)] px-4 py-3 text-sm text-[var(--ncx-text-primary)] placeholder:text-[var(--ncx-text-dim)] outline-none focus:ring-2 focus:ring-[rgb(var(--ncx-secondary-rgb)/0.35)] sm:flex-1 sm:py-2"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter matchups"
            />
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--ncx-text-muted)] sm:gap-6">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[rgb(var(--ncx-primary-rgb))]"
                  checked={onlyCompleted}
                  onChange={(e) => {
                    setOnlyCompleted(e.target.checked);
                    if (e.target.checked) setOnlyScheduled(false);
                  }}
                  aria-label="Completed only"
                />
                Completed
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[rgb(var(--ncx-accent-rgb))]"
                  checked={onlyScheduled}
                  onChange={(e) => {
                    setOnlyScheduled(e.target.checked);
                    if (e.target.checked) setOnlyCompleted(false);
                  }}
                  aria-label="Scheduled only"
                />
                Scheduled
              </label>

              {(qFromUrlRaw || query).trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setUrlQuery(null);
                  }}
                  className="ml-auto inline-flex items-center rounded-full border border-[var(--ncx-border)] bg-[var(--ncx-bg-panel)] px-3 py-1 text-[12px] text-[var(--ncx-text-primary)] hover:bg-[var(--ncx-bg-elev)]"
                  aria-label="Clear filter"
                >
                  ✕ Clear
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Results */}
        {rows.length === 0 ? (
          <div className="px-3 py-6 text-center text-[var(--ncx-text-muted)]">
            No matchups found.
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((row, i) => (
              <MatchCard
                key={`${row.game}-${i}`}
                row={row}
                scheduleOn={scheduleOn}
                scheduleMap={scheduleMap}
                onSelect={onSelectRow}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
