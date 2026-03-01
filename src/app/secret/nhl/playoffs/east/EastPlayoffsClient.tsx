// src/app/secret/nhl/playoffs/east/EastPlayoffsClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type ApiResponse = {
  ok: boolean;
  upstream?: string;
  updatedAt?: string;
  title?: string;
  atlantic?: any[];
  metropolitan?: any[];
  wildcards?: any[];
  error?: string;
  status?: number;
  statusText?: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: any, fallback = 0) {
  return typeof v === "number" ? v : fallback;
}

function teamName(row: any) {
  return (
    safeStr(row?.teamName?.default) ||
    safeStr(row?.teamName) ||
    safeStr(row?.teamCommonName?.default) ||
    safeStr(row?.teamCommonName) ||
    safeStr(row?.teamAbbrev?.default) ||
    safeStr(row?.teamAbbrev) ||
    "—"
  );
}

function teamLogo(row: any) {
  return safeStr(row?.teamLogo) || safeStr(row?.logo) || "";
}

function SlotRow({ r }: { r: any }) {
  const slot = safeStr(r?._slot) || "—";
  const name = teamName(r);
  const logo = teamLogo(r);

  const gp = num(r?.gamesPlayed);
  const w = num(r?.wins);
  const l = num(r?.losses);
  const otl = num(r?.otLosses);
  const pts = num(r?.points);

  return (
    <div className="rounded-2xl border border-white/15 bg-black/80 px-6 py-5">
      <div className="flex items-center justify-between gap-6">
        {/* Left */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="text-white/60 font-bold tabular-nums w-12 text-2xl">
            {slot}
          </div>

          {logo ? (
            <img
              src={logo}
              alt={`${name} logo`}
              className="w-14 h-14"
              loading="lazy"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-white/10" />
          )}

          <div className="text-white font-extrabold text-3xl truncate">
            {name}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-6 tabular-nums shrink-0">
          <div className="text-right">
            <div className="text-xs text-white/50">GP</div>
            <div className="text-2xl font-semibold">{gp}</div>
          </div>

          <div className="text-right">
            <div className="text-xs text-white/50">W</div>
            <div className="text-2xl font-semibold">{w}</div>
          </div>

          <div className="text-right">
            <div className="text-xs text-white/50">L</div>
            <div className="text-2xl font-semibold">{l}</div>
          </div>

          <div className="text-right">
            <div className="text-xs text-white/50">OTL</div>
            <div className="text-2xl font-semibold">{otl}</div>
          </div>

          <div className="text-right">
            <div className="text-xs text-white/60">PTS</div>
            <div className="text-3xl font-extrabold">{pts}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: any[] }) {
  return (
    <div className="space-y-4">
      <div className="text-3xl font-extrabold text-white/90">{title}</div>
      <div className="space-y-4">
        {rows.map((r, i) => (
          <SlotRow key={`${safeStr(r?._slot) || title}-${i}`} r={r} />
        ))}
      </div>
    </div>
  );
}

export default function EastPlayoffsClient() {
  const [resp, setResp] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulledAt, setPulledAt] = useState<Date | null>(null);

  async function load(opts?: { bypassCache?: boolean }) {
    setLoading(true);
    try {
      const url = opts?.bypassCache
        ? "/api/nhl/playoffs/east?nocache=1"
        : "/api/nhl/playoffs/east";

      const r = await fetch(url, { cache: "no-store" });

      const ct = r.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await r.text();
        throw new Error(
          `Expected JSON but got ${ct || "unknown"}.\n` +
            `Status: ${r.status} ${r.statusText}\n` +
            `Body starts with: ${text.slice(0, 140)}`
        );
      }

      const j = (await r.json()) as ApiResponse;
      setResp(j);
      setPulledAt(new Date());
    } catch (e) {
      setResp({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = window.setInterval(() => load(), 60 * 60 * 1000); // hourly
    return () => window.clearInterval(id);
  }, []);

  const atl = useMemo(
    () => (Array.isArray(resp?.atlantic) ? resp!.atlantic! : []),
    [resp]
  );
  const met = useMemo(
    () => (Array.isArray(resp?.metropolitan) ? resp!.metropolitan! : []),
    [resp]
  );
  const wc = useMemo(
    () => (Array.isArray(resp?.wildcards) ? resp!.wildcards! : []),
    [resp]
  );

  return (
    <div className="space-y-10">
    {/* Header */}
    <div className="space-y-2">
      <div className="text-sm text-white/50">
        {loading ? "Updating…" : "Playoff Picture"}
        {pulledAt ? ` • Updated ${pulledAt.toLocaleTimeString()}` : ""}
        {resp?.updatedAt
          ? ` • API ${new Date(resp.updatedAt).toLocaleTimeString()}`
          : ""}
      </div>

      <button
        onClick={() => load({ bypassCache: true })}
        className="text-sm px-4 py-2 rounded border border-white/20 text-white/80 hover:text-white hover:border-white/40 hover:bg-white/5"
        title="Force refresh (bypass cache)"
      >
        Refresh
      </button>
    </div>

      {/* Error */}
      {!resp?.ok && (
        <div className="p-8 rounded-3xl border border-red-400/40 bg-red-500/10 text-white">
          <div className="font-extrabold text-4xl">Failed to load playoff picture</div>
          <pre className="text-2xl mt-4 whitespace-pre-wrap text-white/80">
            {resp?.error ||
              `${resp?.status ?? ""} ${resp?.statusText ?? ""}` ||
              "Unknown error"}
          </pre>
        </div>
      )}

      {/* Sections */}
      {resp?.ok && (
        <div className="space-y-10">
          <Section title="Atlantic — Top 3" rows={atl} />
          <Section title="Metropolitan — Top 3" rows={met} />
          <Section title="Wild Cards — Top 2 (East)" rows={wc} />

          <div className="text-xl text-white/35 pt-2">
            Source: {resp?.upstream ?? "—"}
          </div>
        </div>
      )}
    </div>
  );
}