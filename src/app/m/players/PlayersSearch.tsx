// src/app/m/players/PlayersSearch.tsx
"use client";

import { useEffect, useRef, useState } from "react";

// 🥚 Easter Egg Map
const SMASH_COUNTS: Record<string, number> = {
  NCX94: 69, // ← edit this whenever you want
};

type Player = {
  ncxid: string;
  first: string;
  last: string;
  discord: string;
  wins: number;
  losses: number;
  points: number;
  plms: number;
  games: number;
  winPct: number;
  ppg: number;
  seasons: (string | null)[];
  championships: string;
};

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

export default function PlayersSearch() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Player[]>([]);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function runSearch(query: string) {
    const qs = new URLSearchParams({ q: query, limit: "25" }).toString();
    setLoading(true);
    try {
      const res = await fetch(`/api/players?${qs}`);
      const json = await res.json();
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    setTouched(true);
    if (!query) return;
    runSearch(query);
  }

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-[var(--ncx-border)] bg-[var(--ncx-bg-panel)] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
        <h2 className="text-center text-xl font-extrabold tracking-wide ncx-hero-title ncx-hero-glow">
          Players
        </h2>
        <p className="mt-1 text-center text-xs text-[var(--ncx-text-muted)]">
          Search by NCXID, name, or Discord.
        </p>

        <form
          onSubmit={onSubmit}
          className="mx-auto mt-3 flex max-w-md items-center gap-2"
        >
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. NCX12, Leia, @discord…"
            className="w-full rounded-lg border border-[var(--ncx-border)] bg-[rgb(0_0_0/0.28)] px-3 py-2 text-sm text-[var(--ncx-text-primary)] placeholder:text-[var(--ncx-text-muted)]/70 outline-none focus:ring-2 focus:ring-[rgb(var(--ncx-primary-rgb)/0.40)]"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg border border-[rgb(var(--ncx-primary-rgb)/0.45)] bg-[rgb(0_0_0/0.28)] px-3 py-2 text-sm font-semibold text-[var(--ncx-text-primary)] hover:border-[rgb(var(--ncx-primary-rgb)/0.70)]"
          >
            Search
          </button>
        </form>

        {!touched && (
          <div className="mt-4 text-center text-sm text-[var(--ncx-text-muted)]">
            Start by searching for a player.
          </div>
        )}
        {loading && (
          <div className="mt-4 text-center text-sm text-[var(--ncx-text-primary)]/80">
            Searching…
          </div>
        )}
        {touched && !loading && items.length === 0 && (
          <div className="mt-4 text-center text-sm text-[var(--ncx-text-muted)]">
            No players matched “{q}”.
          </div>
        )}

        {items.length > 0 && (
          <ul className="mt-4 space-y-2">
            {items.map((p, i) => {
              const name =
                `${(p.first || "").trim()} ${(p.last || "").trim()}`.trim() ||
                p.ncxid;

              return (
                <li
                  key={`${p.ncxid}-${i}`}
                  className="rounded-xl border border-[var(--ncx-border)] bg-[rgb(0_0_0/0.30)] p-3"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--ncx-text-primary)]">
                        {p.ncxid}{" "}
                        <span className="text-[var(--ncx-text-muted)]">•</span>{" "}
                        <span className="text-[rgb(var(--ncx-primary-rgb))]">
                          {name}
                        </span>
                      </div>
                      {p.discord && (
                        <div className="truncate text-[11px] text-[var(--ncx-text-muted)]">
                          {p.discord}
                        </div>
                      )}
                    </div>
                    {p.championships && (
                      <span className="text-[11px] px-2 py-1 rounded-full border border-[rgb(var(--ncx-secondary-rgb)/0.60)] bg-[rgb(var(--ncx-secondary-rgb)/0.10)] text-[rgb(var(--ncx-secondary-rgb))]">
                        Championships: {p.championships}
                      </span>
                    )}
                  </div>

                  {/* Quick stats */}
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <Stat label="Wins" value={p.wins} />
                    <Stat label="Losses" value={p.losses} />
                    <Stat label="Points" value={p.points} />
                    <Stat label="PL/MS" value={p.plms} />
                    <Stat label="Games" value={p.games} />
                    <Stat label="Win %" value={fmtPct(p.winPct)} />
                    <Stat label="PPG" value={fmtNum(p.ppg)} />

                    {/* 🥚 Easter Egg for NCX94 */}
                    {p.ncxid in SMASH_COUNTS && (
                      <Stat label="Smash Count" value={SMASH_COUNTS[p.ncxid]} />
                    )}
                  </div>

                  {/* Seasons table */}
                  <div className="mt-3 rounded-lg border border-[var(--ncx-border)] overflow-hidden">
                    <div className="bg-[rgb(0_0_0/0.22)] px-3 py-2 text-[12px] font-semibold text-[var(--ncx-text-primary)]/85">
                      Season Teams
                    </div>
                    <ul className="divide-y divide-[var(--ncx-border)]">
                      {p.seasons.map((team, idx) => {
                        const seasonNum = idx + 1;
                        const champ =
                          team &&
                          CHAMPIONS_BY_SEASON[seasonNum] &&
                          team.toUpperCase().trim() ===
                            CHAMPIONS_BY_SEASON[seasonNum];

                        return (
                          <li
                            key={idx}
                            className={
                              champ
                                ? "bg-[rgb(var(--ncx-secondary-rgb)/0.08)] border-l border-[rgb(var(--ncx-secondary-rgb)/0.60)]"
                                : ""
                            }
                          >
                            <div className="flex items-center justify-between px-3 py-2">
                              <div className="text-[var(--ncx-text-primary)]/80">
                                Season {seasonNum}
                              </div>
                              <div
                                className={
                                  champ
                                    ? "font-semibold text-[rgb(var(--ncx-secondary-rgb))]"
                                    : "text-[var(--ncx-text-primary)]"
                                }
                              >
                                {team && team.trim() ? (
                                  team
                                ) : (
                                  <span className="text-[var(--ncx-text-muted)]/70">
                                    —
                                  </span>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-[rgb(0_0_0/0.22)] border border-[var(--ncx-border)] px-2 py-1">
      <div className="uppercase text-[10px] tracking-wide text-[var(--ncx-text-muted)]">
        {label}
      </div>
      <div className="font-semibold tabular-nums text-[var(--ncx-text-primary)]/90">
        {String(value ?? "—")}
      </div>
    </div>
  );
}

function fmtNum(n: number) {
  if (!Number.isFinite(n)) return "—";
  return String(Math.round(n * 100) / 100);
}
function fmtPct(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 1000) / 10}%`;
}
