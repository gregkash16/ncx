"use client";

import { useEffect, useState } from "react";

type ApiResponse = {
  ok: boolean;
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
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-2xl font-extrabold text-white tabular-nums">
          {left}
        </div>

        <div className="text-lg font-bold text-white/80 tracking-wide">
          {label}
        </div>

        <div className="text-2xl font-extrabold text-white tabular-nums">
          {right}
        </div>
      </div>

      <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
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

export default function StatsClient() {
  const [resp, setResp] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);

  async function load() {
    try {
      setLoading(true);
      const r = await fetch("/api/nhl/sabres-stats", {
        cache: "no-store",
      });
      const j = await r.json();
      setResp(j);
      setUpdated(new Date());
    } catch {
      setResp({ ok: false, error: "Failed to fetch" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60000); // 1 minute
    return () => window.clearInterval(id);
  }, []);

  if (!resp?.ok) {
    return (
      <div className="text-red-400">
        {resp?.error ?? "No data"}
      </div>
    );
  }

  const sabres = resp.data?.sabres;
  const opponent = resp.data?.opponent;
  const goals = resp.data?.goals ?? [];

  return (
    <div className="space-y-12 text-white">
      <div className="text-sm text-white/50">
        {loading ? "Updating…" : "Live"}
        {updated ? ` • Updated ${updated.toLocaleTimeString()}` : ""}
      </div>

      {/* Score Header */}
      <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-2xl p-10">
        <div className="text-4xl font-extrabold text-white">
          {sabres.name}
        </div>

        <div className="text-7xl font-extrabold text-white tabular-nums">
          {sabres.score} - {opponent.score}
        </div>

        <div className="text-4xl font-extrabold text-white text-right">
          {opponent.name}
        </div>
      </div>

      {/* Stats Comparison */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-10 space-y-8">
        <StatRow
          label="Shots"
          left={sabres.shots}
          right={opponent.shots}
        />
        <StatRow
          label="Hits"
          left={sabres.hits}
          right={opponent.hits}
        />
        <StatRow
          label="Blocked"
          left={sabres.blocked}
          right={opponent.blocked}
        />
        <StatRow
          label="Faceoff %"
          left={sabres.faceoff}
          right={opponent.faceoff}
        />
        <StatRow
          label="PIM"
          left={sabres.pim}
          right={opponent.pim}
        />
      </div>

      {/* Goal Summary */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-10">
        <div className="text-3xl font-extrabold text-white mb-8">
          Goal Summary
        </div>

        <div className="space-y-6">
          {goals.map((g: any, i: number) => (
            <div
              key={i}
              className="border-b border-white/10 pb-5"
            >
              <div className="font-bold text-xl text-white">
                {g.team} – {g.scorer}
              </div>
              <div className="text-white/80">
                Assists:{" "}
                {g.assists.length
                  ? g.assists.join(", ")
                  : "Unassisted"}
              </div>
              <div className="text-white/50 text-sm">
                {g.period} • {g.time} • {g.strength}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}