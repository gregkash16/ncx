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
  8: "WOLFPACK",
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
      const discord = (p.discord || "").toLowerCase(); // ✅ guard against null/undefined
      return (
        p.ncxid.toLowerCase().includes(qq) ||
        name.includes(qq) ||
        discord.includes(qq)
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
            return (
              <li key={`${p.ncxid}-${i}`}>
                <button
                  onClick={() => setSelectedIdx(i)}
                  className={[
                    "w-full text-left px-3 py-2 rounded-lg border transition",
                    active
                      ? "bg-[rgb(var(--ncx-primary-rgb)/0.15)] border-[rgb(var(--ncx-primary-rgb)/0.50)]"
                      : "bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] border-[var(--ncx-border)] hover:border-[rgb(var(--ncx-primary-rgb)/0.40)]",
                  ].join(" ")}
                >
                  <div className="text-sm font-semibold text-[var(--ncx-text-primary)]">
                    {p.ncxid} • {fullName(p)}
                  </div>
                  {p.discord && (
                    <div className="text-xs text-[var(--ncx-text-muted)]">
                      {p.discord}
                    </div>
                  )}
                </button>
              </li>
            );
          })}

          {!filtered.length && (
            <li className="text-sm text-[var(--ncx-text-muted)] italic px-1 py-2">
              No players found.
            </li>
          )}
        </ul>
      </aside>

      {/* RIGHT: player card */}
      <section className="rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] p-5">
        {!selected ? (
          <div className="text-[var(--ncx-text-muted)]">
            Select a player on the left.
          </div>
        ) : (
          <div className="space-y-5 mx-auto w-full max-w-[1100px]">
            <header className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                <span className="text-[var(--ncx-text-primary)]">
                  {selected.ncxid}
                </span>{" "}
                <span className="text-[var(--ncx-text-muted)]">•</span>{" "}
                <span className="ncx-accent">{fullName(selected)}</span>
              </h2>

              {selected.championships && (
                <span className="text-xs px-3 py-1 rounded-full border border-[rgb(var(--ncx-highlight-rgb)/0.60)] bg-[rgb(var(--ncx-highlight-rgb)/0.12)] text-[rgb(var(--ncx-highlight-rgb))]">
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

            {/* Seasons table */}
            <div className="rounded-xl border border-[var(--ncx-border)] overflow-hidden">
              <div className="bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.12)] px-4 py-2 text-sm font-semibold text-[var(--ncx-text-primary)]">
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
                      !!team &&
                      !!CHAMPIONS_BY_SEASON[seasonNum] &&
                      team.toUpperCase().trim() === CHAMPIONS_BY_SEASON[seasonNum];

                    return (
                      <tr
                        key={idx}
                        className={
                          isChampion
                            ? "border border-[rgb(var(--ncx-highlight-rgb)/0.60)] bg-[rgb(var(--ncx-highlight-rgb)/0.06)]"
                            : ""
                        }
                      >
                        <td className="px-3 py-2 text-[var(--ncx-text-primary)]">
                          Season {seasonNum}
                        </td>

                        <td
                          className={[
                            "px-3 py-2",
                            isChampion
                              ? "font-semibold text-[rgb(var(--ncx-highlight-rgb))]"
                              : "text-[var(--ncx-text-primary)]",
                          ].join(" ")}
                        >
                          {team && team.trim() ? (
                            team
                          ) : (
                            <span className="text-[var(--ncx-text-muted)]">—</span>
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
