// src/app/m/indstats/IndStatsSearch.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { teamSlug } from "@/lib/slug";

type Player = {
  rank: number;
  ncxid: string;
  first: string;
  last: string;
  pick: number;
  team: string;
  faction: string;
  wins: number;
  losses: number;
  points: number;
  plms: number;
  games: number;
  winPct: number;
  ppg: number;
  efficiency: number;
  war: number;
  h2h: number;
  potato: number;
  sos: number;
};

export default function IndStatsSearch() {
  const searchParams = useSearchParams();
  const initialQFromUrl = searchParams.get("indteam") ?? "";

  const [q, setQ] = useState(initialQFromUrl);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Player[]>([]);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function runSearch(query: string) {
    const qs = new URLSearchParams({ q: query, limit: "25" }).toString();
    setLoading(true);
    try {
      const res = await fetch(`/api/indstats?${qs}`);
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

  // Auto-run when arriving with ?indteam=TEAM
  useEffect(() => {
    if (initialQFromUrl) {
      setTouched(true);
      runSearch(initialQFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQFromUrl]);

  const showEmptyState = touched && !loading && items.length === 0;

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-[var(--ncx-border)] bg-[var(--ncx-bg-elev)] p-4 shadow-[0_4px_20px_rgb(0_0_0/0.25)]">
        <h2 className="text-center text-xl font-extrabold tracking-wide text-transparent bg-clip-text bg-[var(--ncx-hero-gradient)]">
          Individual Stats
        </h2>
        <p className="mt-1 text-center text-xs text-[var(--ncx-text-muted)]">
          Search by name, NCXID, team, or faction.
        </p>

        <form
          onSubmit={onSubmit}
          className="mx-auto mt-3 flex max-w-md items-center gap-2"
        >
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Luke, NCX123, Rebels…"
            className="w-full rounded-lg border border-[var(--ncx-border)] bg-[var(--ncx-bg-panel)] px-3 py-2 text-sm text-[var(--ncx-text-primary)] placeholder:text-[var(--ncx-text-dim)] outline-none focus:ring-2 focus:ring-[rgb(var(--ncx-secondary-rgb)/0.35)]"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg border border-[rgb(var(--ncx-accent-rgb)/0.35)] bg-[var(--ncx-bg-panel)] px-3 py-2 text-sm font-semibold text-[var(--ncx-text-primary)] hover:border-[rgb(var(--ncx-accent-rgb)/0.55)] hover:bg-[var(--ncx-bg-elev)]"
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
          <div className="mt-4 text-center text-sm text-[var(--ncx-text-primary)]">
            Searching…
          </div>
        )}
        {showEmptyState && (
          <div className="mt-4 text-center text-sm text-[var(--ncx-text-muted)]">
            No players matched “{q}”.
          </div>
        )}

        {items.length > 0 && (
          <ul className="mt-4 space-y-2">
            {items.map((p) => {
              const name = `${p.first} ${p.last}`.trim() || p.ncxid;
              const wl = `${p.wins}-${p.losses}`;
              const slug = teamSlug(p.team);
              const logoSrc = slug ? `/logos/${slug}.webp` : `/logos/default.png`;

              return (
                <li
                  key={p.ncxid}
                  className="rounded-xl border border-[var(--ncx-border)] bg-[var(--ncx-bg-panel)] p-3"
                >
                  {/* Top row: Rank badge • Name • Team/Faction */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--ncx-border)] bg-[color:rgb(var(--ncx-bg-rgb)/0.55)] text-[11px] font-semibold text-[var(--ncx-text-muted)]"
                        title="Rank"
                      >
                        {p.rank || "—"}
                      </span>

                      {/* Team logo */}
                      <Image
                        src={logoSrc}
                        alt={p.team || "Team"}
                        width={24}
                        height={24}
                        className="inline-block shrink-0 object-contain"
                        unoptimized
                        loading="lazy"
                        decoding="async"
                      />

                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[var(--ncx-text-primary)]">
                          {name}
                        </div>
                        <div className="text-[11px] text-[var(--ncx-text-muted)]">
                          {p.team || "—"} {p.faction ? `• ${p.faction}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-[var(--ncx-text-muted)]">
                        GP: {p.games}
                      </div>
                      <div className="text-xs font-semibold text-transparent bg-clip-text bg-[var(--ncx-hero-gradient)]">
                        {wl}
                      </div>
                    </div>
                  </div>

                  {/* Stat grid */}
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                    <Stat label="Win%" value={fmtPct(p.winPct)} />
                    <Stat label="PPG" value={fmtNum(p.ppg)} />
                    <Stat label="Pts" value={fmtNum(p.points)} />
                    <Stat label="Eff" value={fmtNum(p.efficiency)} />
                    <Stat label="WAR" value={fmtNum(p.war)} />
                    <Stat label="PL/MS" value={fmtNum(p.plms)} />
                    <Stat label="H2H" value={fmtNum(p.h2h)} />
                    <Stat label="SOS" value={fmtNum(p.sos)} />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--ncx-border)] bg-[color:rgb(var(--ncx-bg-rgb)/0.45)] px-2 py-1">
      <div className="uppercase text-[10px] tracking-wide text-[var(--ncx-text-muted)]">
        {label}
      </div>
      <div className="font-semibold tabular-nums text-[var(--ncx-text-primary)]">
        {value}
      </div>
    </div>
  );
}

function fmtNum(n: number | string) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return "—";
  return String(Math.round(v * 100) / 100);
}
function fmtPct(n: number | string) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${Math.round(v * 1000) / 10}%`;
}
