"use client";

import { useEffect, useMemo, useState } from "react";

type ApiResponse = {
  ok: boolean;
  upstream?: string;
  date?: string;
  data?: any;
  error?: string;
  status?: number;
  statusText?: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function fmtLocalTimeFromUTC(utc: string) {
  if (!utc) return "";
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function broadcastsLine(game: any) {
  const tv = Array.isArray(game?.tvBroadcasts) ? game.tvBroadcasts : [];
  const names = tv.map((x: any) => safeStr(x?.network)).filter(Boolean);

  const unique: string[] = [];
  for (const n of names) if (!unique.includes(n)) unique.push(n);

  if (!unique.length) return "";
  return `TV: ${unique.slice(0, 6).join(", ")}${unique.length > 6 ? "…" : ""}`;
}

function venueLine(game: any) {
  return safeStr(game?.venue?.default ?? game?.venue?.name);
}

function getDisplayName(team: any) {
  return safeStr(team?.name?.default) || safeStr(team?.abbrev) || "—";
}

function getAbbrev(team: any) {
  return safeStr(team?.abbrev) || "—";
}

function getLogo(team: any): string {
  return safeStr(team?.logo);
}

function isFinal(game: any) {
  const state = safeStr(game?.gameState);
  return state === "FINAL" || state === "OFF";
}

function deriveEndType(game: any): "REG" | "OT" | "SO" | "" {
  const end = safeStr(game?.gameOutcome?.lastPeriodType);
  if (end === "REG" || end === "OT" || end === "SO") return end as any;

  const pd = game?.periodDescriptor;
  const pt = safeStr(pd?.periodType);
  if (pt === "REG" || pt === "OT" || pt === "SO") return pt as any;

  const num = typeof pd?.number === "number" ? pd.number : 0;
  const maxReg =
    typeof pd?.maxRegulationPeriods === "number"
      ? pd.maxRegulationPeriods
      : 3;

  if (num > maxReg) return "OT";

  return "";
}

function liveMiniStatus(game: any): string {
  const pd = game?.periodDescriptor;
  const num = typeof pd?.number === "number" ? pd.number : 0;
  const pt = safeStr(pd?.periodType);
  const rem = safeStr(game?.clock?.timeRemaining);

  if (pt === "SO") return "SO";

  if (pt === "OT") {
    const maxReg =
      typeof pd?.maxRegulationPeriods === "number"
        ? pd.maxRegulationPeriods
        : 3;
    const otIndex = num > maxReg ? num - maxReg : 1;
    const otLabel = otIndex > 1 ? `OT${otIndex}` : "OT";
    return rem ? `${otLabel} ${rem}` : otLabel;
  }

  if (num > 0) return rem ? `P${num} ${rem}` : `P${num}`;

  return "LIVE";
}

function centerUnderDashLabel(game: any): string {
  if (isFinal(game)) {
    const endType = deriveEndType(game);
    if (endType === "OT") return "F / OT";
    if (endType === "SO") return "F / SO";
    return "F";
  }

  const state = safeStr(game?.gameState);
  if (state === "LIVE" || state === "CRIT") return liveMiniStatus(game);

  const start = safeStr(game?.startTimeUTC);
  const t = fmtLocalTimeFromUTC(start);
  return t ? `@ ${t}` : "—";
}

export default function ScoresClient() {
  const [resp, setResp] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/nhl/scores", { cache: "no-store" });
      const ct = r.headers.get("content-type") || "";

      if (!ct.includes("application/json")) {
        const text = await r.text();
        throw new Error(
          `Expected JSON but got ${ct || "unknown"}.\n` +
            `Status: ${r.status} ${r.statusText}\n` +
            text.slice(0, 140)
        );
      }

      const j = (await r.json()) as ApiResponse;
      setResp(j);
      setLastUpdated(new Date());
    } catch (e) {
      setResp({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const games = useMemo(() => {
    const d = resp?.data;
    if (d?.games && Array.isArray(d.games)) return d.games;
    return [];
  }, [resp]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-base text-white/80">
            {loading ? "Updating…" : "Live"}
          </div>
          <div className="text-sm text-white/50">
            {resp?.date ? `Showing date: ${resp.date}` : ""}
            {lastUpdated
              ? ` • Updated: ${lastUpdated.toLocaleTimeString()}`
              : ""}
          </div>
        </div>

        <button
          onClick={load}
          className="text-base px-4 py-2 rounded border border-white/20 text-white/80 hover:text-white hover:border-white/40 hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      {!resp?.ok && (
        <div className="p-4 rounded-xl border border-red-400/40 bg-red-500/10 text-white">
          <div className="font-medium text-lg">Failed to load scores</div>
          <pre className="text-sm mt-2 whitespace-pre-wrap text-white/80">
            {resp?.error ||
              `${resp?.status ?? ""} ${resp?.statusText ?? ""}` ||
              "Unknown error"}
          </pre>
        </div>
      )}

      <div className="space-y-5">
        {games.map((g: any) => {
          const away = g?.awayTeam ?? {};
          const home = g?.homeTeam ?? {};

          const awayName = getDisplayName(away);
          const homeName = getDisplayName(home);

          const awayAbbrev = getAbbrev(away);
          const homeAbbrev = getAbbrev(home);

          const awayLogo = getLogo(away);
          const homeLogo = getLogo(home);

          const awayScore =
            typeof away?.score === "number" ? away.score : 0;
          const homeScore =
            typeof home?.score === "number" ? home.score : 0;

          const venue = venueLine(g);
          const tv = broadcastsLine(g);
          const centerLabel = centerUnderDashLabel(g);

          const key =
            g?.id ??
            `${awayAbbrev}-${homeAbbrev}-${safeStr(g?.startTimeUTC) || "na"}`;

          return (
            <div
              key={key}
              className="rounded-2xl border border-white/15 bg-black/70 px-6 py-4"
            >
              <div className="flex items-center justify-between gap-6">
                <div className="flex-1 text-white font-semibold text-xl truncate">
                  {awayName}
                </div>

                <div className="flex items-center gap-10 shrink-0">
                  {awayLogo ? (
                    <img
                      src={awayLogo}
                      alt={`${awayAbbrev} logo`}
                      className="w-24 h-24"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded bg-white/10" />
                  )}

                  <div className="text-white font-extrabold text-5xl tabular-nums">
                    {awayScore}
                  </div>

                  <div className="flex flex-col items-center leading-none">
                    <div className="text-white/50 font-bold text-3xl">
                      -
                    </div>
                    <div className="mt-2 text-white font-extrabold text-4xl tabular-nums">
                      {centerLabel}
                    </div>
                  </div>

                  <div className="text-white font-extrabold text-5xl tabular-nums">
                    {homeScore}
                  </div>

                  {homeLogo ? (
                    <img
                      src={homeLogo}
                      alt={`${homeAbbrev} logo`}
                      className="w-24 h-24"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded bg-white/10" />
                  )}
                </div>

                <div className="flex-1 text-white font-semibold text-xl truncate text-right">
                  {homeName}
                </div>
              </div>

              <div className="mt-4 text-sm text-white/60 flex flex-wrap gap-x-4 gap-y-2">
                {venue && <span>{venue}</span>}
                {tv && <span>• {tv}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-sm text-white/35">
        Source: {resp?.upstream ?? "—"}
      </div>
    </div>
  );
}