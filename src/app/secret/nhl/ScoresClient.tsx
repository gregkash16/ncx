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

type GameDetailsResponse = {
  ok: boolean;
  refreshSeconds?: number;
  data?: any;
  error?: string;
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
  return names.length ? `TV: ${names.join(", ")}` : "";
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

function centerUnderDashLabel(game: any): string {
  const state = safeStr(game?.gameState);

  // FINAL handling with OT / SO detection
  if (state === "FINAL" || state === "OFF") {
    const endType =
      safeStr(game?.gameOutcome?.lastPeriodType) ||
      safeStr(game?.periodDescriptor?.periodType);

    if (endType === "OT") return "F / OT";
    if (endType === "SO") return "F / SO";
    return "F";
  }

  // LIVE handling
  if (state === "LIVE" || state === "CRIT") {
    const period = game?.periodDescriptor?.number;
    const rem = safeStr(game?.clock?.timeRemaining);

    if (period && rem) return `P${period} ${rem}`;
    if (period) return `P${period}`;
    return "LIVE";
  }

  // Pre-game
  const start = safeStr(game?.startTimeUTC);
  const t = fmtLocalTimeFromUTC(start);
  return t ? `@ ${t}` : "—";
}

export default function ScoresClient() {
  const [resp, setResp] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [selectedGame, setSelectedGame] = useState<any | null>(null);
  const [detail, setDetail] = useState<GameDetailsResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadScores() {
    setLoading(true);
    try {
      const r = await fetch("/api/nhl/scores", { cache: "no-store" });
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

  async function loadDetails(game: any) {
    const gameId = String(game?.id ?? "");
    if (!/^\d+$/.test(gameId)) return;

    setSelectedGame(game);
    setDetail(null);
    setDetailLoading(true);

    window.scrollTo({ top: 0, behavior: "smooth" });

    try {
      const r = await fetch(`/api/nhl/game?gameId=${gameId}`, {
        cache: "no-store",
      });
      const j = (await r.json()) as GameDetailsResponse;
      setDetail(j);
    } catch (e) {
      setDetail({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setDetailLoading(false);
    }
  }

  function backToList() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setSelectedGame(null);
    setDetail(null);
    setDetailLoading(false);
  }

  useEffect(() => {
    loadScores();
    const id = window.setInterval(loadScores, 60000);
    return () => window.clearInterval(id);
  }, []);

  const games = useMemo(() => {
    const d = resp?.data;
    return d?.games && Array.isArray(d.games) ? d.games : [];
  }, [resp]);

  const panel = selectedGame ? "details" : "list";

  const away = selectedGame?.awayTeam ?? {};
  const home = selectedGame?.homeTeam ?? {};

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
          onClick={loadScores}
          className="text-base px-4 py-2 rounded border border-white/20 text-white/80 hover:text-white hover:border-white/40 hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-hidden">
        <div
          className={[
            "flex w-[200%] transition-transform duration-300 ease-out",
            panel === "details" ? "-translate-x-1/2" : "translate-x-0",
          ].join(" ")}
        >
          {/* LEFT SIDE — FULL ORIGINAL VISUALS RESTORED */}
          <div className="w-1/2 pr-3">
            <div className="space-y-5">
              {games.map((g: any) => {
                const awayT = g?.awayTeam ?? {};
                const homeT = g?.homeTeam ?? {};

                const key = g?.id ?? Math.random();

                return (
                  <button
                    key={key}
                    onClick={() => loadDetails(g)}
                    className="w-full text-left rounded-2xl border border-white/15 bg-black/70 px-6 py-4 hover:bg-white/5 hover:border-white/25 transition"
                  >
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex-1 text-white font-semibold text-xl truncate">
                        {getDisplayName(awayT)}
                      </div>

                      <div className="flex items-center gap-10 shrink-0">
                        {getLogo(awayT) ? (
                          <img
                            src={getLogo(awayT)}
                            alt={`${getAbbrev(awayT)} logo`}
                            className="w-24 h-24"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-24 h-24 rounded bg-white/10" />
                        )}

                        <div className="text-white font-extrabold text-5xl tabular-nums">
                          {awayT.score ?? 0}
                        </div>

                        <div className="flex flex-col items-center leading-none">
                          <div className="text-white/50 font-bold text-3xl">-</div>
                          <div className="mt-2 text-white font-extrabold text-4xl tabular-nums">
                            {centerUnderDashLabel(g)}
                          </div>
                        </div>

                        <div className="text-white font-extrabold text-5xl tabular-nums">
                          {homeT.score ?? 0}
                        </div>

                        {getLogo(homeT) ? (
                          <img
                            src={getLogo(homeT)}
                            alt={`${getAbbrev(homeT)} logo`}
                            className="w-24 h-24"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-24 h-24 rounded bg-white/10" />
                        )}
                      </div>

                      <div className="flex-1 text-white font-semibold text-xl truncate text-right">
                        {getDisplayName(homeT)}
                      </div>
                    </div>

                    <div className="mt-4 text-sm text-white/60">
                      {venueLine(g)}
                      {broadcastsLine(g)
                        ? ` • ${broadcastsLine(g)}`
                        : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DETAILS SIDE — ONLY DATA CHANGED */}
          <div className="w-1/2 pl-3">
            <div className="rounded-2xl border border-white/15 bg-black/70 px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={backToList}
                  className="px-3 py-2 rounded border border-white/20 text-white/80 hover:text-white hover:border-white/40 hover:bg-white/5"
                >
                  ← Back
                </button>
              </div>

              {detailLoading && (
                <div className="mt-6 text-white/70">
                  Loading game details…
                </div>
              )}

              {!detailLoading && detail?.ok && (
  <div className="mt-6 space-y-6">
    {/* SCORE HEADER */}
    <div className="text-white text-2xl font-bold">
      {detail.data.away.name} {detail.data.away.score} —{" "}
      {detail.data.home.score} {detail.data.home.name}
    </div>

    {/* GOAL SCORERS */}
    <div>
      <div className="text-white font-semibold text-lg">
        Goal scorers
      </div>

      {detail.data.goals.length === 0 ? (
        <div className="mt-2 text-white/60 text-sm">
          No goals yet.
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          {(() => {
            let lastPeriod: string | null = null;

            return detail.data.goals.map((g: any, i: number) => {
              const isNewPeriod = g.period !== lastPeriod;
              lastPeriod = g.period;

              const scoringTeam =
                g.team === detail.data.home.abbrev
                  ? detail.data.home
                  : detail.data.away;

              return (
                <div key={i} className="space-y-2">
                  {isNewPeriod && (
                    <div className="text-white/50 text-xl mt-4">
                      {g.period}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-white/90 text-2xl rounded-lg border border-white/10 bg-white/5 px-5 py-4">
                    {scoringTeam.logo && (
                      <img
                        src={scoringTeam.logo}
                        alt={`${scoringTeam.abbrev} logo`}
                        className="w-15 h-15"
                      />
                    )}

                    <div>
                      {g.time} — {g.scorer}
                      {g.assists?.length
                        ? ` (Ast: ${g.assists.join(", ")})`
                        : ""}
                      {g.strength ? ` • ${g.strength}` : ""}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>

    {/* TEAM STATS (now using normalized API data) */}
    <div>
      <div className="text-white font-semibold text-lg">
        Team stats
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {["shots", "hits", "blocked", "pim"].map(
          (stat) => (
            <div
              key={stat}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="text-white/60 text-2xl uppercase">
                {stat}
              </div>
              <div className="mt-1 text-white text-2xl font-semibold">
                {detail.data.away.abbrev}:{" "}
                {detail.data.away[stat] ?? "—"}{" "}
                <span className="text-white/40">|</span>{" "}
                {detail.data.home.abbrev}:{" "}
                {detail.data.home[stat] ?? "—"}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  </div>
)}

              {!detailLoading && detail && !detail.ok && (
                <div className="mt-6 text-red-400">
                  {detail.error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}