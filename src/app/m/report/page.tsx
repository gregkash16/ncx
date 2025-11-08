// src/app/m/report/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { teamSlug } from "@/lib/slug";

type TabKey = "current" | "matchups" | "standings" | "report" | "indstats";

type FoundGame = {
  ok: true;
  weekTab: string;
  rowIndex: number;
  game: string;
  away: {
    id: string; name: string; team: string; wins: string; losses: string; pts: string; plms: string;
  };
  home: {
    id: string; name: string; team: string; wins: string; losses: string; pts: string; plms: string;
  };
  scenario: string;
  alreadyFilled: boolean;
};

type NotOk =
  | { ok: false; reason: "NOT_AUTH" | "NO_DISCORD_ID" | "NO_NCXID" | "NO_GAME_FOUND" | "SERVER_ERROR" };

const SCENARIOS = ["ANCIENT", "CHANCE", "ASSAULT", "SCRAMBLE", "SALVAGE"] as const;

export default function MobileReportPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FoundGame | NotOk | null>(null);
  const [awayPts, setAwayPts] = useState("");
  const [homePts, setHomePts] = useState("");
  const [scenario, setScenario] = useState("");
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/report-game");
        const json = await res.json();
        if (!alive) return;
        setData(json);
        if (json?.ok) {
          setAwayPts(json.away?.pts || "");
          setHomePts(json.home?.pts || "");
          setScenario(json.scenario || "");
        }
      } catch {
        if (alive) setData({ ok: false, reason: "SERVER_ERROR" });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const canSubmit = useMemo(() => {
    if (!data || !("ok" in data) || !data.ok) return false;
    if (!awayPts || !homePts || !scenario) return false;
    if (data.alreadyFilled && !confirmOverwrite) return false;
    return true;
  }, [data, awayPts, homePts, scenario, confirmOverwrite]);

  async function submit() {
    if (!data || !("ok" in data) || !data.ok) return;
    setSubmitting(true);
    setNotice("");
    try {
      const res = await fetch("/api/report-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowIndex: data.rowIndex,
          awayPts: Number(awayPts),
          homePts: Number(homePts),
          scenario,
          force: confirmOverwrite,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json?.reason === "ALREADY_FILLED") {
          setNotice("Already filled. Check 'Confirm overwrite' to proceed.");
          return;
        }
        setNotice("Submission failed. " + (json?.reason ?? ""));
        return;
      }
      setNotice("✅ Report saved!");
      setTimeout(() => location.assign("/m/matchups"), 900);
    } catch {
      setNotice("Something went wrong submitting.");
    } finally {
      setSubmitting(false);
    }
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
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
      />
    );
  }

  // Loading / error states
  if (loading) return <div className="p-4 text-center text-neutral-400">Loading matchup…</div>;
  if (!data) return <div className="p-4 text-center text-neutral-400">Could not load.</div>;
  if (!data.ok) {
    let msg = "Something went wrong.";
    if (data.reason === "NOT_AUTH") msg = "Please sign in via Discord to report a game.";
    if (data.reason === "NO_NCXID") msg = "Your NCX ID is missing in the sheet.";
    if (data.reason === "NO_GAME_FOUND") msg = "No game found for this week.";
    return <div className="p-4 text-center text-neutral-400">{msg}</div>;
  }

  const { weekTab, game, away, home, alreadyFilled } = data;

  return (
    <div className="space-y-5 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-pink-400">
          Report — <span className="text-white">{weekTab}</span>
        </h2>
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

      {/* Team cards */}
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { label: "Away", side: away },
            { label: "Home", side: home },
          ] as Array<{ label: "Away" | "Home"; side: FoundGame["away"] }>
        ).map(({ label, side }) => (
          <div key={label} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
            <div className="text-xs text-neutral-400 mb-1">{label}</div>
            <div className="flex items-center gap-1 text-sm font-semibold">
              <TeamLogo name={side.team} />
              <span>{side.team || "—"}</span>
            </div>
            <div className="text-xs text-neutral-400 mt-1">
              {side.name}{" "}
              <span className="ml-1 bg-neutral-800 px-1.5 py-0.5 rounded text-[10px]">
                NCX {side.id}
              </span>
            </div>
          </div>
        ))}
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs text-neutral-400">Away Score</span>
          <input
            type="number"
            value={awayPts}
            onChange={(e) => setAwayPts(e.target.value)}
            className="mt-1 w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-pink-400/60"
          />
        </label>

        <label className="block">
          <span className="text-xs text-neutral-400">Home Score</span>
          <input
            type="number"
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
              <option key={s}>{s}</option>
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
          Confirm overwrite (scores already exist)
        </label>
      )}

      <button
        onClick={submit}
        disabled={!canSubmit || submitting}
        className="w-full rounded-xl bg-gradient-to-r from-pink-600 via-purple-500 to-cyan-500 py-3 text-sm font-semibold text-white shadow disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit Report"}
      </button>

      {notice && <p className="text-center text-sm text-neutral-300">{notice}</p>}
    </div>
  );
}
