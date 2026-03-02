// /secret/nhl/stats/StatsClient.tsx

"use client";

import { useEffect, useState } from "react";

type ApiResponse = {
  ok: boolean;
  refreshSeconds?: number;
  data?: any;
  error?: string;
};

function StatRow({
  label,
  left,
  right,
}: {
  label: string;
  left: number;
  right: number;
}) {
  const total = left + right;
  const leftPct = total > 0 ? (left / total) * 100 : 50;
  const rightPct = total > 0 ? (right / total) * 100 : 50;

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div className="text-4xl font-extrabold text-white tabular-nums">
          {left}
        </div>
        <div className="text-2xl font-bold text-white/80 tracking-wide">
          {label}
        </div>
        <div className="text-4xl font-extrabold text-white tabular-nums">
          {right}
        </div>
      </div>

      <div className="relative h-4 bg-white/10 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-blue-500"
          style={{ width: `${leftPct}%` }}
        />
        <div
          className="absolute right-0 top-0 h-full bg-red-500"
          style={{ width: `${rightPct}%` }}
        />
      </div>
    </div>
  );
}

function logoFromAbbrev(abbrev?: string) {
  if (!abbrev) return null;
  return `https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`;
}

export default function StatsClient() {
  const [resp, setResp] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [refreshSeconds, setRefreshSeconds] = useState(60);

  async function load() {
    try {
      const r = await fetch("/api/nhl/sabres-stats", {
        cache: "no-store",
      });
      const j = await r.json();
      setResp(j);
      setUpdated(new Date());
      setRefreshSeconds(j.refreshSeconds ?? 60);
    } catch {
      setResp({ ok: false, error: "Failed to fetch" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const id = window.setInterval(load, refreshSeconds * 1000);
    return () => window.clearInterval(id);
  }, [refreshSeconds]);

  if (!resp?.ok) {
    return <div className="text-red-400">{resp?.error ?? "No data"}</div>;
  }

  const sabres = resp.data?.sabres;
  const opponent = resp.data?.opponent;
  const goals = resp.data?.goals ?? [];

  const gameState = resp.data?.gameState;
  const inIntermission = !!resp.data?.inIntermission;
  const period = resp.data?.period;
  const timeRemaining = resp.data?.timeRemaining;

  const isLive = gameState === "LIVE";
  const isFinal =
    gameState === "OFF" ||
    gameState === "FINAL" ||
    (!isLive && timeRemaining === "00:00");

  const topStatus = isLive ? (inIntermission ? "Intermission" : "Live") : "Final";

  const centerStatus = isFinal
    ? "Final"
    : inIntermission
    ? "Intermission"
    : period
    ? `P${period} • ${timeRemaining ?? ""}`
    : "Pregame";

  // Group goals by period
  const goalsByPeriod = goals.reduce((acc: Record<string, any[]>, g: any) => {
    const key = g.period ?? "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  const periodOrder = (p: string) => {
    if (p === "P1") return 1;
    if (p === "P2") return 2;
    if (p === "P3") return 3;
    if (p === "OT") return 4;
    if (p === "SO") return 5;
    return 99;
  };

  const periodKeys = Object.keys(goalsByPeriod).sort(
    (a, b) => periodOrder(a) - periodOrder(b)
  );

  return (
    <div className="space-y-10 text-white">
      <div className="text-sm text-white/50">
        {topStatus}
        {updated ? ` • Updated ${updated.toLocaleTimeString()}` : ""}
      </div>

      {/* SCORE HEADER — reverted to original sizing */}
      <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-2xl p-8">
        <div className="flex items-center gap-4">
          {sabres.logo ? (
            <img
              src={sabres.logo}
              alt={`${sabres.name} logo`}
              className="h-12 w-12"
            />
          ) : null}
          <div className="text-4xl font-extrabold">{sabres.name}</div>
        </div>

        <div className="text-center">
          <div className="text-6xl font-extrabold tabular-nums">
            {sabres.score} - {opponent.score}
          </div>

          <div className="text-2xl font-extrabold mt-2">
            {centerStatus}
          </div>
        </div>

        <div className="flex items-center justify-end gap-4">
          <div className="text-4xl font-extrabold text-right">
            {opponent.name}
          </div>
          {opponent.logo ? (
            <img
              src={opponent.logo}
              alt={`${opponent.name} logo`}
              className="h-12 w-12"
            />
          ) : null}
        </div>
      </div>

      {/* STATS — kept larger */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-10 space-y-10">
        <StatRow label="Shots" left={sabres.shots} right={opponent.shots} />
        <StatRow label="Hits" left={sabres.hits} right={opponent.hits} />
        <StatRow
          label="Blocked"
          left={sabres.blocked}
          right={opponent.blocked}
        />
        <StatRow label="PIM" left={sabres.pim} right={opponent.pim} />
      </div>

      {/* GOAL SUMMARY — large */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-12">
        <div className="text-5xl font-extrabold mb-12">Goal Summary</div>

        <div className="space-y-14">
          {periodKeys.length ? (
            periodKeys.map((pk) => (
              <div key={pk} className="space-y-8">
                <div className="text-4xl font-extrabold text-white/90">
                  {pk}
                </div>

                <div className="space-y-8">
                  {goalsByPeriod[pk].map((g: any, i: number) => {
                    const goalLogo = logoFromAbbrev(g.team);

                    return (
                      <div
                        key={i}
                        className="border-b border-white/10 pb-8"
                      >
                        <div className="flex items-center gap-5 text-3xl font-semibold">
                          {goalLogo ? (
                            <img
                              src={goalLogo}
                              alt={`${g.team} logo`}
                              className="h-10 w-10"
                            />
                          ) : null}
                          <span>{g.scorer}</span>
                        </div>

                        <div className="text-white/70 text-2xl mt-3">
                          Assists:{" "}
                          {g.assists.length
                            ? g.assists.join(", ")
                            : "Unassisted"}
                        </div>

                        <div className="text-white/50 text-2xl mt-2">
                          {g.time} • {g.strength}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="text-3xl text-white/60">No goals</div>
          )}
        </div>
      </div>
    </div>
  );
}