'use client';

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

// The tab key type should match your HomeTabs
type TabKey = "current" | "matchups" | "standings" | "report" | "indstats";

type FoundGame = {
  ok: true;
  weekTab: string;
  rowIndex: number;
  game: string;
  away: {
    id: string; name: string; team: string;
    wins: string; losses: string; pts: string; plms: string;
  };
  home: {
    id: string; name: string; team: string;
    wins: string; losses: string; pts: string; plms: string;
  };
  scenario: string;
  alreadyFilled: boolean;
};

type NotOk =
  | { ok: false; reason: "NOT_AUTH" | "NO_DISCORD_ID" | "NO_NCXID" | "NO_GAME_FOUND" | "SERVER_ERROR" };

const SCENARIOS = ["ANCIENT", "CHANCE", "ASSAULT", "SCRAMBLE", "SALVAGE"] as const;

type ReportPanelProps = {
  /** injected by HomeTabs (optional) so we can jump to another tab after success */
  goToTab?: (key: TabKey) => void;
};

export default function ReportPanel({ goToTab }: ReportPanelProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FoundGame | NotOk | null>(null);

  // Form state
  const [awayPts, setAwayPts] = useState<string>("");
  const [homePts, setHomePts] = useState<string>("");
  const [scenario, setScenario] = useState<string>("");
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string>("");

  // Load current user's matchup
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      setNotice("");
      try {
        const res = await fetch("/api/report-game", { method: "GET" });
        const json = await res.json();
        if (!isMounted) return;
        setData(json);

        // Pre-fill form if values exist
        if (json?.ok) {
          setAwayPts(json.away?.pts || "");
          setHomePts(json.home?.pts || "");
          setScenario(json.scenario || "");
        }
      } catch {
        if (isMounted) setData({ ok: false, reason: "SERVER_ERROR" });
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const canSubmit = useMemo(() => {
    if (!data || !("ok" in data) || !data.ok) return false;
    if (awayPts === "" || homePts === "" || !scenario) return false;
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
          setNotice("This game already has results. Check ‘Confirm overwrite’ to proceed.");
          return;
        }
        setNotice("Submission failed. " + (json?.reason ?? ""));
        return;
      }

      // Success
      setNotice("✅ Report saved! (A Discord webhook was posted.)");
      // hop back to Matchups after a short beat
      setTimeout(() => goToTab?.("matchups"), 900);
    } catch {
      setNotice("Something went wrong submitting.");
    } finally {
      setSubmitting(false);
    }
  }

  // Small helper: team logo (optional)
  function TeamLogo({ name }: { name: string }) {
    const key = name?.trim().toLowerCase().replace(/\s+/g, "-");
    if (!key) return null;
    return (
      <Image
        src={`/teams/${key}.png`}
        alt={`${name} logo`}
        width={24}
        height={24}
        className="inline-block rounded-sm align-middle mr-2"
        onError={(e) => {
          // Hide image if missing
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  // ----- RENDER STATES -----
  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-zinc-300">
        Loading your matchup…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-zinc-300">
        Could not load.
      </div>
    );
  }

  if (!data.ok) {
    let msg = "Something went wrong.";
    if (data.reason === "NOT_AUTH") msg = "Please log in with your Discord to report a game.";
    if (data.reason === "NO_DISCORD_ID") msg = "No Discord ID found. Try logging out/in.";
    if (data.reason === "NO_NCXID") msg = "We couldn't find your NCXID mapping in the sheet.";
    if (data.reason === "NO_GAME_FOUND") msg = "We couldn't find a game for you this week.";
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-zinc-300">
        {msg}
      </div>
    );
  }

  // ---- OK: show form ----
  const { weekTab, game, away, home, alreadyFilled } = data;

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-zinc-300 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-pink-400">
          Report a Game — <span className="text-white">{weekTab}</span>
        </h2>
        <span
          className={`text-xs px-3 py-1 rounded-full border ${
            alreadyFilled
              ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-300"
              : "border-purple-400/50 bg-purple-500/10 text-purple-300"
          }`}
        >
          Game #{game}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Away card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="text-sm text-zinc-400 mb-1">Away</div>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <TeamLogo name={away.team} />
            <span className="text-zinc-200">{away.team || "—"}</span>
          </div>
          <div className="mt-1 text-sm text-zinc-400">
            <span className="font-medium text-white">{away.name || "—"}</span>
            <span className="ml-2 text-xs bg-zinc-800 px-2 py-0.5 rounded">NCX {away.id || "—"}</span>
          </div>
          <div className="mt-3 text-sm text-zinc-400">
            W-L: <span className="text-zinc-200">{away.wins || 0}-{away.losses || 0}</span>{" "}
            • PL/MS: <span className="text-zinc-200">{away.plms || "-"}</span>
          </div>
        </div>

        {/* Home card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="text-sm text-zinc-400 mb-1">Home</div>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <TeamLogo name={home.team} />
            <span className="text-zinc-200">{home.team || "—"}</span>
          </div>
          <div className="mt-1 text-sm text-zinc-400">
            <span className="font-medium text-white">{home.name || "—"}</span>
            <span className="ml-2 text-xs bg-zinc-800 px-2 py-0.5 rounded">NCX {home.id || "—"}</span>
          </div>
          <div className="mt-3 text-sm text-zinc-400">
            W-L: <span className="text-zinc-200">{home.wins || 0}-{home.losses || 0}</span>{" "}
            • PL/MS: <span className="text-zinc-200">{home.plms || "-"}</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="grid sm:grid-cols-3 gap-4">
        <label className="block">
          <span className="text-sm text-zinc-400">Away Score</span>
          <input
            type="number"
            min={0}
            value={awayPts}
            onChange={(e) => setAwayPts(e.target.value)}
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 outline-none focus:border-pink-400/60"
          />
        </label>

        <label className="block">
          <span className="text-sm text-zinc-400">Home Score</span>
          <input
            type="number"
            min={0}
            value={homePts}
            onChange={(e) => setHomePts(e.target.value)}
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 outline-none focus:border-pink-400/60"
          />
        </label>

        <label className="block">
          <span className="text-sm text-zinc-400">Scenario</span>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 outline-none focus:border-pink-400/60"
          >
            <option value="" disabled>Choose…</option>
            {SCENARIOS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      {data.alreadyFilled && (
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={confirmOverwrite}
            onChange={(e) => setConfirmOverwrite(e.target.checked)}
          />
          Confirm overwrite (scores already exist for this game)
        </label>
      )}

      <div className="flex items-center gap-3">
        <button
          disabled={!canSubmit || submitting}
          onClick={submit}
          className="px-6 py-2 rounded-xl bg-gradient-to-r from-pink-600 via-purple-500 to-cyan-500 text-white font-semibold shadow-lg shadow-pink-600/30 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Report"}
        </button>
        {notice && <span className="text-sm text-zinc-300">{notice}</span>}
      </div>
    </div>
  );
}
/*comment*/ 