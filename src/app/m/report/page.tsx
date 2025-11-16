// src/app/m/report/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { teamSlug } from "@/lib/slug";

type TabKey = "current" | "matchups" | "standings" | "report" | "indstats";
type Role = "player" | "captain" | "admin";

type GameRow = {
  rowIndex: number;
  game: string;
  away: {
    id: string;
    name: string;
    team: string;
    wins: string;
    losses: string;
    pts: string;
    plms: string;
  };
  home: {
    id: string;
    name: string;
    team: string;
    wins: string;
    losses: string;
    pts: string;
    plms: string;
  };
  scenario: string;
  alreadyFilled: boolean;
  isMyGame: boolean;
  canEditAwayId: boolean;
  canEditHomeId: boolean;
};

type FoundPayload = {
  ok: true;
  weekTab: string;
  role: Role;
  games: GameRow[];
};

type NotOk =
  | {
      ok: false;
      reason:
        | "NOT_AUTH"
        | "NO_DISCORD_ID"
        | "NO_NCXID"
        | "NO_GAME_FOUND"
        | "SERVER_ERROR";
    };

const SCENARIOS = ["ANCIENT", "CHANCE", "ASSAULT", "SCRAMBLE", "SALVAGE"] as const;

export default function MobileReportPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FoundPayload | NotOk | null>(null);

  // which game index in data.games
  const [selectedIndex, setSelectedIndex] = useState(0);

  // form state
  const [awayPts, setAwayPts] = useState("");
  const [homePts, setHomePts] = useState("");
  const [scenario, setScenario] = useState("");
  const [awayId, setAwayId] = useState("");
  const [homeId, setHomeId] = useState("");
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  // Load manageable games
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setNotice("");
      try {
        const res = await fetch("/api/report-game", { method: "GET" });
        const json = await res.json();

        if (!alive) return;

        if (!json?.ok) {
          setData(json);
          return;
        }

        const payload = json as FoundPayload;
        setData(payload);

        const games = payload.games ?? [];
        if (games.length > 0) {
          const myIndex = games.findIndex((g: GameRow) => g.isMyGame);
          const idx = myIndex >= 0 ? myIndex : 0;
          setSelectedIndex(idx);

          const g = games[idx];
          setAwayPts(g.away.pts || "");
          setHomePts(g.home.pts || "");
          setScenario(g.scenario || "");
          setAwayId(g.away.id || "");
          setHomeId(g.home.id || "");
          setConfirmOverwrite(false);
        }
      } catch {
        if (alive) {
          setData({ ok: false, reason: "SERVER_ERROR" });
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const selectedGame: GameRow | null = useMemo(() => {
    if (!data || !data.ok) return null;
    if (!data.games || data.games.length === 0) return null;
    if (selectedIndex < 0 || selectedIndex >= data.games.length)
      return data.games[0];
    return data.games[selectedIndex];
  }, [data, selectedIndex]);

  const canSubmit = useMemo(() => {
    if (!data || !data.ok || !selectedGame) return false;
    if (awayPts === "" || homePts === "" || !scenario) return false;
    if (selectedGame.alreadyFilled && !confirmOverwrite) return false;
    return true;
  }, [data, selectedGame, awayPts, homePts, scenario, confirmOverwrite]);

  async function submit() {
    if (!data || !data.ok || !selectedGame) return;
    setSubmitting(true);
    setNotice("");

    try {
      const res = await fetch("/api/report-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowIndex: selectedGame.rowIndex,
          awayPts: Number(awayPts),
          homePts: Number(homePts),
          scenario,
          force: confirmOverwrite,
          newAwayId: awayId,
          newHomeId: homeId,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json?.reason === "ALREADY_FILLED") {
          setNotice(
            "Already filled. Check 'Confirm overwrite' to proceed."
          );
          return;
        }
        setNotice("Submission failed. " + (json?.reason ?? ""));
        return;
      }

      setNotice("✅ Report saved!");
      // mobile: go back to matchups view
      setTimeout(() => {
        window.location.assign("/m/matchups");
      }, 900);
    } catch {
      setNotice("Something went wrong submitting.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSelectGame(idx: number) {
    if (!data || !data.ok || !data.games[idx]) return;
    const g = data.games[idx];
    setSelectedIndex(idx);
    setAwayPts(g.away.pts || "");
    setHomePts(g.home.pts || "");
    setScenario(g.scenario || "");
    setAwayId(g.away.id || "");
    setHomeId(g.home.id || "");
    setConfirmOverwrite(false);
    setNotice("");
  }

  function TeamLogo({ name }: { name: string }) {
    const slug = teamSlug(name);
    if (!slug) return null;
    return (
      <Image
        src={`/logos/${slug}.png`}
        alt={`${name} logo`}
        width={20}
        height={20}
        className="inline-block mr-1 object-contain"
        unoptimized
        loading="lazy"
        decoding="async"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  // ---------- RENDER STATES ----------

  if (loading) {
    return (
      <div className="p-4 text-center text-neutral-400">
        Loading your matchups…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-center text-neutral-400">
        Could not load.
      </div>
    );
  }

  if (!data.ok) {
    let msg = "Something went wrong.";
    if (data.reason === "NOT_AUTH")
      msg = "Please sign in via Discord to report a game.";
    if (data.reason === "NO_DISCORD_ID")
      msg = "No Discord ID found. Try logging out/in.";
    if (data.reason === "NO_NCXID")
      msg = "We couldn't find your NCXID in the sheet.";
    if (data.reason === "NO_GAME_FOUND")
      msg = "We couldn't find any games for you to manage this week.";
    if (data.reason === "SERVER_ERROR")
      msg = "Server error while loading games.";

    return (
      <div className="p-4 text-center text-neutral-400">
        {msg}
      </div>
    );
  }

  if (!selectedGame) {
    return (
      <div className="p-4 text-center text-neutral-400">
        No games available to report this week.
      </div>
    );
  }

  const { weekTab, role } = data;
  const {
    game,
    away,
    home,
    alreadyFilled,
    canEditAwayId,
    canEditHomeId,
  } = selectedGame;

  return (
    <div className="space-y-5 p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold text-pink-400">
            Report — <span className="text-white">{weekTab}</span>
          </h2>
          <span className="mt-0.5 text-[11px] text-neutral-400">
            Role:{" "}
            <span className="font-medium text-neutral-200 capitalize">
              {role}
            </span>
          </span>
        </div>
        <span
          className={`text-[11px] px-2 py-1 rounded-full border ${
            alreadyFilled
              ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-300"
              : "border-purple-400/50 bg-purple-500/10 text-purple-300"
          }`}
        >
          Game #{game}
        </span>
      </div>

      {/* Game selector for captains/admins who manage multiple games */}
      {data.games.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {data.games.map((g, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={`${g.rowIndex}-${g.game}`}
                type="button"
                onClick={() => handleSelectGame(idx)}
                className={`px-3 py-1 rounded-full border text-[11px] transition-colors ${
                  isSelected
                    ? "border-pink-400 bg-pink-500/20 text-pink-100"
                    : "border-neutral-700 bg-neutral-900/70 text-neutral-300 hover:border-pink-400/70"
                }`}
              >
                <span className="font-semibold">G{g.game}</span>{" "}
                <span className="opacity-80">
                  {g.away.team || "—"} vs {g.home.team || "—"}
                </span>
                {g.isMyGame && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-semibold text-emerald-200">
                    MY GAME
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Team cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Away */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3 space-y-2">
          <div className="text-xs text-neutral-400 mb-1">Away</div>
          <div className="flex items-center gap-1 text-sm font-semibold">
            <TeamLogo name={away.team} />
            <span className="text-neutral-200">{away.team || "—"}</span>
          </div>
          <div className="mt-1 text-xs text-neutral-400 flex flex-col gap-1">
            <span className="font-medium text-white">
              {away.name || "—"}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-neutral-400">NCX ID:</span>
              {canEditAwayId ? (
                <input
                  type="text"
                  value={awayId}
                  onChange={(e) => setAwayId(e.target.value)}
                  className="w-20 rounded bg-neutral-900 border border-neutral-700 px-2 py-1 text-[11px] text-neutral-100 outline-none focus:border-pink-400/70"
                  placeholder="e.g. 23"
                />
              ) : (
                <span className="text-[11px] bg-neutral-800 px-2 py-0.5 rounded">
                  {away.id || "—"}
                </span>
              )}
            </div>
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            W-L:{" "}
            <span className="text-neutral-200">
              {away.wins || 0}-{away.losses || 0}
            </span>{" "}
            • PL/MS:{" "}
            <span className="text-neutral-200">{away.plms || "-"}</span>
          </div>
        </div>

        {/* Home */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3 space-y-2">
          <div className="text-xs text-neutral-400 mb-1">Home</div>
          <div className="flex items-center gap-1 text-sm font-semibold">
            <TeamLogo name={home.team} />
            <span className="text-neutral-200">{home.team || "—"}</span>
          </div>
          <div className="mt-1 text-xs text-neutral-400 flex flex-col gap-1">
            <span className="font-medium text-white">
              {home.name || "—"}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-neutral-400">NCX ID:</span>
              {canEditHomeId ? (
                <input
                  type="text"
                  value={homeId}
                  onChange={(e) => setHomeId(e.target.value)}
                  className="w-20 rounded bg-neutral-900 border border-neutral-700 px-2 py-1 text-[11px] text-neutral-100 outline-none focus:border-pink-400/70"
                  placeholder="e.g. 17"
                />
              ) : (
                <span className="text-[11px] bg-neutral-800 px-2 py-0.5 rounded">
                  {home.id || "—"}
                </span>
              )}
            </div>
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            W-L:{" "}
            <span className="text-neutral-200">
              {home.wins || 0}-{home.losses || 0}
            </span>{" "}
            • PL/MS:{" "}
            <span className="text-neutral-200">{home.plms || "-"}</span>
          </div>
        </div>
      </div>

      {/* Scores + scenario */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs text-neutral-400">Away Score</span>
          <input
            type="number"
            min={0}
            value={awayPts}
            onChange={(e) => setAwayPts(e.target.value)}
            className="mt-1 w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-pink-400/60"
          />
        </label>

        <label className="block">
          <span className="text-xs text-neutral-400">Home Score</span>
          <input
            type="number"
            min={0}
            value={homePts}
            onChange={(e) => setHomePts(e.target.value)}
            className="mt-1 w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-pink-400/60"
          />
        </label>

        <label className="block">
          <span className="text-xs text-neutral-400">Scenario</span>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            className="mt-1 w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-pink-400/60"
          >
            <option value="">Choose…</option>
            {SCENARIOS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {alreadyFilled && (
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={confirmOverwrite}
            onChange={(e) => setConfirmOverwrite(e.target.checked)}
          />
          Confirm overwrite (scores already exist for this game)
        </label>
      )}

      <button
        onClick={submit}
        disabled={!canSubmit || submitting}
        className="w-full rounded-xl bg-gradient-to-r from-pink-600 via-purple-500 to-cyan-500 py-3 text-sm font-semibold text-white shadow disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit Report"}
      </button>

      {notice && (
        <p className="text-center text-sm text-neutral-300">{notice}</p>
      )}
    </div>
  );
}
