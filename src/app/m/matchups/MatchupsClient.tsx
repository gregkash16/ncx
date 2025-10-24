// src/app/m/matchups/MatchupsClient.tsx
'use client';

import { useMemo, useState } from 'react';
import MatchCard from './MatchCard';

type MatchRow = {
  game: string;
  awayTeam: string; homeTeam: string;
  awayName?: string; homeName?: string;
  awayId?: string; homeId?: string;
  awayPts?: string | number; homePts?: string | number;
  scenario?: string;
};

type Payload = {
  rows: MatchRow[];
  weekLabel: string;
  scheduleWeek: string;
  scheduleMap: Record<string, { day: string; slot: string }>;
};

function gameNum(g: string): number {
  const m = (g || '').match(/^\d+/);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
}

export default function MatchupsClient({ payload }: { payload: Payload }) {
  const [query, setQuery] = useState('');
  const [onlyCompleted, setOnlyCompleted] = useState(false);
  const [onlyScheduled, setOnlyScheduled] = useState(false);

  // ✅ Safe default with full Payload shape
  const {
    rows: baseRows,
    weekLabel,
    scheduleWeek,
    scheduleMap,
  } = payload ?? {
    rows: [],
    weekLabel: '',
    scheduleWeek: '',
    scheduleMap: {},
  };

  const scheduleOn =
    Boolean(weekLabel) &&
    Boolean(scheduleWeek) &&
    weekLabel.trim() === scheduleWeek.trim();

  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    let arr = Array.isArray(baseRows) ? [...baseRows] : [];

    if (q) {
      arr = arr.filter((m) =>
        [m.awayId, m.homeId, m.awayName, m.homeName, m.awayTeam, m.homeTeam, m.scenario]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }

    arr = arr.filter((m) => {
      const isCompleted = Boolean(String(m.scenario || '').trim());
      if (onlyCompleted && !isCompleted) return false;
      if (onlyScheduled && isCompleted) return false;
      return true;
    });

    arr.sort((a, b) => gameNum(String(a.game)) - gameNum(String(b.game)));
    return arr;
  }, [baseRows, query, onlyCompleted, onlyScheduled]);

  if (!rows.length) {
    return (
      <div className="max-w-screen-sm mx-auto px-3 py-6 text-center text-zinc-400">
        No matchups found.
      </div>
    );
  }

  return (
    <div className="max-w-screen-sm mx-auto px-3 py-5">
      <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-3">
        <h2 className="mb-3 text-center text-[15px] font-extrabold tracking-wide bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
          WEEKLY MATCHUPS {weekLabel ? <span className="text-zinc-400">• {weekLabel}</span> : null}
        </h2>

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
            <div className="flex gap-6 justify-between sm:justify-start text-sm text-zinc-300">
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
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="space-y-4">
          {rows.map((row, i) => (
            <MatchCard
              key={`${row.game}-${i}`}
              row={row}
              scheduleOn={scheduleOn}
              scheduleMap={scheduleMap}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
