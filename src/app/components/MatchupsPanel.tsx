'use client';

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import type { IndRow } from "@/lib/googleSheets";
import { teamSlug } from "@/lib/slug";

type MatchRow = {
  game: string;
  awayId: string;
  awayName: string;
  awayTeam: string;
  awayW: string;
  awayL: string;
  awayPts: string;
  awayPLMS: string;
  homeId: string;
  homeName: string;
  homeTeam: string;
  homeW: string;
  homeL: string;
  homePts: string;
  homePLMS: string;
  scenario: string;
};

type ScheduleMap = Record<string, { day: string; slot: string }>;

type Props = {
  data: MatchRow[];
  weekLabel?: string;               // the week data being shown
  activeWeek?: string;              // the true active week (from SCHEDULE!U2)
  scheduleWeek?: string;
  scheduleMap?: ScheduleMap;
  indStats?: IndRow[];
  factionMap?: Record<string, string>;
};

function parseIntSafe(v: string): number {
  const n = Number((v || "").trim());
  return Number.isFinite(n) ? n : 0;
}

function gameNum(g: string): number {
  const m = (g || "").match(/^\d+/);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
}

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

const FACTION_FILE: Record<string, string> = {
  REBELS: "Rebels.png",
  EMPIRE: "Empire.png",
  REPUBLIC: "Republic.png",
  CIS: "CIS.png",
  RESISTANCE: "Resistance.png",
  "FIRST ORDER": "First Order.png",
  SCUM: "Scum.png",
};
function factionIconSrc(faction?: string) {
  const key = (faction || "").toUpperCase().trim();
  const file = FACTION_FILE[key];
  return file ? `/factions/${file}` : "";
}

function statsMapFromIndRows(rows?: IndRow[]) {
  const map = new Map<string, IndRow>();
  (rows ?? []).forEach((r) => {
    if (r?.ncxid) map.set(r.ncxid, r);
  });
  return map;
}

function parseWeekNum(label?: string | null): number | null {
  if (!label) return null;
  const m = label.trim().match(/week\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}
function formatWeekLabel(n: number) {
  return `WEEK ${n}`;
}

export default function MatchupsPanel({
  data,
  weekLabel,
  activeWeek,
  scheduleWeek,
  scheduleMap,
  indStats,
  factionMap,
}: Props) {
  const searchParams = useSearchParams();
  const selectedWeekRaw = (searchParams.get("w") ?? "").trim();

  const activeNum = useMemo(() => parseWeekNum(activeWeek ?? null), [activeWeek]);
  const selectedNum = useMemo(() => parseWeekNum(selectedWeekRaw || null), [selectedWeekRaw]);

  const pastWeeks = useMemo(() => {
    if (!activeNum || activeNum <= 0) return [] as string[];
    return Array.from({ length: activeNum }, (_, i) => formatWeekLabel(i + 1));
  }, [activeNum]);

  const isCurrentSelected = useMemo(() => {
    if (!activeNum) return true;
    return !selectedNum || selectedNum === activeNum;
  }, [activeNum, selectedNum]);

  const [query, setQuery] = useState("");
  const [onlyCompleted, setOnlyCompleted] = useState(false);
  const [onlyScheduled, setOnlyScheduled] = useState(false);

  const cleaned = useMemo(() => {
    return (data || []).filter((m) => /^\d+$/.test((m.game || "").trim()));
  }, [data]);

  const [urlSelectedTeam, setUrlSelectedTeam] = useState("");
  useEffect(() => {
    const q = (searchParams.get("q") ?? "").trim();
    setUrlSelectedTeam(q);
  }, [searchParams]);

  const selectedTeam = useMemo(() => pickTeamFilter(urlSelectedTeam, cleaned), [urlSelectedTeam, cleaned]);

  const indById = useMemo(() => statsMapFromIndRows(indStats), [indStats]);

  const filtered = useMemo(() => {
    const q = (query || "").toLowerCase().trim();
    let rows = !q
      ? cleaned
      : cleaned.filter((m) =>
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
            .some((v) => v.toLowerCase().includes(q))
        );

    rows = rows.filter((m) => {
      const isCompleted = Boolean((m.scenario || "").trim());
      if (onlyCompleted && !isCompleted) return false;
      if (onlyScheduled && isCompleted) return false;
      return true;
    });

    rows.sort((a, b) => {
      const aInSel =
        selectedTeam && (a.awayTeam === selectedTeam || a.homeTeam === selectedTeam) ? 1 : 0;
      const bInSel =
        selectedTeam && (b.awayTeam === selectedTeam || b.homeTeam === selectedTeam) ? 1 : 0;

      if (aInSel !== bInSel) return bInSel - aInSel;
      return gameNum(a.game) - gameNum(b.game);
    });

    return rows;
  }, [cleaned, query, onlyCompleted, onlyScheduled, selectedTeam]);

  const scheduleEnabled =
    Boolean(weekLabel && scheduleWeek) && weekLabel!.trim() === scheduleWeek!.trim();

  const btnBase =
    "group relative overflow-hidden rounded-xl border bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-pink-500/50";
  const gradient =
    "pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100";

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800">
      <h2 className="text-2xl font-bold text-center mb-4">
        <span className="text-pink-400">WEEKLY</span>{" "}
        <span className="text-cyan-400">MATCHUPS</span>
        {weekLabel ? <span className="ml-2 text-zinc-400 text-base">• {weekLabel}</span> : null}
      </h2>

      {/* Week selector strip */}
      {activeNum && activeNum > 1 && (
        <div className="flex flex-wrap justify-center gap-2 mb-5">
          {pastWeeks.map((wk) => {
            const selected =
              !isCurrentSelected &&
              wk.trim().toUpperCase() === (selectedWeekRaw || "").trim().toUpperCase();
            const isActive = wk.toUpperCase() === activeWeek?.toUpperCase();
            const href =
              wk === activeWeek ? "?tab=matchups" : `?tab=matchups&w=${encodeURIComponent(wk)}`;

            return (
              <a
                key={wk}
                href={href}
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
              </a>
            );
          })}
        </div>
      )}

      {/* Search + toggles */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-6">
        <input
          type="text"
          placeholder="Filter by NCXID, Name, Team, or Scenario..."
          className="w-full sm:flex-1 rounded-lg bg-zinc-800 border border-zinc-700 text-sm px-4 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-pink-500"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={onlyCompleted}
            onChange={(e) => {
              setOnlyCompleted(e.target.checked);
              if (e.target.checked) setOnlyScheduled(false);
            }}
          />
          Completed only
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={onlyScheduled}
            onChange={(e) => {
              setOnlyScheduled(e.target.checked);
              if (e.target.checked) setOnlyCompleted(false);
            }}
          />
          Scheduled only
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-zinc-500 italic">No matchups found.</p>
      ) : (
        <div className="space-y-6">
          {filtered.map((row, i) => {
            const awayScore = parseIntSafe(row.awayPts);
            const homeScore = parseIntSafe(row.homePts);
            const isDone = Boolean((row.scenario || "").trim());
            const winner =
              awayScore > homeScore ? "away" : homeScore > awayScore ? "home" : "tie";

            const awayLogo = `/logos/${teamSlug(row.awayTeam)}.png`;
            const homeLogo = `/logos/${teamSlug(row.homeTeam)}.png`;

            const GREEN = "34,197,94";
            const RED = "239,68,68";
            const TIE = "99,102,241";

            const leftColor = winner === "away" ? GREEN : winner === "home" ? RED : TIE;
            const rightColor = winner === "home" ? GREEN : winner === "away" ? RED : TIE;

            const gradientStyle: React.CSSProperties = {
              backgroundImage: `
                linear-gradient(to right, rgba(${leftColor},0.35) 0%, rgba(0,0,0,0) 25%),
                linear-gradient(to left,  rgba(${rightColor},0.35) 0%, rgba(0,0,0,0) 25%)
              `,
            };

            const sched =
              scheduleEnabled && scheduleMap?.[row.game]
                ? ` — ${scheduleMap[row.game].day.toUpperCase()}, ${scheduleMap[row.game].slot.toUpperCase()}`
                : "";

            const awaySeason = row.awayId ? indById.get(row.awayId) : undefined;
            const homeSeason = row.homeId ? indById.get(row.homeId) : undefined;

            const awayFactionIcon = factionIconSrc(factionMap?.[row.awayId]);
            const homeFactionIcon = factionIconSrc(factionMap?.[row.homeId]);

            return (
              <div
                key={`${row.game}-${i}`}
                className="relative p-5 rounded-xl bg-zinc-950/50 border border-zinc-800 hover:border-purple-500/40 transition"
                style={gradientStyle}
              >
                <div className="absolute -top-3 -left-3">
                  <span
                    className={[
                      "inline-flex items-center rounded-lg text-white text-xs font-bold px-2 py-1 shadow-lg",
                      isDone
                        ? "bg-cyan-500/90 shadow-cyan-500/30"
                        : "bg-pink-600/80 shadow-pink-600/30",
                    ].join(" ")}
                    title={sched ? sched.replace(/^ — /, "") : undefined}
                  >
                    {`GAME ${row.game}${sched}`}
                  </span>
                </div>

                <div className="relative z-10 flex items-center justify-between font-semibold text-lg">
                  {/* Away */}
                  <div className="flex items-center gap-3 w-1/3 min-w-0">
                    <Image
                      src={awayLogo}
                      alt={row.awayTeam || "Team"}
                      width={32}
                      height={32}
                      className="inline-block object-contain shrink-0"
                      unoptimized
                      loading="lazy"
                      decoding="async"
                    />
                    <span
                      className={`truncate ${
                        awayScore > homeScore ? "text-pink-400 font-bold" : "text-zinc-300"
                      }`}
                    >
                      {row.awayTeam || "TBD"}
                    </span>
                  </div>

                  {/* Scenario + Score */}
                  <div className="flex flex-col items-center w-1/3">
                    <span className="text-sm text-zinc-400 mb-1 italic">
                      {row.scenario || "No Scenario"}
                    </span>
                    <div className="text-3xl md:text-4xl font-mono leading-none">
                      <span>{awayScore}</span>
                      <span className="mx-3">:</span>
                      <span>{homeScore}</span>
                    </div>
                  </div>

                  {/* Home */}
                  <div className="flex items-center gap-3 justify-end w-1/3 min-w-0">
                    <span
                      className={`truncate text-right ${
                        homeScore > awayScore ? "text-cyan-400 font-bold" : "text-zinc-300"
                      }`}
                    >
                      {row.homeTeam || "TBD"}
                    </span>
                    <Image
                      src={homeLogo}
                      alt={row.homeTeam || "Team"}
                      width={32}
                      height={32}
                      className="inline-block object-contain shrink-0"
                      unoptimized
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
