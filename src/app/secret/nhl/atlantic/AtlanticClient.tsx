"use client";

import { useEffect, useMemo, useState } from "react";

type ApiResponse = {
  ok: boolean;
  upstream?: string;
  updatedAt?: string;
  division?: string;
  data?: any[];
  error?: string;
  status?: number;
  statusText?: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v : "";
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

function teamAbbrev(row: any) {
  return safeStr(row?.teamAbbrev?.default) || safeStr(row?.teamAbbrev) || "";
}

function teamLogo(row: any) {
  return safeStr(row?.teamLogo) || safeStr(row?.logo) || "";
}

function num(v: any, fallback = 0) {
  return typeof v === "number" ? v : fallback;
}

export default function AtlanticClient() {
  const [resp, setResp] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdatedLocal, setLastUpdatedLocal] = useState<Date | null>(null);

  async function load(opts?: { bypassCache?: boolean }) {
    setLoading(true);
    try {
      const url = opts?.bypassCache ? "/api/nhl/standings?nocache=1" : "/api/nhl/standings";
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
      setLastUpdatedLocal(new Date());
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

  const rows = useMemo(() => (Array.isArray(resp?.data) ? resp!.data! : []), [resp]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-base text-white/80">
            {loading ? "Updating…" : "Standings"}
          </div>
          <div className="text-sm text-white/50">
            {lastUpdatedLocal ? `Pulled: ${lastUpdatedLocal.toLocaleTimeString()}` : ""}
            {resp?.updatedAt ? ` • API: ${new Date(resp.updatedAt).toLocaleTimeString()}` : ""}
          </div>
        </div>

        <button
          onClick={() => load({ bypassCache: true })}
          className="text-base px-4 py-2 rounded border border-white/20 text-white/80 hover:text-white hover:border-white/40 hover:bg-white/5"
          title="Force refresh (bypass 1-hour cache)"
        >
          Refresh
        </button>
      </div>

      {/* Error */}
      {!resp?.ok && (
        <div className="p-4 rounded-xl border border-red-400/40 bg-red-500/10 text-white">
          <div className="font-medium text-lg">Failed to load standings</div>
          <pre className="text-sm mt-2 whitespace-pre-wrap text-white/80">
            {resp?.error ||
              `${resp?.status ?? ""} ${resp?.statusText ?? ""}` ||
              "Unknown error"}
          </pre>
        </div>
      )}

      {/* Table */}
      {resp?.ok && (
        <div className="rounded-2xl border border-white/15 bg-black/70 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 text-white/80 text-sm">
            Atlantic Division
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-white">
              <thead className="text-xs text-white/60">
                <tr className="border-b border-white/10">
                  <th className="text-left px-5 py-3 w-12">#</th>
                  <th className="text-left px-5 py-3">Team</th>
                  <th className="text-right px-4 py-3">GP</th>
                  <th className="text-right px-4 py-3">W</th>
                  <th className="text-right px-4 py-3">L</th>
                  <th className="text-right px-4 py-3">OTL</th>
                  <th className="text-right px-4 py-3">PTS</th>
                </tr>
              </thead>

              <tbody className="text-base">
                {rows.map((r: any, idx: number) => {
                  const name = teamName(r);
                  const abbr = teamAbbrev(r);
                  const logo = teamLogo(r);

                  const gp = num(r?.gamesPlayed);
                  const w = num(r?.wins);
                  const l = num(r?.losses);
                  const otl = num(r?.otLosses);
                  const pts = num(r?.points);

                  return (
                    <tr key={`${abbr || name}-${idx}`} className="border-b border-white/5">
                      <td className="px-5 py-4 text-white/70">{idx + 1}</td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {logo ? (
                            <img
                              src={logo}
                              alt={`${abbr || name} logo`}
                              className="w-8 h-8"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-white/10" />
                          )}

                          <div className="min-w-0">
                            <div className="font-semibold truncate">{name}</div>
                            {abbr ? (
                              <div className="text-xs text-white/50">{abbr}</div>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-right tabular-nums">{gp}</td>
                      <td className="px-4 py-4 text-right tabular-nums">{w}</td>
                      <td className="px-4 py-4 text-right tabular-nums">{l}</td>
                      <td className="px-4 py-4 text-right tabular-nums">{otl}</td>
                      <td className="px-4 py-4 text-right tabular-nums font-extrabold">
                        {pts}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 text-xs text-white/35">
            Source: {resp?.upstream ?? "—"}
          </div>
        </div>
      )}
    </div>
  );
}