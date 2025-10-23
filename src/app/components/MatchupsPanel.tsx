'use client';

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import type { IndRow } from "@/lib/googleSheets"; // season summaries (wins, losses, winPct, sos, potato)

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
  weekLabel?: string;
  scheduleWeek?: string;
  scheduleMap?: ScheduleMap;
  indStats?: IndRow[];
  factionMap?: Record<string, string>; // ncxid -> faction (uppercase)
};

function teamSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseIntSafe(v: string): number {
  const n = Number((v || "").trim());
  return Number.isFinite(n) ? n : 0;
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
  // 2) substring slug match
  for (const tok of tokens) {
    const s = teamSlug(tok);
    const found = allTeams.find((t) => {
      const ts = teamSlug(t);
      return ts.includes(s) || s.includes(ts);
    });
    if (found) return found;
  }
  // 3) fallback: first token
  return tokens[0];
}

// Map canonical faction label → PNG filename in /public/factions
const FACTION_FILE: Record<string, string> = {
  "REBELS": "Rebels.png",
  "EMPIRE": "Empire.png",
  "REPUBLIC": "Republic.png",
  "CIS": "CIS.png",
  "RESISTANCE": "Resistance.png",
  "FIRST ORDER": "First Order.png",
  "SCUM": "Scum.png",
};

function factionIconSrc(faction?: string) {
  const key = (faction || "").toUpperCase().trim();
  const file = FACTION_FILE[key];
  return file ? `/factions/${file}` : "";
}

// Build a quick lookup from IndStats by NCXID
function statsMapFromIndRows(rows?: IndRow[]) {
  const map = new Map<string, IndRow>();
  (rows ?? []).forEach((r) => {
    if (r?.ncxid) map.set(r.ncxid, r);
  });
  return map;
}

export default function MatchupsPanel({
  data,
  weekLabel,
  scheduleWeek,
  scheduleMap,
  indStats,
  factionMap,
}: Props) {
  const searchParams = useSearchParams();
  const urlQRaw = (searchParams.get("q") ?? "").trim();

  // Clean the incoming data
  const cleaned = useMemo(() => {
    return (data || []).filter((m) => /^\d+$/.test((m.game || "").trim()));
  }, [data]);

  // Derive a single-team filter from URL ?q=
  const urlSelectedTeam = useMemo(() => {
    if (!urlQRaw) return "";
    return pickTeamFilter(urlQRaw, cleaned);
  }, [urlQRaw, cleaned]);

  const [query, setQuery] = useState(urlSelectedTeam);

  const [onlyCompleted, setOnlyCompleted] = useState(false);
  const [onlyScheduled, setOnlyScheduled] = useState(false);

  // Keep input synced if the URL changes (clicking a different series)
  useEffect(() => {
    setQuery(urlSelectedTeam);
  }, [urlSelectedTeam]);

  const selectedTeam = useMemo(() => pickTeamFilter(query, cleaned), [query, cleaned]);

  // Precompute lookups
  const indById = useMemo(() => statsMapFromIndRows(indStats), [indStats]);
  const factionById = factionMap ?? {};

  // Filtering + ordering
  const filtered = useMemo(() => {
    const q = (query || "").toLowerCase().trim();
    let rows = !q
      ? cleaned
      : cleaned.filter((m) =>
          [
            m.awayId, m.homeId, m.awayName, m.homeName,
            m.awayTeam, m.homeTeam, m.scenario,
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
      const aInSel = selectedTeam &&
        (a.awayTeam === selectedTeam || a.homeTeam === selectedTeam) ? 1 : 0;
      const bInSel = selectedTeam &&
        (b.awayTeam === selectedTeam || b.homeTeam === selectedTeam) ? 1 : 0;

      if (aInSel !== bInSel) return bInSel - aInSel; // selected team first

      const an = gameNum(a.game);
      const bn = gameNum(b.game);
      return an - bn;
    });

    return rows;
  }, [cleaned, query, onlyCompleted, onlyScheduled, selectedTeam]);

  const scheduleEnabled =
    Boolean(weekLabel && scheduleWeek) &&
    weekLabel!.trim() === scheduleWeek!.trim();

  // Colors (winner = GREEN, loser = RED)
  const GREEN = "34,197,94";   // tailwind green-500
  const RED   = "239,68,68";   // tailwind red-500
  const TIE   = "99,102,241";  // indigo-ish

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800">
      <h2 className="text-2xl font-bold text-center mb-4">
        <span className="text-pink-400">WEEKLY</span>{" "}
        <span className="text-cyan-400">MATCHUPS</span>
        {weekLabel ? (
          <span className="ml-2 text-zinc-400 text-base">• {weekLabel}</span>
        ) : null}
      </h2>

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

      {/* Selected team banner (optional) */}
      {selectedTeam && (
        <div className="mb-4 text-center text-sm text-zinc-300">
          Showing games involving{" "}
          <span className="font-semibold text-cyan-300">{selectedTeam}</span>
        </div>
      )}

      <div className="space-y-6">
        {filtered.map((row, i) => {
          const awayScore = parseIntSafe(row.awayPts);
          const homeScore = parseIntSafe(row.homePts);
          const isDone = Boolean((row.scenario || "").trim());
          const winner =
            awayScore > homeScore ? "away" :
            homeScore > awayScore ? "home" : "tie";

          const awayLogo = `/logos/${teamSlug(row.awayTeam)}.png`;
          const homeLogo = `/logos/${teamSlug(row.homeTeam)}.png`;

          const leftColor  = winner === "away" ? GREEN : winner === "home" ? RED : TIE;
          const rightColor = winner === "home" ? GREEN : winner === "away" ? RED : TIE;

          const gradientStyle: React.CSSProperties = {
            backgroundImage: `
              linear-gradient(to right, rgba(${leftColor},0.35) 0%, rgba(0,0,0,0) 25%),
              linear-gradient(to left,  rgba(${rightColor},0.35) 0%, rgba(0,0,0,0) 25%)
            `,
          };

          // Optional schedule badge bits
          const sched =
            scheduleEnabled && scheduleMap?.[row.game]
              ? ` — ${scheduleMap[row.game].day.toUpperCase()}, ${scheduleMap[row.game].slot.toUpperCase()}`
              : "";

          // Season summaries (from IndStats)
          const indById = statsMapFromIndRows(indStats);
          const awaySeason = row.awayId ? indById.get(row.awayId) : undefined;
          const homeSeason = row.homeId ? indById.get(row.homeId) : undefined;

          // Faction icons (from factionMap + /public/factions); BIGGER now (36px)
          const awayFactionIcon = factionIconSrc((factionMap ?? {})[row.awayId]);
          const homeFactionIcon = factionIconSrc((factionMap ?? {})[row.homeId]);

          return (
            <div
              key={`${row.game}-${i}`}
              className="relative p-5 rounded-xl bg-zinc-950/50 border border-zinc-800 hover:border-purple-500/40 transition"
              style={gradientStyle}
            >
              {/* Game # badge (+ stream schedule info if available) */}
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

              {/* Teams row */}
              <div className="relative z-10 flex items-center justify-between font-semibold text-lg">
                {/* Away */}
                <div className="flex items-center gap-3 w-1/3 min-w-0">
                  <div className="w-[32px] h-[32px] rounded-md overflow-hidden bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                    <Image
                      src={awayLogo}
                      alt={row.awayTeam}
                      width={32}
                      height={32}
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <span className={`truncate ${awayScore > homeScore ? "text-pink-400 font-bold" : "text-zinc-300"}`}>
                    {row.awayTeam || "TBD"}
                  </span>
                </div>

                {/* Scenario + Score (BIGGER + SPACED) */}
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
                  <span className={`truncate text-right ${homeScore > awayScore ? "text-cyan-400 font-bold" : "text-zinc-300"}`}>
                    {row.homeTeam || "TBD"}
                  </span>
                  <div className="w-[32px] h-[32px] rounded-md overflow-hidden bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                    <Image
                      src={homeLogo}
                      alt={row.homeTeam}
                      width={32}
                      height={32}
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                </div>
              </div>

              {/* Player names + NCX IDs + (BIGGER) Faction icons */}
              <div className="relative z-10 mt-3 text-sm text-zinc-200 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3">
                  {/* faction icon (away) — CLEAN */}
                  {awayFactionIcon && (
                    <Image
                      src={awayFactionIcon}
                      alt={`${row.awayName} faction`}
                      width={48}      // make it a bit bigger for clarity
                      height={48}
                      className="object-contain"
                      unoptimized
                    />
                  )}

                  <span className="text-pink-400 font-semibold">{row.awayName || "—"}</span>
                  {row.awayId ? (
                    <span className="rounded-full bg-zinc-800/80 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200 font-mono">
                      {row.awayId}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-3 justify-end">
                  {row.homeId ? (
                    <span className="rounded-full bg-zinc-800/80 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200 font-mono">
                      {row.homeId}
                    </span>
                  ) : null}
                  <span className="text-cyan-400 font-semibold text-right">{row.homeName || "—"}</span>
                  {/* faction icon (home) — CLEAN */}
                  {homeFactionIcon && (
                    <Image
                      src={homeFactionIcon}
                      alt={`${row.homeName} faction`}
                      width={48}
                      height={48}
                      className="object-contain"
                      unoptimized
                    />
                  )}
                </div>
              </div>

              {/* Season summary rail (kept) */}
              <div className="relative z-10 mt-4 grid grid-cols-2 gap-3 text-xs text-zinc-300">
                <div className="bg-zinc-800/60 rounded-lg px-3 py-2">
                  <div>
                    Record:{" "}
                    <span className="text-zinc-100">
                      {awaySeason ? `${awaySeason.wins}-${awaySeason.losses}` : "—"}
                    </span>
                  </div>
                  <div>
                    Win%: <span className="text-zinc-100">{awaySeason?.winPct ?? "—"}</span>
                    {" • "}SoS: <span className="text-zinc-100">{awaySeason?.sos ?? "—"}</span>
                    {" • "}Potato: <span className="text-zinc-100">{awaySeason?.potato ?? "—"}</span>
                  </div>
                </div>

                <div className="bg-zinc-800/60 rounded-lg px-3 py-2 text-right">
                  <div>
                    Record:{" "}
                    <span className="text-zinc-100">
                      {homeSeason ? `${homeSeason.wins}-${homeSeason.losses}` : "—"}
                    </span>
                  </div>
                  <div>
                    Win%: <span className="text-zinc-100">{homeSeason?.winPct ?? "—"}</span>
                    {" • "}SoS: <span className="text-zinc-100">{homeSeason?.sos ?? "—"}</span>
                    {" • "}Potato: <span className="text-zinc-100">{homeSeason?.potato ?? "—"}</span>
                  </div>
                </div>
              </div>

              {/* (Removed the inner W/L/PTS/PLMS section per your request) */}
            </div>
          );
        })}

        {!filtered.length && (
          <p className="text-center text-zinc-500 italic">No matchups found.</p>
        )}
      </div>
    </div>
  );
}
