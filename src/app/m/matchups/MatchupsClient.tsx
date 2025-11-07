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
    new Set(rows.flatMap((r) => [r.awayTeam, r.homeTeam]).filter(Boolean) as string[])
  );
  const teamBySlug = new Map(allTeams.map((t) => [teamSlug(t), t]));

  // 1) exact slug match
  for (const tok of tokens) {
    const s = teamSlug(tok);
    const exact = teamBySlug.get(s);
    if (exact) return exact;
  }
  // 2) substring slug match (handles partials like "JAGGED")
  for (const tok of tokens) {
    const s = teamSlug(tok);
    const found = allTeams.find((t) => {
      const ts = teamSlug(t);
      return ts.includes(s) || s.includes(ts);
    });
    if (found) return found;
  }
  // 3) fallback: first token (so generic search still works)
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
  const qFromUrlTeam = useMemo(() => pickTeamFilter(qFromUrlRaw, baseRows), [qFromUrlRaw, baseRows]);
  const wFromUrl = (sp.get("w") ?? "").trim();

  const [query, setQuery] = useState(qFromUrlTeam);
  const [onlyCompleted, setOnlyCompleted] = useState(false);
  const [onlyScheduled, setOnlyScheduled] = useState(false);

  // Keep input in sync if the URL changes (e.g., tapping another series)
  useEffect(() => {
    setQuery(qFromUrlTeam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qFromUrlTeam]);

  // Week strip: Current + WEEK 1..active
  const activeNum = useMemo(() => parseWeekNum(activeWeek), [activeWeek]);
  const selectedNum = useMemo(() => parseWeekNum(wFromUrl || weekLabel), [wFromUrl, weekLabel]);

  const isCurrentSelected = useMemo(() => {
    if (!activeNum) return true;
    return !selectedNum || selectedNum === activeNum;
  }, [activeNum, selectedNum]);

  const weekPills = useMemo(() => {
    if (!activeNum || activeNum <= 0) return [activeWeek].filter(Boolean);
    return Array.from({ length: activeNum }, (_, i) => formatWeekLabel(i + 1));
  }, [activeNum, activeWeek]);

  // Show schedule chips only if the page’s week equals the schedule’s week
  const scheduleOn =
    Boolean(weekLabel) && Boolean(scheduleWeek) && weekLabel.trim() === scheduleWeek.trim();

  // Filtering + ordering
  const rows = useMemo(() => {
    const q = (query || "").toLowerCase().trim();
    let arr = Array.isArray(baseRows) ? [...baseRows] : [];

    if (q) {
      // Prefer TEAM filter if query resolves to a known team
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
        // Fallback: generic substring search across common fields
        arr = arr.filter((m) =>
          [m.awayId, m.homeId, m.awayName, m.homeName, m.awayTeam, m.homeTeam, m.scenario]
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
    // Keep URL-compatible "Away Home" format for sharing/back-compat...
    const combined = `${row.awayTeam} ${row.homeTeam}`.trim();
    setUrlQuery(combined);
    // ...but set the input/query to ONE team so filtering works immediately
    const singleTeam = pickTeamFilter(combined, baseRows) || row.awayTeam || row.homeTeam;
    setQuery(singleTeam);

    // Bring the filter bar into view on small screens
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
    // keep q so deep links from Current still filter
    const next = params.toString();
    const href = next ? `${pathname}?${next}` : pathname;
    router.replace(href, { scroll: false });
  }

  return (
    <div className="max-w-screen-sm mx-auto px-3 py-5">
      <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-3">
        <h2 className="mb-3 text-center text-[15px] font-extrabold tracking-wide bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
          WEEKLY MATCHUPS {weekLabel ? <span className="text-zinc-400">• {weekLabel}</span> : null}
        </h2>

        {/* Week selector strip (Current + WEEK 1..active) */}
        {activeNum && activeNum > 1 && (
          <div className="mb-4 flex flex-wrap justify-center gap-2">
            {/* Current */}
            <button
              type="button"
              onClick={() => goWeek(activeWeek)}
              className="group relative overflow-hidden rounded-md border border-yellow-400/70 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow transition active:scale-[0.98]"
            >
              <span className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-yellow-400/20 via-amber-400/20 to-yellow-300/20 opacity-100 group-hover:opacity-100" />
              <span className="relative z-10">Current</span>
            </button>

            {weekPills.map((wk) => {
              const selected = wk.toUpperCase() === weekLabel.toUpperCase() && !isCurrentSelected;
              const isActive = wk.toUpperCase() === activeWeek.toUpperCase();

              const cls =
                isActive
                  ? "border-yellow-400/70"
                  : selected
                  ? "border-cyan-400/60"
                  : "border-purple-500/40";

              const glow =
                isActive
                  ? "bg-gradient-to-r from-yellow-400/20 via-amber-400/20 to-yellow-300/20"
                  : "bg-gradient-to-r from-pink-600/20 via-purple-500/20 to-cyan-500/20";

              return (
                <button
                  key={wk}
                  type="button"
                  onClick={() => goWeek(wk)}
                  className={`group relative overflow-hidden rounded-md border ${cls} bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow transition active:scale-[0.98]`}
                >
                  <span className={`pointer-events-none absolute inset-0 z-0 ${glow} ${selected ? "opacity-100" : ""}`} />
                  <span className="relative z-10">{wk}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Sticky filter bar */}
        <div className="sticky top-0 z-20 -mx-3 px-3 py-3 mb-4 bg-zinc-900/85 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/60 border-b border-zinc-800 rounded-none">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <input
              type="text"
              inputMode="text"
              placeholder="Filter by NCXID, Name, Team, or Scenario..."
              className="w-full sm:flex-1 rounded-lg bg-zinc-800 border border-zinc-700 text-sm px-4 py-3 sm:py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-pink-500"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter matchups"
            />
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-sm text-zinc-300">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4"
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
                  className="size-4"
                  checked={onlyScheduled}
                  onChange={(e) => {
                    setOnlyScheduled(e.target.checked);
                    if (e.target.checked) setOnlyCompleted(false);
                  }}
                  aria-label="Scheduled only"
                />
                Scheduled
              </label>

              {/* Clear chip appears when a URL or typed filter is active */}
              {(qFromUrlRaw || query).trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setUrlQuery(null);
                  }}
                  className="ml-auto inline-flex items-center rounded-full border border-zinc-700 bg-zinc-800/70 px-3 py-1 text-[12px] text-zinc-200 hover:bg-zinc-800"
                  aria-label="Clear filter"
                >
                  ✕ Clear
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Cards */}
        {rows.length === 0 ? (
          <div className="px-3 py-6 text-center text-zinc-400">No matchups found.</div>
        ) : (
          <div className="space-y-4">
            {rows.map((row, i) => (
              <MatchCard
                key={`${row.game}-${i}`}
                row={row}
                scheduleOn={scheduleOn}
                scheduleMap={scheduleMap}
                onSelect={onSelectRow} // tap a card → URL keeps "Away Home", UI filters by one team
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
