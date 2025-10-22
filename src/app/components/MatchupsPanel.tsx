'use client';

import { useState, useMemo } from "react";
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

export default function MatchupsPanel({
  data,
  weekLabel,
}: {
  data: MatchRow[];
  weekLabel?: string;
}) {
  const [query, setQuery] = useState("");

  const cleaned = useMemo(() => {
    // Drop non-game/header rows (e.g., blank/separator lines)
    return (data || []).filter((m) => /^\d+$/.test((m.game || "").trim()));
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
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
          const awayWins = parseIntSafe(row.awayW);
          const homeWins = parseIntSafe(row.homeW);
          const seriesOver = awayWins >= 4 || homeWins >= 4;
          const awayWinner = seriesOver && awayWins > homeWins;
          const homeWinner = seriesOver && homeWins > awayWins;
          const isDone = Boolean((row.scenario || "").trim());

          const awayLogo = `/logos/${teamSlug(row.awayTeam)}.png`;
          const homeLogo = `/logos/${teamSlug(row.homeTeam)}.png`;

          return (
            <div
              key={`${row.game}-${i}`}
              className="relative p-5 rounded-xl bg-zinc-950/50 border border-zinc-800 hover:border-purple-500/40 transition"
            >
              {/* Game # badge (top-left corner) */}
              <div className="absolute -top-3 -left-3">
                <span
                    className={[
                    "inline-flex items-center rounded-lg text-white text-xs font-bold px-2 py-1 shadow-lg",
                    isDone
                        ? "bg-cyan-500/90 shadow-cyan-500/30" // vaporwave blue for completed
                        : "bg-pink-600/80 shadow-pink-600/30", // default for pending
                    ].join(" ")}
                >
                    GAME {row.game}
                </span>
              </div>

              {/* Teams row */}
              <div className="flex items-center justify-between font-semibold text-lg">
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
                  <span className={`truncate ${awayWinner ? "text-pink-400 font-bold" : "text-zinc-300"}`}>
                    {row.awayTeam || "TBD"}
                  </span>
                </div>

                {/* Scenario + Score */}
                <div className="flex flex-col items-center w-1/3">
                  <span className="text-sm text-zinc-400 mb-1 italic">
                    {row.scenario || "No Scenario"}
                  </span>
                  <div className="text-xl font-mono">
                    {awayWins}:{homeWins}
                  </div>
                </div>

                {/* Home */}
                <div className="flex items-center gap-3 justify-end w-1/3 min-w-0">
                  <span className={`truncate text-right ${homeWinner ? "text-cyan-400 font-bold" : "text-zinc-300"}`}>
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

              {/* Player names + prominent NCX IDs */}
              <div className="mt-2 text-sm text-zinc-200 grid grid-cols-2 gap-3">
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
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-zinc-400">
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
