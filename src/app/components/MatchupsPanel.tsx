'use client';

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

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

type ScheduleMap = Record<
  string,
  { day: string; slot: string } // e.g. { day: "THURSDAY", slot: "GAME 1" }
>;

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

export default function MatchupsPanel({
  data,
  weekLabel,
  scheduleWeek,
  scheduleMap,
}: {
  data: MatchRow[];
  weekLabel?: string;
  scheduleWeek?: string;
  scheduleMap?: ScheduleMap;
}) {
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

  // Keep input synced if the URL changes (clicking a different series)
  useEffect(() => {
    setQuery(urlSelectedTeam);
  }, [urlSelectedTeam]);

  const filtered = useMemo(() => {
    const q = (query || "").toLowerCase().trim();
    if (!q) return cleaned;
    return cleaned.filter((m) =>
      [
        m.awayId, m.homeId, m.awayName, m.homeName,
        m.awayTeam, m.homeTeam, m.scenario,
      ]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [cleaned, query]);

  const scheduleEnabled =
    Boolean(weekLabel && scheduleWeek) &&
    weekLabel!.trim() === scheduleWeek!.trim();

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800">
      <h2 className="text-2xl font-bold text-center mb-4">
        <span className="text-pink-400">WEEKLY</span>{" "}
        <span className="text-cyan-400">MATCHUPS</span>
        {weekLabel ? (
          <span className="ml-2 text-zinc-400 text-base">• {weekLabel}</span>
        ) : null}
      </h2>

      <input
        type="text"
        placeholder="Filter by NCXID, Name, Team, or Scenario..."
        className="w-full mb-6 rounded-lg bg-zinc-800 border border-zinc-700 text-sm px-4 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-pink-500"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="space-y-6">
        {filtered.map((row, i) => {
          // Points-based winner
          const awayScore = parseIntSafe(row.awayPts);
          const homeScore = parseIntSafe(row.homePts);
          const isDone = Boolean((row.scenario || "").trim());
          const winner =
            awayScore > homeScore ? "away" :
            homeScore > awayScore ? "home" : "tie";

          const awayLogo = `/logos/${teamSlug(row.awayTeam)}.png`;
          const homeLogo = `/logos/${teamSlug(row.homeTeam)}.png`;

          // Colors
          const GREEN = "34,197,94"; // loser
          const RED   = "239,68,68"; // winner
          const TIE   = "99,102,241";

          // Winner RED, loser GREEN (your current mapping)
          const leftColor  = winner === "away" ? RED : winner === "home" ? GREEN : TIE;
          const rightColor = winner === "home" ? RED : winner === "away" ? GREEN : TIE;

          const gradientStyle: React.CSSProperties = {
            backgroundImage: `
              linear-gradient(to left, rgba(${leftColor},0.35), rgba(0,0,0,0) 35%),
              linear-gradient(to right, rgba(${rightColor},0.35), rgba(0,0,0,0) 35%)
            `,
          };

          // Optional schedule badge bits
          const sched =
            scheduleEnabled && scheduleMap?.[row.game]
              ? ` — ${scheduleMap[row.game].day.toUpperCase()}, ${scheduleMap[row.game].slot.toUpperCase()}`
              : "";

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
                  <span
                    className={`truncate ${
                      awayScore > homeScore ? "text-pink-400 font-bold" : "text-zinc-300"
                    }`}
                  >
                    {row.awayTeam || "TBD"}
                  </span>
                </div>

                {/* Scenario + Points */}
                <div className="flex flex-col items-center w-1/3">
                  <span className="text-sm text-zinc-400 mb-1 italic">
                    {row.scenario || "No Scenario"}
                  </span>
                  <div className="text-xl font-mono">
                    {awayScore}:{homeScore}
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

              {/* Player names + NCX IDs */}
              <div className="relative z-10 mt-2 text-sm text-zinc-200 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-pink-400 font-semibold">{row.awayName || "—"}</span>
                  {row.awayId ? (
                    <span className="rounded-full bg-zinc-800/80 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200 font-mono">
                      {row.awayId}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 justify-end">
                  {row.homeId ? (
                    <span className="rounded-full bg-zinc-800/80 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200 font-mono">
                      {row.homeId}
                    </span>
                  ) : null}
                  <span className="text-cyan-400 font-semibold text-right">{row.homeName || "—"}</span>
                </div>
              </div>

              {/* Full stats line */}
              <div className="relative z-10 mt-3 grid grid-cols-2 gap-3 text-xs text-zinc-400">
                <div className="bg-zinc-800/60 rounded-lg px-3 py-2">
                  <div>W: <span className="text-zinc-100">{row.awayW || "0"}</span></div>
                  <div>L: <span className="text-zinc-100">{row.awayL || "0"}</span></div>
                  <div>PTS: <span className="text-zinc-100">{row.awayPts || "0"}</span></div>
                  <div>PL/MS: <span className="text-zinc-100">{row.awayPLMS || "0"}</span></div>
                </div>
                <div className="bg-zinc-800/60 rounded-lg px-3 py-2 text-right">
                  <div>W: <span className="text-zinc-100">{row.homeW || "0"}</span></div>
                  <div>L: <span className="text-zinc-100">{row.homeL || "0"}</span></div>
                  <div>PTS: <span className="text-zinc-100">{row.homePts || "0"}</span></div>
                  <div>PL/MS: <span className="text-zinc-100">{row.homePLMS || "0"}</span></div>
                </div>
              </div>
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
