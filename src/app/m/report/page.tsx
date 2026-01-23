// src/app/m/report/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { teamSlug } from "@/lib/slug";

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
  awayList?: string;
  homeList?: string;
};

type FoundPayload = {
  ok: true;
  weekTab: string;
  role: Role;
  games: GameRow[];
};

type NotOk = {
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

  const [selectedIndex, setSelectedIndex] = useState(0);

  const [awayPts, setAwayPts] = useState("");
  const [homePts, setHomePts] = useState("");
  const [scenario, setScenario] = useState("");
  const [awayId, setAwayId] = useState("");
  const [homeId, setHomeId] = useState("");
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const [awayList, setAwayList] = useState("");
  const [homeList, setHomeList] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

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
          setAwayList(g.awayList || "");
          setHomeList(g.homeList || "");
          setConfirmOverwrite(false);
        }
      } catch {
        if (alive) setData({ ok: false, reason: "SERVER_ERROR" });
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
    if (selectedIndex < 0 || selectedIndex >= data.games.length) return data.games[0];
    return data.games[selectedIndex];
  }, [data, selectedIndex]);

  const editingScores = useMemo(() => {
    if (!selectedGame) return false;
    return (
      awayPts !== (selectedGame.away.pts || "") ||
      homePts !== (selectedGame.home.pts || "") ||
      scenario !== (selectedGame.scenario || "")
    );
  }, [selectedGame, awayPts, homePts, scenario]);

  const editingIds = useMemo(() => {
    if (!selectedGame) return false;
    return awayId !== (selectedGame.away.id || "") || homeId !== (selectedGame.home.id || "");
  }, [selectedGame, awayId, homeId]);

  const editingLists = useMemo(() => {
    if (!selectedGame) return false;
    return awayList !== (selectedGame.awayList || "") || homeList !== (selectedGame.homeList || "");
  }, [selectedGame, awayList, homeList]);

  const canSubmit = useMemo(() => {
    if (!data || !data.ok || !selectedGame) return false;

    if (!editingScores && !editingIds && !editingLists) return false;

    if (editingScores) {
      if (awayPts === "" || homePts === "" || !scenario) return false;
      if (selectedGame.alreadyFilled && !confirmOverwrite) return false;
    }

    return true;
  }, [
    data,
    selectedGame,
    editingScores,
    editingIds,
    editingLists,
    awayPts,
    homePts,
    scenario,
    confirmOverwrite,
  ]);

  async function submit() {
    if (!data || !data.ok || !selectedGame) return;
    setSubmitting(true);
    setNotice("");

    try {
      const payload: any = {
        rowIndex: selectedGame.rowIndex,
        force: confirmOverwrite,
        newAwayId: awayId,
        newHomeId: homeId,
        awayList: awayList.trim(),
        homeList: homeList.trim(),
      };

      if (editingScores) {
        payload.awayPts = Number(awayPts);
        payload.homePts = Number(homePts);
        payload.scenario = scenario;
      }

      const res = await fetch("/api/report-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json?.reason === "ALREADY_FILLED") {
          setNotice("Already filled. Check 'Confirm overwrite' to proceed.");
          return;
        }
        if (json?.reason === "BAD_LIST_LINK") {
          setNotice(json?.message || "List link looks invalid. Use YASB or LBN.");
          return;
        }
        setNotice("Submission failed. " + (json?.reason ?? ""));
        return;
      }

      setNotice("✅ Report saved!");
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
    setAwayList(g.awayList || "");
    setHomeList(g.homeList || "");
    setConfirmOverwrite(false);
    setNotice("");
  }

  function TeamLogo({ name }: { name: string }) {
    const slug = teamSlug(name);
    if (!slug) return null;
    return (
      <Image
        src={`/logos/${slug}.webp`}
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

  if (loading) {
    return (
      <div className="p-4 text-center text-[var(--ncx-text-muted)]">
        Loading your matchups…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-center text-[var(--ncx-text-muted)]">
        Could not load.
      </div>
    );
  }

  if (!data.ok) {
    let msg = "Something went wrong.";
    if (data.reason === "NOT_AUTH") msg = "Please sign in via Discord to report a game.";
    if (data.reason === "NO_DISCORD_ID") msg = "No Discord ID found. Try logging out/in.";
    if (data.reason === "NO_NCXID") msg = "We couldn't find your NCXID in the sheet.";
    if (data.reason === "NO_GAME_FOUND") msg = "We couldn't find any games for you to manage this week.";
    if (data.reason === "SERVER_ERROR") msg = "Server error while loading games.";

    return <div className="p-4 text-center text-[var(--ncx-text-muted)]">{msg}</div>;
  }

  if (!selectedGame) {
    return (
      <div className="p-4 text-center text-[var(--ncx-text-muted)]">
        No games available to report this week.
      </div>
    );
  }

  const { weekTab, role } = data;
  const { game, away, home, alreadyFilled, canEditAwayId, canEditHomeId } = selectedGame;

  const inputBase =
    "w-full rounded-lg bg-[rgb(0_0_0/0.28)] border border-[var(--ncx-border)] px-3 py-2 outline-none focus:border-[rgb(var(--ncx-primary-rgb)/0.65)]";

  return (
    <div className="space-y-5 p-3 text-[var(--ncx-text-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold">
            <span className="text-[rgb(var(--ncx-secondary-rgb))]">Report</span> —{" "}
            <span className="text-[var(--ncx-text-primary)]">{weekTab}</span>
          </h2>
          <span className="mt-0.5 text-[11px] text-[var(--ncx-text-muted)]">
            Role:{" "}
            <span className="font-medium text-[var(--ncx-text-primary)]/90 capitalize">
              {role}
            </span>
          </span>
        </div>

        <span
          className={`text-[11px] px-2 py-1 rounded-full border ${
            alreadyFilled
              ? "border-[rgb(var(--ncx-primary-rgb)/0.55)] bg-[rgb(var(--ncx-primary-rgb)/0.10)] text-[rgb(var(--ncx-primary-rgb))]"
              : "border-[rgb(var(--ncx-secondary-rgb)/0.55)] bg-[rgb(var(--ncx-secondary-rgb)/0.10)] text-[rgb(var(--ncx-secondary-rgb))]"
          }`}
        >
          Game #{game}
        </span>
      </div>

      {/* Game selector */}
      {data.games.length > 1 && (
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-[var(--ncx-text-primary)]/85">
            Select a game to edit
          </label>
          <select
            value={String(selectedIndex)}
            onChange={(e) => handleSelectGame(Number(e.target.value))}
            className={`${inputBase} text-sm text-[var(--ncx-text-primary)]`}
          >
            {data.games.map((g, idx) => {
              const baseLabel = `G${g.game}: ${g.away.team || "—"} vs ${g.home.team || "—"}`;
              const label = g.isMyGame ? `${baseLabel} • MY GAME` : baseLabel;
              return (
                <option key={`${g.rowIndex}-${g.game}`} value={idx}>
                  {label}
                </option>
              );
            })}
          </select>
          <p className="text-[11px] text-[var(--ncx-text-muted)]">
            Admins and captains can switch between any games they&apos;re allowed to manage.
          </p>
        </div>
      )}

      {/* Team cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Away */}
        <div className="rounded-xl border border-[var(--ncx-border)] bg-[var(--ncx-panel-bg)]/70 p-3 space-y-2">
          <div className="text-xs text-[var(--ncx-text-muted)] mb-1">Away</div>
          <div className="flex items-center gap-1 text-sm font-semibold">
            <TeamLogo name={away.team} />
            <span className="text-[var(--ncx-text-primary)]/90">{away.team || "—"}</span>
          </div>

          <div className="mt-1 text-xs text-[var(--ncx-text-muted)] flex flex-col gap-1">
            <span className="font-medium text-[var(--ncx-text-primary)]">{away.name || "—"}</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--ncx-text-muted)]">NCX ID:</span>
              {canEditAwayId ? (
                <input
                  type="text"
                  value={awayId}
                  onChange={(e) => setAwayId(e.target.value)}
                  className="w-20 rounded bg-[rgb(0_0_0/0.28)] border border-[var(--ncx-border)] px-2 py-1 text-[11px] text-[var(--ncx-text-primary)] outline-none focus:border-[rgb(var(--ncx-primary-rgb)/0.70)]"
                  placeholder="e.g. 23"
                />
              ) : (
                <span className="text-[11px] bg-[rgb(0_0_0/0.30)] border border-[var(--ncx-border)] px-2 py-0.5 rounded">
                  {away.id || "—"}
                </span>
              )}
            </div>
          </div>

          <div className="mt-1 text-[11px] text-[var(--ncx-text-muted)]">
            W-L:{" "}
            <span className="text-[var(--ncx-text-primary)]/90">
              {away.wins || 0}-{away.losses || 0}
            </span>{" "}
            • PL/MS:{" "}
            <span className="text-[var(--ncx-text-primary)]/90">{away.plms || "-"}</span>
          </div>
        </div>

        {/* Home */}
        <div className="rounded-xl border border-[var(--ncx-border)] bg-[var(--ncx-panel-bg)]/70 p-3 space-y-2">
          <div className="text-xs text-[var(--ncx-text-muted)] mb-1">Home</div>
          <div className="flex items-center gap-1 text-sm font-semibold">
            <TeamLogo name={home.team} />
            <span className="text-[var(--ncx-text-primary)]/90">{home.team || "—"}</span>
          </div>

          <div className="mt-1 text-xs text-[var(--ncx-text-muted)] flex flex-col gap-1">
            <span className="font-medium text-[var(--ncx-text-primary)]">{home.name || "—"}</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--ncx-text-muted)]">NCX ID:</span>
              {canEditHomeId ? (
                <input
                  type="text"
                  value={homeId}
                  onChange={(e) => setHomeId(e.target.value)}
                  className="w-20 rounded bg-[rgb(0_0_0/0.28)] border border-[var(--ncx-border)] px-2 py-1 text-[11px] text-[var(--ncx-text-primary)] outline-none focus:border-[rgb(var(--ncx-primary-rgb)/0.70)]"
                  placeholder="e.g. 17"
                />
              ) : (
                <span className="text-[11px] bg-[rgb(0_0_0/0.30)] border border-[var(--ncx-border)] px-2 py-0.5 rounded">
                  {home.id || "—"}
                </span>
              )}
            </div>
          </div>

          <div className="mt-1 text-[11px] text-[var(--ncx-text-muted)]">
            W-L:{" "}
            <span className="text-[var(--ncx-text-primary)]/90">
              {home.wins || 0}-{home.losses || 0}
            </span>{" "}
            • PL/MS:{" "}
            <span className="text-[var(--ncx-text-primary)]/90">{home.plms || "-"}</span>
          </div>
        </div>
      </div>

      {/* Scores + scenario */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs text-[var(--ncx-text-muted)]">Away Score</span>
          <input
            type="number"
            min={0}
            value={awayPts}
            onChange={(e) => setAwayPts(e.target.value)}
            className={`mt-1 ${inputBase} text-sm`}
          />
        </label>

        <label className="block">
          <span className="text-xs text-[var(--ncx-text-muted)]">Home Score</span>
          <input
            type="number"
            min={0}
            value={homePts}
            onChange={(e) => setHomePts(e.target.value)}
            className={`mt-1 ${inputBase} text-sm`}
          />
        </label>

        <label className="block">
          <span className="text-xs text-[var(--ncx-text-muted)]">Scenario</span>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            className={`mt-1 ${inputBase} text-sm text-[var(--ncx-text-primary)]`}
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

      {/* Lists (optional) */}
      <div className="space-y-2">
        <span className="text-xs text-[var(--ncx-text-muted)]">
          Squad list links <span className="opacity-70">(optional)</span>
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] text-[var(--ncx-text-muted)]">Away list (YASB / LBN)</span>
            <input
              type="url"
              value={awayList}
              onChange={(e) => setAwayList(e.target.value)}
              className={`mt-1 ${inputBase} text-xs text-[var(--ncx-text-primary)]`}
              placeholder="https://yasb.app/..."
            />
          </label>

          <label className="block">
            <span className="text-[11px] text-[var(--ncx-text-muted)]">Home list (YASB / LBN)</span>
            <input
              type="url"
              value={homeList}
              onChange={(e) => setHomeList(e.target.value)}
              className={`mt-1 ${inputBase} text-xs text-[var(--ncx-text-primary)]`}
              placeholder="https://launchbaynext.app/..."
            />
          </label>
        </div>

        <p className="text-[11px] text-[var(--ncx-text-muted)]">
          Paste YASB or LaunchBayNext URLs. Leave blank if you don&apos;t want to share lists.
        </p>
      </div>

      {alreadyFilled && editingScores && (
        <label className="flex items-center gap-2 text-sm text-[var(--ncx-text-primary)]/85">
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
        className="w-full rounded-xl bg-gradient-to-r from-[rgb(var(--ncx-secondary-rgb))] via-[rgb(var(--ncx-primary-rgb))] to-[rgb(var(--ncx-secondary-rgb))] py-3 text-sm font-semibold text-[rgb(0_0_0/0.85)] shadow disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit Report"}
      </button>

      {notice && <p className="text-center text-sm text-[var(--ncx-text-primary)]/85">{notice}</p>}
    </div>
  );
}
