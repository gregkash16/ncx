'use client';

import { useMemo } from 'react';

type Row = {
  game: string;
  awayTeam: string; homeTeam: string;
  awayName?: string; homeName?: string;
  awayId?: string; homeId?: string;
  awayPts?: string | number; homePts?: string | number;
  scenario?: string;
};
type ScheduleMap = Record<string, { day: string; slot: string }>;

function parseIntSafe(v: any): number {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}

export default function MatchCard({
  row,
  scheduleOn,
  scheduleMap,
}: {
  row: Row;
  scheduleOn: boolean;
  scheduleMap: ScheduleMap;
}) {
  const awayScore = parseIntSafe(row.awayPts);
  const homeScore = parseIntSafe(row.homePts);
  const isDone = Boolean(String(row.scenario || '').trim());
  const winner: 'away' | 'home' | 'tie' =
    awayScore > homeScore ? 'away' : homeScore > awayScore ? 'home' : 'tie';

  const sched =
    scheduleOn && scheduleMap?.[row.game]
      ? `${String(scheduleMap[row.game].day || '').toUpperCase()} • ${String(
          scheduleMap[row.game].slot || ''
        ).toUpperCase()}`
      : '';

  // visual intent colors (soft, not neon)
  const baseRing = isDone ? 'ring-cyan-500/25' : 'ring-pink-500/25';
  const baseGlow = isDone ? 'shadow-cyan-500/10' : 'shadow-pink-600/10';

  const scorePill = useMemo(() => {
    const cls =
      winner === 'away'
        ? 'bg-pink-500/15 text-pink-300 border-pink-500/30'
        : winner === 'home'
        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
        : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    return `inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-lg border ${cls}`;
  }, [winner]);

  return (
    <article
      className={[
        'relative rounded-2xl bg-zinc-950/60 border border-zinc-800',
        'ring-1', baseRing, baseGlow, 'shadow-lg',
        'p-4',
      ].join(' ')}
    >
      {/* Header row: GAME + chips */}
      <header className="mb-3 flex items-center justify-between gap-2">
        <span
          className={[
            'inline-flex items-center rounded-md px-2 py-1 text-[11px] font-bold',
            isDone ? 'bg-cyan-600/80 text-white' : 'bg-pink-600/80 text-white',
          ].join(' ')}
        >
          GAME {row.game}
        </span>

        <div className="flex items-center gap-2">
          {sched ? (
            <span className="inline-flex items-center rounded-md bg-zinc-800/80 border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200">
              {sched}
            </span>
          ) : null}
          <span
            className={[
              'inline-flex items-center rounded-md px-2 py-1 text-[11px] border',
              isDone
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-zinc-800/60 text-zinc-300 border-zinc-700',
            ].join(' ')}
            title={row.scenario || 'No Scenario'}
          >
            {row.scenario || 'No Scenario'}
          </span>
        </div>
      </header>

      {/* Teams around score (no logos) */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* Away */}
        <div className="min-w-0 flex items-center gap-2">
          <span className={`truncate text-base ${winner === 'away' ? 'text-pink-400 font-semibold' : 'text-zinc-300'}`}>
            {row.awayTeam || 'TBD'}
          </span>
        </div>

        {/* Score pill */}
        <div className="text-center">
          <span className={scorePill}>
            <span>{awayScore}</span>
            <span className="opacity-60">:</span>
            <span>{homeScore}</span>
          </span>
        </div>

        {/* Home */}
        <div className="min-w-0 flex items-center justify-end gap-2">
          <span className={`truncate text-base text-right ${winner === 'home' ? 'text-cyan-300 font-semibold' : 'text-zinc-300'}`}>
            {row.homeTeam || 'TBD'}
          </span>
        </div>
      </div>

      {/* Players */}
      <footer className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px] text-zinc-200">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-pink-300">{row.awayName || '—'}</span>
          {row.awayId ? (
            <span className="shrink-0 rounded-full bg-zinc-900/80 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 font-mono">
              {row.awayId}
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2">
          {row.homeId ? (
            <span className="shrink-0 rounded-full bg-zinc-900/80 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 font-mono">
              {row.homeId}
            </span>
          ) : null}
          <span className="truncate font-medium text-cyan-300 text-right">{row.homeName || '—'}</span>
        </div>
      </footer>
    </article>
  );
}
