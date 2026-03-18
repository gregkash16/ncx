"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlayerRow } from "./PlayersPanelServer";
import PlayerVideos from "./PlayerVideos";

type PlayerDetails = {
  ncxid: string;
  playerFaction: string;
  recentMatches: Array<{
    season: "S8" | "S9";
    week: string;
    playerFaction: string;
    playerTeam: string;
    opponentName: string;
    opponentId: string;
    opponentFaction: string;
    opponentTeam: string;
    outcome: "W" | "L";
    playerPts: number;
    opponentPts: number;
  }>;
  recordLast10: { wins: number; losses: number };
  factionWins: number;
  factionLosses: number;
  currentWinStreak: number;
  currentLossStreak: number;
  nemesis: {
    opponentId: string;
    wins: number;
    losses: number;
  } | null;
};

function fullName(p: PlayerRow) {
  const f = (p.first || "").trim();
  const l = (p.last || "").trim();
  return f && l ? `${f} ${l}` : f || l || p.ncxid;
}

const CHAMPIONS_BY_SEASON: Record<number, string> = {
  1: "HAVOC",
  2: "HAVOC",
  3: "HAVOC",
  4: "ASCENDANCY",
  5: "ORDER 66",
  6: "MEATBAGS",
  7: "MEATBAGS",
  8: "WOLFPACK",
};

const SMASH_COUNTS: Record<string, number> = {
  NCX94: 69,
};

export default function PlayersPanel({ data }: { data: PlayerRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const base = data.filter((p) => p.first && p.first.trim() !== "");
    if (!qq) return base;

    return data.filter((p) => {
      const name = fullName(p).toLowerCase();
      const discord = (p.discord || "").toLowerCase();
      return (
        p.ncxid.toLowerCase().includes(qq) ||
        name.includes(qq) ||
        discord.includes(qq)
      );
    });
  }, [data, q]);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = filtered[selectedIdx] ?? filtered[0] ?? null;

  const [details, setDetails] = useState<PlayerDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    if (!filtered.length) {
      if (selectedIdx !== 0) setSelectedIdx(0);
      return;
    }
    if (selectedIdx >= filtered.length) setSelectedIdx(0);
  }, [filtered.length, selectedIdx]);

  // Fetch details when selected player changes
  useEffect(() => {
    if (!selected) {
      setDetails(null);
      return;
    }

    // Clear old details immediately when switching players
    setDetails(null);
    setDetailsLoading(true);
    fetch(`/api/players/${selected.ncxid}/details`)
      .then((res) => res.json())
      .then((data) => setDetails(data))
      .catch(() => setDetails(null))
      .finally(() => setDetailsLoading(false));
  }, [selected?.ncxid]);

  return (
    <div className="relative left-1/2 -translate-x-1/2 w-screen px-4">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-4">

          {/* LEFT LIST */}
          <aside className="rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] p-3">
            <div className="mb-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by NCXID, name, or Discord…"
                className="w-full rounded-lg bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] px-3 py-2 text-sm text-[var(--ncx-text-primary)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ncx-primary-rgb)/0.35)]"
              />
            </div>

            <ul className="max-h-[68vh] overflow-auto space-y-1 pr-1">
              {filtered.map((p, i) => {
                const active = i === selectedIdx;
                const isRookie = p.seasons.every(
                  (s) => !s || !String(s).trim()
                );

                return (
                  <li key={`${p.ncxid}-${i}`}>
                    <button
                      onClick={() => setSelectedIdx(i)}
                      className={[
                        "w-full px-3 py-2 rounded-lg border transition",
                        active
                          ? "bg-[rgb(var(--ncx-primary-rgb)/0.15)] border-[rgb(var(--ncx-primary-rgb)/0.50)]"
                          : "bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] border-[var(--ncx-border)] hover:border-[rgb(var(--ncx-primary-rgb)/0.40)]",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 text-left">
                          <div className="truncate text-sm font-semibold text-[var(--ncx-text-primary)]">
                            {p.ncxid} • {fullName(p)}
                          </div>
                          {p.discord && (
                            <div className="truncate text-xs text-[var(--ncx-text-muted)]">
                              {p.discord}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {isRookie && (
                            <div className="w-5 h-5 flex items-center justify-center rounded-full border border-[rgb(var(--ncx-gold-rgb)/0.8)] text-[10px] font-bold text-[rgb(var(--ncx-gold-rgb))] bg-[rgb(var(--ncx-gold-rgb)/0.08)]">
                              R
                            </div>
                          )}

                          {Number(p.championships) > 0 && (
                            <div className="flex items-center gap-1 text-xs font-semibold text-[rgb(var(--ncx-gold-rgb))]">
                              <span>🏆</span>
                              {Number(p.championships) > 1 && (
                                <span>{p.championships}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* RIGHT PANEL */}
          <section className="rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] p-5">
            {!selected ? (
              <div className="text-[var(--ncx-text-muted)]">
                Select a player on the left.
              </div>
            ) : (
              <div className="space-y-5 mx-auto w-full max-w-[1100px]">

                <header className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">
                    {selected.ncxid} • {fullName(selected)}
                  </h2>

                  {selected.championships && (
                    <span className="inline-flex items-center px-3 py-1 text-xs rounded-full ncx-championship">
                      Championships: {selected.championships}
                    </span>
                  )}
                </header>

                {/* STATS GRID */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-3">
                  {(() => {
                    const stats: Array<[string, string]> = [
                      ["Wins", selected.wins],
                      ["Losses", selected.losses],
                      ["Points", selected.points],
                      ["PL/MS", selected.plms],
                      ["Games", selected.games],
                      ["Win %", selected.winPct],
                      ["PPG", selected.ppg],
                      ["Adj PPG", selected.adj_ppg],
                    ];

                    if (selected.ncxid in SMASH_COUNTS) {
                      stats.push([
                        "Smash Count",
                        String(SMASH_COUNTS[selected.ncxid]),
                      ]);
                    }

                    return stats.map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-lg bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] border border-[var(--ncx-border)] p-3"
                      >
                        <div className="text-xs uppercase text-[var(--ncx-text-muted)]">
                          {label}
                        </div>
                        <div className="text-lg font-mono text-[var(--ncx-text-primary)]">
                          {value || "-"}
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                {/* STREAKS & FACTION W/L */}
                {details && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {details.currentWinStreak > 0 && (
                      <div className="rounded-lg bg-[rgb(34_197_94/0.10)] border border-[rgb(34_197_94/0.40)] p-3">
                        <div className="text-xs uppercase text-[rgb(34_197_94)]">
                          Win Streak
                        </div>
                        <div className="text-lg font-mono text-[rgb(34_197_94)] font-semibold">
                          {details.currentWinStreak}
                        </div>
                      </div>
                    )}

                    {details.currentLossStreak > 0 && (
                      <div className="rounded-lg bg-[rgb(239_68_68/0.10)] border border-[rgb(239_68_68/0.40)] p-3">
                        <div className="text-xs uppercase text-[rgb(239_68_68)]">
                          Loss Streak
                        </div>
                        <div className="text-lg font-mono text-[rgb(239_68_68)] font-semibold">
                          {details.currentLossStreak}
                        </div>
                      </div>
                    )}

                    {details.recordLast10 && (
                      <div className="rounded-lg bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] border border-[var(--ncx-border)] p-3">
                        <div className="text-xs uppercase text-[var(--ncx-text-muted)]">
                          Record Last 10
                        </div>
                        <div className="text-lg font-mono text-[var(--ncx-text-primary)] font-semibold">
                          {details.recordLast10.wins}-{details.recordLast10.losses}
                        </div>
                      </div>
                    )}

                    {details.playerFaction && (
                      <div className="rounded-lg bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] border border-[var(--ncx-border)] p-3 flex items-center gap-3">
                        <img
                          src={`/factions/${details.playerFaction}.webp`}
                          alt={details.playerFaction}
                          className="w-8 h-8 object-contain"
                        />
                        <div className="flex-1">
                          <div className="text-xs uppercase text-[var(--ncx-text-muted)]">
                            Current Faction
                          </div>
                          <div className="text-lg font-mono text-[var(--ncx-text-primary)] font-semibold">
                            {details.factionWins}-{details.factionLosses}
                          </div>
                        </div>
                      </div>
                    )}

                    {details.nemesis && (
                      <div className="rounded-lg bg-[rgb(168_85_247/0.10)] border border-[rgb(168_85_247/0.40)] p-3">
                        <div className="text-xs uppercase text-[rgb(168_85_247)]">
                          Nemesis
                        </div>
                        <div className="text-lg font-mono text-[rgb(168_85_247)] font-semibold">
                          {details.nemesis.opponentId}
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* RECENT MATCHES */}
                {details && details.recentMatches && details.recentMatches.length > 0 && (
                  <div className="rounded-xl border border-[var(--ncx-border)] overflow-x-auto">
                    <div className="bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.12)] px-4 py-2 text-sm font-semibold">
                      Recent Matches
                    </div>

                    <table className="w-full text-sm">
                      <thead className="bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] text-[var(--ncx-text-muted)] sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 whitespace-nowrap">Week</th>
                          <th className="text-center px-3 py-2 whitespace-nowrap">Your Faction</th>
                          <th className="text-left px-3 py-2 whitespace-nowrap">Your Team</th>
                          <th className="text-left px-3 py-2 whitespace-nowrap">Opponent</th>
                          <th className="text-center px-3 py-2 whitespace-nowrap">Opp Faction</th>
                          <th className="text-left px-3 py-2 whitespace-nowrap">Opp Team</th>
                          <th className="text-center px-3 py-2 whitespace-nowrap">Result</th>
                          <th className="text-right px-3 py-2 whitespace-nowrap">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--ncx-border)]">
                        {details.recentMatches.map((match, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-[var(--ncx-text-muted)] text-xs whitespace-nowrap">
                              {match.season} {match.week}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {match.playerFaction && (
                                <img
                                  src={`/factions/${match.playerFaction}.webp`}
                                  alt={match.playerFaction}
                                  className="w-6 h-6 mx-auto object-contain"
                                  title={match.playerFaction}
                                />
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {match.playerTeam}
                            </td>
                            <td className="px-3 py-2 text-sm">
                              {match.opponentName}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {match.opponentFaction && (
                                <img
                                  src={`/factions/${match.opponentFaction}.webp`}
                                  alt={match.opponentFaction}
                                  className="w-6 h-6 mx-auto object-contain"
                                  title={match.opponentFaction}
                                />
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {match.opponentTeam}
                            </td>
                            <td className="text-center px-3 py-2">
                              <span
                                className={
                                  match.outcome === "W"
                                    ? "font-semibold text-[rgb(34_197_94)]"
                                    : "font-semibold text-[rgb(239_68_68)]"
                                }
                              >
                                {match.outcome}
                              </span>
                            </td>
                            <td className="text-right px-3 py-2 tabular-nums font-mono text-xs">
                              {match.playerPts} - {match.opponentPts}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* SEASONS TABLE */}
                <div className="rounded-xl border border-[var(--ncx-border)] overflow-hidden">
                  <div className="bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.12)] px-4 py-2 text-sm font-semibold">
                    Season Teams
                  </div>

                  <table className="w-full text-sm">
                    <thead className="bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] text-[var(--ncx-text-muted)]">
                      <tr>
                        <th className="text-left px-3 py-2">Season</th>
                        <th className="text-left px-3 py-2">Team</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ncx-border)]">
                      {selected.seasons.map((team, idx) => {
                        const seasonNum = idx + 1;
                        const isChampion =
                          team &&
                          CHAMPIONS_BY_SEASON[seasonNum] &&
                          team.toUpperCase().trim() ===
                            CHAMPIONS_BY_SEASON[seasonNum];

                        return (
                          <tr key={idx}>
                            <td className="px-3 py-2">
                              Season {seasonNum}
                            </td>
                            <td
                              className={[
                                "px-3 py-2",
                                isChampion
                                  ? "font-semibold text-[rgb(var(--ncx-gold-rgb))]"
                                  : "",
                              ].join(" ")}
                            >
                              {team && team.trim() ? team : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <PlayerVideos ncxid={selected.ncxid} />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
