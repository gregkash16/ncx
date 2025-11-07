"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlayerRow } from "./PlayersPanelServer";
import PlayerVideos from "./PlayerVideos";

function fullName(p: PlayerRow) {
  const f = (p.first || "").trim();
  const l = (p.last || "").trim();
  return f && l ? `${f} ${l}` : f || l || p.ncxid;
}

// Champion teams per season
const CHAMPIONS_BY_SEASON: Record<number, string> = {
  1: "HAVOC",
  2: "HAVOC",
  3: "HAVOC",
  4: "ASCENDANCY",
  5: "ORDER 66",
  6: "MEATBAGS",
  7: "MEATBAGS",
};

/**
 * Easter egg override: set Smash Count per NCXID here.
 * Change the number below to update the displayed value.
 */
const SMASH_COUNTS: Record<string, number> = {
  NCX94: 69, // 🔧 <-- edit this number whenever you want
};

export default function PlayersPanel({ data }: { data: PlayerRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return data;
    return data.filter((p) => {
      const name = fullName(p).toLowerCase();
      return (
        p.ncxid.toLowerCase().includes(qq) ||
        name.includes(qq) ||
        p.discord.toLowerCase().includes(qq)
      );
    });
  }, [data, q]);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = filtered[selectedIdx] ?? filtered[0] ?? null;

  // ✅ Keep selection in range when the filter or list changes (avoid setState during render)
  useEffect(() => {
    if (!filtered.length) {
      if (selectedIdx !== 0) setSelectedIdx(0);
      return;
    }
    if (selectedIdx >= filtered.length) {
      setSelectedIdx(0);
    }
  }, [filtered.length, selectedIdx]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-4">
      {/* LEFT: list */}
      <aside className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-3">
        <div className="mb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by NCXID, name, or Discord…"
            className="w-full rounded-lg bg-zinc-950/60 border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>
        <ul className="max-h-[68vh] overflow-auto space-y-1 pr-1">
          {filtered.map((p, i) => {
            const active = i === selectedIdx;
            return (
              <li key={`${p.ncxid}-${i}`}>
                <button
                  onClick={() => setSelectedIdx(i)}
                  className={[
                    "w-full text-left px-3 py-2 rounded-lg border transition",
                    active
                      ? "bg-purple-500/15 border-purple-500/50"
                      : "bg-zinc-950/40 border-zinc-800 hover:border-purple-500/40",
                  ].join(" ")}
                >
                  <div className="text-sm font-semibold text-zinc-100">
                    {p.ncxid} • {fullName(p)}
                  </div>
                  {p.discord && (
                    <div className="text-xs text-zinc-400">{p.discord}</div>
                  )}
                </button>
              </li>
            );
          })}
          {!filtered.length && (
            <li className="text-sm text-zinc-500 italic px-1 py-2">
              No players found.
            </li>
          )}
        </ul>
      </aside>

      {/* RIGHT: player card */}
      <section className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-5">
        {!selected ? (
          <div className="text-zinc-400">Select a player on the left.</div>
        ) : (
          <div className="space-y-5 mx-auto w-full max-w-[1100px]">
            <header className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                <span className="text-zinc-100">{selected.ncxid}</span>{" "}
                <span className="text-zinc-400">•</span>{" "}
                <span className="text-cyan-400">{fullName(selected)}</span>
              </h2>
              {selected.championships && (
                <span className="text-xs px-3 py-1 rounded-full border border-amber-400/60 bg-amber-500/10 text-amber-300">
                  Championships: {selected.championships}
                </span>
              )}
            </header>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {(() => {
                const stats: Array<[string, string]> = [
                  ["Wins", selected.wins],
                  ["Losses", selected.losses],
                  ["Points", selected.points],
                  ["PL/MS", selected.plms],
                  ["Games", selected.games],
                  ["Win %", selected.winPct],
                  ["PPG", selected.ppg],
                ];

                // 🥚 Insert Smash Count right AFTER "PPG" for NCX94
                if (selected.ncxid in SMASH_COUNTS) {
                  const ppgIndex = stats.findIndex(([label]) => label === "PPG");
                  const insertAt = ppgIndex >= 0 ? ppgIndex + 1 : stats.length;
                  stats.splice(insertAt, 0, [
                    "Smash Count",
                    String(SMASH_COUNTS[selected.ncxid]),
                  ]);
                }

                return stats.map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg bg-zinc-950/50 border border-zinc-800 p-3"
                  >
                    <div className="text-xs uppercase text-zinc-400">
                      {label}
                    </div>
                    <div className="text-lg font-mono text-zinc-100">
                      {value || "-"}
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Seasons table */}
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <div className="bg-zinc-950/70 px-4 py-2 text-sm font-semibold text-zinc-300">
                Season Teams
              </div>
              <table className="w-full text-sm">
                <thead className="bg-zinc-950/50 text-zinc-400">
                  <tr>
                    <th className="text-left px-3 py-2">Season</th>
                    <th className="text-left px-3 py-2">Team</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {selected.seasons.map((team, idx) => {
                    const seasonNum = idx + 1;
                    const isChampion =
                      !!team &&
                      !!CHAMPIONS_BY_SEASON[seasonNum] &&
                      team.toUpperCase().trim() === CHAMPIONS_BY_SEASON[seasonNum];
                    return (
                      <tr
                        key={idx}
                        className={
                          isChampion
                            ? "border border-amber-400/60 bg-amber-500/5"
                            : ""
                        }
                      >
                        <td className="px-3 py-2 text-zinc-300">
                          Season {seasonNum}
                        </td>
                        <td
                          className={[
                            "px-3 py-2",
                            isChampion
                              ? "font-semibold text-amber-300"
                              : "text-zinc-100",
                          ].join(" ")}
                        >
                          {team && team.trim() ? (
                            team
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Videos (consistent embed width handled inside PlayerVideos) */}
            {selected && (
              <div className="pt-2">
                <PlayerVideos ncxid={selected.ncxid} />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
