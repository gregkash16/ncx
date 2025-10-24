'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';

// helpers
function teamSlug(name: string) {
  return (name || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}
function parseIntSafe(v: any): number {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}
function gameNum(g: string): number {
  const m = (g || '').match(/^\d+/);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
}

export default function MobileMatchupsPage() {
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  // UI state
  const [query, setQuery] = useState('');
  const [onlyCompleted, setOnlyCompleted] = useState(false);
  const [onlyScheduled, setOnlyScheduled] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/matchups', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!alive) return;
        setPayload(data);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Failed to load data');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ---- derive values & call hooks BEFORE any early returns ----
  const weekLabel    = payload?.weekLabel ?? '';
  const scheduleWeek = payload?.scheduleWeek ?? '';
  const scheduleMap  = (payload?.scheduleMap ?? {}) as Record<string, { day: string; slot: string }>;
  const scheduleOn   = Boolean(weekLabel && scheduleWeek && weekLabel.trim() === scheduleWeek.trim());

  const rows = useMemo(() => {
    const base: any[] = Array.isArray(payload?.rows) ? payload.rows : [];
    const q = query.toLowerCase().trim();

    let arr = base;

    if (q) {
      arr = arr.filter((m) =>
        [m.awayId, m.homeId, m.awayName, m.homeName, m.awayTeam, m.homeTeam, m.scenario]
          .filter(Boolean)
          .some((v: string) => String(v).toLowerCase().includes(q))
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
  }, [payload?.rows, query, onlyCompleted, onlyScheduled]);

  // ---- early returns are now safe (hooks already called this render) ----
  if (loading) {
    return (
      <div className="p-6 text-center text-zinc-300">
        <p className="animate-pulse">Loading matchups…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-400">
        {error}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="p-6 text-center text-zinc-400">
        No matchups found.
      </div>
    );
  }

  const GREEN = '34,197,94';
  const RED   = '239,68,68';
  const TIE   = '99,102,241';

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      <div className="p-4 sm:p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800">
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-3 sm:mb-4">
          <span className="text-pink-400">WEEKLY</span>{' '}
          <span className="text-cyan-400">MATCHUPS</span>
          {weekLabel ? (
            <span className="ml-2 text-zinc-400 text-sm sm:text-base">
              • {weekLabel}
            </span>
          ) : null}
        </h2>

        {/* Sticky filter bar on mobile */}
        <div className="sticky top-0 z-20 -mx-4 sm:mx-0 px-4 py-3 mb-4 sm:mb-6 bg-zinc-900/80 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/60 border-b border-zinc-800 sm:border-none rounded-none sm:rounded-lg">
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
            <div className="flex gap-4 sm:gap-6 justify-between sm:justify-start text-sm text-zinc-300">
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

        <div className="space-y-4 sm:space-y-6">
          {rows.map((row: any, i: number) => {
            const awayScore = parseIntSafe(row.awayPts);
            const homeScore = parseIntSafe(row.homePts);
            const isDone = Boolean(String(row.scenario || '').trim());
            const winner = awayScore > homeScore ? 'away' : homeScore > awayScore ? 'home' : 'tie';

            const awayLogo = `/logos/${teamSlug(row.awayTeam)}.png`;
            const homeLogo = `/logos/${teamSlug(row.homeTeam)}.png`;

            const leftColor  = winner === 'away' ? GREEN : winner === 'home' ? RED : TIE;
            const rightColor = winner === 'home' ? GREEN : winner === 'away' ? RED : TIE;

            const gradientStyle: React.CSSProperties = {
              backgroundImage: `linear-gradient(to right, rgba(${leftColor},0.35) 0%, rgba(0,0,0,0) 25%), linear-gradient(to left, rgba(${rightColor},0.35) 0%, rgba(0,0,0,0) 25%)`,
            };

            const sched =
              scheduleOn && scheduleMap?.[row.game]
                ? ` — ${String(scheduleMap[row.game].day || '').toUpperCase()}, ${String(scheduleMap[row.game].slot || '').toUpperCase()}`
                : '';

            return (
              <div
                key={`${row.game}-${i}`}
                className="relative p-4 sm:p-5 rounded-xl bg-zinc-950/50 border border-zinc-800 hover:border-purple-500/40 transition"
                style={gradientStyle}
              >
                {/* Game badge + schedule */}
                <div className="absolute -top-3 -left-3">
                  <span
                    className={[
                      'inline-flex items-center rounded-lg text-white text-[11px] sm:text-xs font-bold px-2 py-1 shadow-lg',
                      isDone ? 'bg-cyan-500/90 shadow-cyan-500/30' : 'bg-pink-600/80 shadow-pink-600/30',
                    ].join(' ')}
                    title={sched ? sched.replace(/^ — /, '') : undefined}
                  >
                    {`GAME ${row.game}${sched}`}
                  </span>
                </div>

                {/* Teams + score */}
                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 items-center gap-3 sm:gap-2">
                  {/* Away */}
                  <div className="flex items-center gap-3 min-w-0 order-1 sm:order-none">
                    <div className="w-8 h-8 sm:w-[32px] sm:h-[32px] rounded-md overflow-hidden bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                      <Image src={awayLogo} alt={row.awayTeam || 'Away'} width={32} height={32} className="object-contain" unoptimized />
                    </div>
                    <span className={`truncate text-base sm:text-lg ${awayScore > homeScore ? 'text-pink-400 font-bold' : 'text-zinc-300'}`}>
                      {row.awayTeam || 'TBD'}
                    </span>
                  </div>

                  {/* Scenario + score */}
                  <div className="flex flex-col items-center order-3 sm:order-none">
                    <span className="text-xs sm:text-sm text-zinc-400 mb-1 italic">
                      {row.scenario || 'No Scenario'}
                    </span>
                    <div className="text-2xl sm:text-3xl md:text-4xl font-mono leading-none">
                      <span>{awayScore}</span>
                      <span className="mx-3">:</span>
                      <span>{homeScore}</span>
                    </div>
                  </div>

                  {/* Home */}
                  <div className="flex items-center gap-3 justify-start sm:justify-end min-w-0 order-2 sm:order-none">
                    <span className={`truncate text-right text-base sm:text-lg ${homeScore > awayScore ? 'text-cyan-400 font-bold' : 'text-zinc-300'}`}>
                      {row.homeTeam || 'TBD'}
                    </span>
                    <div className="w-8 h-8 sm:w-[32px] sm:h-[32px] rounded-md overflow-hidden bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                      <Image src={homeLogo} alt={row.homeTeam || 'Home'} width={32} height={32} className="object-contain" unoptimized />
                    </div>
                  </div>
                </div>

                {/* Players + IDs */}
                <div className="relative z-10 mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px] sm:text-sm text-zinc-200">
                  <div className="flex items-center gap-3">
                    <span className="text-pink-400 font-semibold truncate">{row.awayName || '—'}</span>
                    {row.awayId ? (
                      <span className="rounded-full bg-zinc-800/80 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200 font-mono shrink-0">
                        {row.awayId}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 sm:justify-end">
                    {row.homeId ? (
                      <span className="rounded-full bg-zinc-800/80 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200 font-mono shrink-0">
                        {row.homeId}
                      </span>
                    ) : null}
                    <span className="text-cyan-400 font-semibold truncate text-right">{row.homeName || '—'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
