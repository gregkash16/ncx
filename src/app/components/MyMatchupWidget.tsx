// src/app/components/MyMatchupWidget.tsx
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

// Keep in sync with /api/report-game
const SCENARIOS = ["ANCIENT", "CHANCE", "ASSAULT", "SCRAMBLE", "SALVAGE"] as const;

// Same mapping used by MatchupsPanel
const FACTION_FILE: Record<string, string> = {
  REBELS: "Rebels.webp",
  EMPIRE: "Empire.webp",
  REPUBLIC: "Republic.webp",
  CIS: "CIS.webp",
  RESISTANCE: "Resistance.webp",
  "FIRST ORDER": "First Order.webp",
  SCUM: "Scum.webp",
};

function factionIconSrc(faction?: string) {
  const key = (faction || "").toUpperCase().trim();
  const file = FACTION_FILE[key];
  return file ? `/factions/${file}` : "";
}

type MyMatchupWidgetProps = {
  /**
   * Map of NCXID -> faction label (e.g. "REBELS", "EMPIRE")
   * Same thing you pass to MatchupsPanel as factionMap.
   */
  factionMap?: Record<string, string>;
};

export default function MyMatchupWidget({ factionMap }: MyMatchupWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FoundPayload | NotOk | null>(null);

  const [awayPts, setAwayPts] = useState("");
  const [homePts, setHomePts] = useState("");
  const [scenario, setScenario] = useState("");
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  // Fetch manageable games (same endpoint as ReportPanel)
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
      } catch {
        if (isMounted) {
          setData({ ok: false, reason: "SERVER_ERROR" });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Pick THIS user's game
  const myGame: GameRow | null = useMemo(() => {
    if (!data || !data.ok) return null;
    const mine = data.games?.find((g) => g.isMyGame);
    return mine ?? null;
  }, [data]);

  // Initialize form when myGame appears / changes
  useEffect(() => {
    if (!myGame) return;
    setAwayPts(myGame.away.pts || "");
    setHomePts(myGame.home.pts || "");
    setScenario(myGame.scenario || "");
    setConfirmOverwrite(false);
    setNotice("");
  }, [myGame]);

  const editingScores = useMemo(() => {
    if (!myGame) return false;
    return (
      awayPts !== (myGame.away.pts || "") ||
      homePts !== (myGame.home.pts || "") ||
      scenario !== (myGame.scenario || "")
    );
  }, [myGame, awayPts, homePts, scenario]);

  const canSubmit = useMemo(() => {
    if (!data || !data.ok || !myGame) return false;

    if (!editingScores) return false;

    if (awayPts === "" || homePts === "" || !scenario) return false;
    if (myGame.alreadyFilled && !confirmOverwrite) return false;

    return true;
  }, [data, myGame, editingScores, awayPts, homePts, scenario, confirmOverwrite]);

  async function submit() {
    if (!data || !data.ok || !myGame) return;
    setSubmitting(true);
    setNotice("");
    try {
      const payload: any = {
        rowIndex: myGame.rowIndex,
        force: confirmOverwrite,
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
          setNotice("This game already has results. Check ‘Confirm overwrite’ to proceed.");
          return;
        }
        setNotice("Submission failed. " + (json?.reason ?? ""));
        return;
      }

      setNotice("✅ Report saved!");

      // Optimistically mark as filled in local view
      if (myGame) {
        myGame.away.pts = awayPts;
        myGame.home.pts = homePts;
        myGame.scenario = scenario;
        (myGame as any).alreadyFilled = true;
        setConfirmOverwrite(false);
      }
    } catch {
      setNotice("Something went wrong submitting.");
    } finally {
      setSubmitting(false);
    }
  }

  // --- VISIBILITY RULES ---
  if (loading) {
    // Keep home clean; don't show a skeleton
    return null;
  }

  if (!data || !data.ok) {
    // Not logged in / no mapping / no game -> hide
    return null;
  }

  if (!myGame) {
    // Logged in but no personal matchup this week
    return null;
  }

  const { weekTab } = data;
  const { game, away, home, alreadyFilled } = myGame;

  const awayLogo = teamSlug(away.team) ? `/logos/${teamSlug(away.team)}.webp` : "/logos/default.png";
  const homeLogo = teamSlug(home.team) ? `/logos/${teamSlug(home.team)}.webp` : "/logos/default.png";

  const awayScoreDisplay = awayPts === "" ? "—" : awayPts;
  const homeScoreDisplay = homePts === "" ? "—" : homePts;

  const isFinal = Boolean(myGame.scenario || scenario);

  // Factions via factionMap (NCXID -> faction)
  const awayFaction = away.id ? factionMap?.[away.id] : undefined;
  const homeFaction = home.id ? factionMap?.[home.id] : undefined;

  const awayFactionIcon = factionIconSrc(awayFaction);
  const homeFactionIcon = factionIconSrc(homeFaction);

  return (
    <div className="mt-6 mb-6 rounded-2xl border border-[var(--ncx-border)] bg-[var(--ncx-panel-bg)] p-5 shadow-lg">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <h3 className="text-lg md:text-xl font-bold ncx-accent">Your Matchup This Week</h3>
          <p className="text-xs md:text-sm text-[var(--ncx-text-muted)] mt-1">
            {weekTab ? `Week: ${weekTab} • Game #${game}` : `Game #${game}`}
          </p>
        </div>

        <span
          className={[
            "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border",
            isFinal
              ? "bg-[rgb(var(--ncx-highlight-rgb)/0.12)] border-[rgb(var(--ncx-highlight-rgb))] text-[rgb(var(--ncx-highlight-rgb))]"
              : "bg-[rgb(var(--ncx-primary-rgb)/0.10)] border-[rgb(var(--ncx-primary-rgb)/0.60)] text-[rgb(var(--ncx-primary-rgb))]",
          ].join(" ")}
        >
          {isFinal ? "Reported" : "Awaiting Report"}
        </span>
      </div>

      {/* Teams + score row */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        {/* Away */}
        <div className="flex items-center gap-3 md:w-1/3 min-w-0">
          <Image
            src={awayLogo}
            alt={away.team || "Away team"}
            width={40}
            height={40}
            className="inline-block object-contain shrink-0 rounded"
            unoptimized
            loading="lazy"
            decoding="async"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {awayFactionIcon && (
                <Image
                  src={awayFactionIcon}
                  alt={`${away.name} faction`}
                  width={28}
                  height={28}
                  className="object-contain rounded"
                  unoptimized
                  loading="lazy"
                  decoding="async"
                />
              )}
              <div>
                <div className="text-xs text-[var(--ncx-text-muted)] uppercase">Away</div>
                <div className="truncate text-sm font-semibold text-[var(--ncx-text-primary)]">
                  {away.team || "TBD"}
                </div>
              </div>
            </div>
            <div className="truncate text-xs text-[var(--ncx-text-muted)] mt-1">
              {away.name || "—"} {away.id ? `• NCX ${away.id}` : ""}
            </div>
          </div>
        </div>

        {/* Score display */}
        <div className="md:w-1/3 flex flex-col items-center justify-center">
          <div className="text-xs text-[var(--ncx-text-muted)] mb-1">
            {myGame.scenario || scenario || "No scenario recorded"}
          </div>
          <div className="text-3xl font-mono">
            <span>{awayScoreDisplay}</span>
            <span className="mx-2 text-[var(--ncx-text-muted)]">:</span>
            <span>{homeScoreDisplay}</span>
          </div>
        </div>

        {/* Home */}
        <div className="flex items-center gap-3 justify-end md:w-1/3 min-w-0">
          <div className="min-w-0 text-right">
            <div className="flex items-center justify-end gap-2">
              <div>
                <div className="text-xs text-[var(--ncx-text-muted)] uppercase">Home</div>
                <div className="truncate text-sm font-semibold text-[var(--ncx-text-primary)]">
                  {home.team || "TBD"}
                </div>
              </div>
              {homeFactionIcon && (
                <Image
                  src={homeFactionIcon}
                  alt={`${home.name} faction`}
                  width={28}
                  height={28}
                  className="object-contain rounded"
                  unoptimized
                  loading="lazy"
                  decoding="async"
                />
              )}
            </div>
            <div className="truncate text-xs text-[var(--ncx-text-muted)] mt-1">
              {home.name || "—"} {home.id ? `• NCX ${home.id}` : ""}
            </div>
          </div>
          <Image
            src={homeLogo}
            alt={home.team || "Home team"}
            width={40}
            height={40}
            className="inline-block object-contain shrink-0 rounded"
            unoptimized
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>

      {/* Inline report form */}
      <div className="grid sm:grid-cols-3 gap-4 mb-3">
        <label className="block">
          <span className="text-xs text-[var(--ncx-text-muted)]">Away Score</span>
          <input
            type="number"
            min={0}
            value={awayPts}
            onChange={(e) => setAwayPts(e.target.value)}
            className="mt-1 w-full rounded-lg bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] px-3 py-2 text-sm outline-none focus:border-[rgb(var(--ncx-primary-rgb)/0.70)]"
          />
        </label>

        <label className="block">
          <span className="text-xs text-[var(--ncx-text-muted)]">Home Score</span>
          <input
            type="number"
            min={0}
            value={homePts}
            onChange={(e) => setHomePts(e.target.value)}
            className="mt-1 w-full rounded-lg bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] px-3 py-2 text-sm outline-none focus:border-[rgb(var(--ncx-primary-rgb)/0.70)]"
          />
        </label>

        <label className="block">
          <span className="text-xs text-[var(--ncx-text-muted)]">Scenario</span>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            className="mt-1 w-full rounded-lg bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] px-3 py-2 text-sm outline-none focus:border-[rgb(var(--ncx-primary-rgb)/0.70)]"
          >
            <option value="" disabled>
              Choose…
            </option>
            {SCENARIOS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {alreadyFilled && editingScores && (
        <label className="flex items-center gap-2 text-xs text-[var(--ncx-text-primary)] mb-2">
          <input
            type="checkbox"
            checked={confirmOverwrite}
            onChange={(e) => setConfirmOverwrite(e.target.checked)}
          />
          Confirm overwrite (scores already exist for this game)
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={!canSubmit || submitting}
          onClick={submit}
          className="px-5 py-2 rounded-xl bg-[linear-gradient(to_right,var(--ncx-hero-to),var(--ncx-hero-via),var(--ncx-hero-from))] text-white text-sm font-semibold shadow-lg disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Report"}
        </button>

        <a
          href="/?tab=report"
          className="text-xs text-[var(--ncx-text-muted)] hover:text-[rgb(var(--ncx-primary-rgb))] underline underline-offset-4"
        >
          Open full Report panel
        </a>

        {notice && <span className="text-xs text-[var(--ncx-text-primary)]">{notice}</span>}
      </div>
    </div>
  );
}
