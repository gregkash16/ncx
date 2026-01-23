// src/app/components/ReportPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { teamSlug } from "@/lib/slug"; // ✅ use same slugger as everywhere

// The tab key type should match your HomeTabs
type TabKey = "current" | "matchups" | "standings" | "report" | "indstats";

type Role = "player" | "captain" | "admin";

type SubRow = {
  ncxid: string;
  first: string;
  last: string;
  discordId: string;
};

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
  /** Stored from Lists */
  awayList?: string;
  homeList?: string;
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

type ReportPanelProps = {
  /** injected by HomeTabs (optional) so we can jump to another tab after success */
  goToTab?: (key: TabKey) => void;
};

function isValidListLink(url: string): boolean {
  const s = String(url ?? "").trim().toLowerCase();
  if (!s) return true; // empty is allowed
  const isUrlLike = /^https?:\/\//.test(s);
  if (!isUrlLike) return false;
  const isYasb = s.includes("yasb.app") || s.includes("raithos.github.io");
  const isLbn = s.includes("launchbaynext.app");
  return isYasb || isLbn;
}

export default function ReportPanel({ goToTab }: ReportPanelProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FoundPayload | NotOk | null>(null);

  // Which game (index in data.games) are we editing?
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Form state (per currently selected game)
  const [awayPts, setAwayPts] = useState<string>("");
  const [homePts, setHomePts] = useState<string>("");
  const [scenario, setScenario] = useState<string>("");
  const [awayId, setAwayId] = useState<string>("");
  const [homeId, setHomeId] = useState<string>("");

  // List URLs
  const [awayList, setAwayList] = useState<string>("");
  const [homeList, setHomeList] = useState<string>("");

  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string>("");

  // ✅ Subs UI state (MUST be inside component)
  const [showSubs, setShowSubs] = useState(false);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [subsError, setSubsError] = useState<string>("");

  async function loadSubsOnce() {
    if (subs.length > 0) return;
    setSubsLoading(true);
    setSubsError("");
    try {
      const res = await fetch("/api/subs", { method: "GET" });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setSubsError(json?.reason ?? "Failed to load subs.");
        return;
      }
      setSubs(Array.isArray(json.subs) ? json.subs : []);
    } catch {
      setSubsError("Failed to load subs.");
    } finally {
      setSubsLoading(false);
    }
  }

  // Load current user's manageable matchups
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      setNotice("");
      try {
        const res = await fetch("/api/report-game", { method: "GET" });
        const json = await res.json();
        if (!isMounted) return;

        if (!json?.ok) {
          setData(json);
          return;
        }

        const payload = json as FoundPayload;
        setData(payload);

        // Pick default game: prefer one marked isMyGame, else first
        const games = payload.games ?? [];
        if (games.length > 0) {
          const myIndex = games.findIndex((g) => g.isMyGame);
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
        if (isMounted) setData({ ok: false, reason: "SERVER_ERROR" });
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
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

  const listError = useMemo(() => {
    if (awayList && !isValidListLink(awayList)) return "Should be a YASB or LBN Link";
    if (homeList && !isValidListLink(homeList)) return "Should be a YASB or LBN Link";
    return "";
  }, [awayList, homeList]);

  const canSubmit = useMemo(() => {
    if (!data || !data.ok || !selectedGame) return false;

    // Nothing changed? No submit.
    if (!editingScores && !editingIds && !editingLists) return false;

    // List fields invalid? Block submit.
    if (listError) return false;

    // If we’re editing scores, require both scores + scenario,
    // and confirm overwrite if scores already exist.
    if (editingScores) {
      if (awayPts === "" || homePts === "" || !scenario) return false;
      if (selectedGame.alreadyFilled && !confirmOverwrite) return false;
    }

    // If we’re only editing IDs or lists, that’s fine – backend enforces perms.
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
    listError,
  ]);

  async function submit() {
    if (!data || !data.ok || !selectedGame) return;
    setSubmitting(true);
    setNotice("");
    try {
      const payload: any = {
        rowIndex: selectedGame.rowIndex,
        force: confirmOverwrite,
        // Always send these; server decides whether you're allowed to change them
        newAwayId: awayId,
        newHomeId: homeId,
        // List URLs (optional)
        awayList,
        homeList,
      };

      // Only include scores + scenario if they actually changed.
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
        if (json?.reason === "BAD_LIST_LINK" && json?.message) {
          setNotice(json.message);
          return;
        }
        setNotice("Submission failed. " + (json?.reason ?? ""));
        return;
      }

      // Success
      setNotice("✅ Report saved!");
      // hop back to Matchups after a short beat
      setTimeout(() => goToTab?.("matchups"), 900);
    } catch {
      setNotice("Something went wrong submitting.");
    } finally {
      setSubmitting(false);
    }
  }

  // When user switches which game they're editing
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

  // Small helper: team logo (uses /logos + teamSlug; no borders/background)
  function TeamLogo({ name }: { name: string }) {
    const slug = teamSlug(name);
    if (!slug) return null;
    return (
      <Image
        src={`/logos/${slug}.webp`}
        alt={`${name} logo`}
        width={24}
        height={24}
        className="inline-block align-middle mr-2 object-contain"
        unoptimized
        loading="lazy"
        decoding="async"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  // ----- RENDER STATES -----
  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] text-[var(--ncx-text-primary)]">
        Loading your matchup…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] text-[var(--ncx-text-primary)]">
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
      <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] text-[var(--ncx-text-primary)]">
        {msg}
      </div>
    );
  }

  if (!selectedGame) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] text-[var(--ncx-text-primary)]">
        No games available to report this week.
      </div>
    );
  }

  const { weekTab, role } = data;
  const { game, away, home, alreadyFilled, canEditAwayId, canEditHomeId } = selectedGame;

  return (
    <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] text-[var(--ncx-text-primary)] space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <h2 className="text-xl font-semibold text-[rgb(var(--ncx-highlight-rgb))]">
            Report a Game — <span className="text-[var(--ncx-text-primary)]">{weekTab}</span>
          </h2>
          <span className="mt-1 text-xs text-[var(--ncx-text-muted)]">
            Role:{" "}
            <span className="font-medium text-[var(--ncx-text-primary)] capitalize">
              {role}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {(role === "admin" || role === "captain") && (
            <button
              onClick={async () => {
                const next = !showSubs;
                setShowSubs(next);
                if (next) await loadSubsOnce();
              }}
              className="text-xs px-3 py-2 rounded-lg border border-[var(--ncx-border)] bg-[rgb(var(--ncx-primary-rgb)/0.10)] text-[var(--ncx-text-primary)] hover:border-[rgb(var(--ncx-highlight-rgb)/0.60)]"
              type="button"
            >
              {showSubs ? "Retract Subs" : "Show Subs"}
            </button>
          )}

          <span
            className={`text-xs px-3 py-1 rounded-full border ${
              alreadyFilled
                ? "border-[rgb(var(--ncx-primary-rgb)/0.60)] bg-[rgb(var(--ncx-primary-rgb)/0.12)] text-[rgb(var(--ncx-primary-rgb))]"
                : "border-[rgb(var(--ncx-highlight-rgb)/0.60)] bg-[rgb(var(--ncx-highlight-rgb)/0.12)] text-[rgb(var(--ncx-highlight-rgb))]"
            }`}
          >
            Game #{game}
          </span>
        </div>
      </div>

      {/* Subs drawer (admin/captain only) */}
      {(role === "admin" || role === "captain") && showSubs && (
        <div className="rounded-xl border border-[var(--ncx-border)] bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-[var(--ncx-text-primary)]">
              Subs ({subs.length})
            </div>
            <button
              onClick={() => setShowSubs(false)}
              className="text-xs px-2 py-1 rounded border border-[var(--ncx-border)] bg-[rgb(var(--ncx-primary-rgb)/0.10)] text-[var(--ncx-text-primary)] hover:border-[rgb(var(--ncx-highlight-rgb)/0.60)]"
              type="button"
            >
              Retract
            </button>
          </div>

          {subsLoading && <div className="text-sm text-[var(--ncx-text-muted)]">Loading…</div>}
          {subsError && (
            <div className="text-sm text-[color:var(--destructive)]">{subsError}</div>
          )}

          {!subsLoading && !subsError && subs.length > 0 && (
            <div className="max-h-64 overflow-auto rounded-lg border border-[var(--ncx-border)]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.18)] text-[var(--ncx-text-primary)]">
                  <tr>
                    <th className="text-left px-3 py-2">NCXID</th>
                    <th className="text-left px-3 py-2">First</th>
                    <th className="text-left px-3 py-2">Last</th>
                    <th className="text-left px-3 py-2">Discord</th>
                  </tr>
                </thead>

                <tbody>
                  {subs.map((s) => (
                    <tr
                      key={`${s.ncxid}-${s.discordId}`}
                      className="border-t border-[var(--ncx-border)]"
                    >
                      <td className="px-3 py-2 text-[var(--ncx-text-primary)]">
                        {String(s.ncxid ?? "")}
                      </td>
                      <td className="px-3 py-2 text-[var(--ncx-text-primary)]">
                        {String(s.first ?? "")}
                      </td>
                      <td className="px-3 py-2 text-[var(--ncx-text-primary)]">
                        {String(s.last ?? "")}
                      </td>
                      <td className="px-3 py-2">
                        {s.discordId ? (
                          <a
                            href={`discord://-/users/${encodeURIComponent(String(s.discordId))}`}
                            className="inline-flex items-center justify-center rounded-md border border-[var(--ncx-border)] bg-[rgb(var(--ncx-primary-rgb)/0.10)] px-2 py-1 text-xs text-[var(--ncx-text-primary)] hover:border-[rgb(var(--ncx-highlight-rgb)/0.60)]"
                            title="Open Discord DM"
                          >
                            DM
                          </a>
                        ) : (
                          <span className="text-[var(--ncx-text-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!subsLoading && !subsError && subs.length === 0 && (
            <div className="text-sm text-[var(--ncx-text-muted)]">No subs found.</div>
          )}
        </div>
      )}

      {/* Game selector (dropdown instead of a pile of buttons) */}
      {data.games.length > 1 && (
        <div className="space-y-2">
          <label className="block text-sm text-[var(--ncx-text-primary)]">
            Select a game to edit
          </label>
          <select
            value={selectedIndex}
            onChange={(e) => handleSelectGame(Number(e.target.value))}
            className="w-full rounded-lg bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] border border-[var(--ncx-border)] px-3 py-2 text-sm text-[var(--ncx-text-primary)] outline-none focus:border-[rgb(var(--ncx-highlight-rgb)/0.60)]"
          >
            {data.games.map((g, idx) => {
              const labelParts = [`G${g.game}:`, g.away.team || "—", "vs", g.home.team || "—"];
              const label = labelParts.join(" ") + (g.isMyGame ? " • MY GAME" : "");
              return (
                <option key={`${g.rowIndex}-${g.game}`} value={idx}>
                  {label}
                </option>
              );
            })}
          </select>
          <p className="text-xs text-[var(--ncx-text-muted)]">
            Admins and captains can switch between all games they&apos;re allowed to manage.
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Away card */}
        <div className="rounded-xl border border-[var(--ncx-border)] bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] p-4 space-y-2">
          <div className="text-sm text-[var(--ncx-text-muted)] mb-1">Away</div>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <TeamLogo name={away.team} />
            <span className="text-[var(--ncx-text-primary)]">{away.team || "—"}</span>
          </div>
          <div className="mt-1 text-sm text-[var(--ncx-text-muted)] flex flex-col gap-1">
            <div>
              <span className="font-medium text-[var(--ncx-text-primary)]">{away.name || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--ncx-text-muted)]">NCX ID:</span>
              {canEditAwayId ? (
                <input
                  type="text"
                  value={awayId}
                  onChange={(e) => setAwayId(e.target.value)}
                  className="w-24 rounded bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] border border-[var(--ncx-border)] px-2 py-1 text-xs text-[var(--ncx-text-primary)] outline-none focus:border-[rgb(var(--ncx-highlight-rgb)/0.70)]"
                  placeholder="e.g. 23"
                />
              ) : (
                <span className="text-xs bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.18)] px-2 py-0.5 rounded">
                  {away.id || "—"}
                </span>
              )}
            </div>
          </div>
          <div className="mt-2 text-sm text-[var(--ncx-text-muted)]">
            W-L:{" "}
            <span className="text-[var(--ncx-text-primary)]">
              {away.wins || 0}-{away.losses || 0}
            </span>{" "}
            • PL/MS:{" "}
            <span className="text-[var(--ncx-text-primary)]">{away.plms || "-"}</span>
          </div>
        </div>

        {/* Home card */}
        <div className="rounded-xl border border-[var(--ncx-border)] bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] p-4 space-y-2">
          <div className="text-sm text-[var(--ncx-text-muted)] mb-1">Home</div>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <TeamLogo name={home.team} />
            <span className="text-[var(--ncx-text-primary)]">{home.team || "—"}</span>
          </div>
          <div className="mt-1 text-sm text-[var(--ncx-text-muted)] flex flex-col gap-1">
            <div>
              <span className="font-medium text-[var(--ncx-text-primary)]">{home.name || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--ncx-text-muted)]">NCX ID:</span>
              {canEditHomeId ? (
                <input
                  type="text"
                  value={homeId}
                  onChange={(e) => setHomeId(e.target.value)}
                  className="w-24 rounded bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] border border-[var(--ncx-border)] px-2 py-1 text-xs text-[var(--ncx-text-primary)] outline-none focus:border-[rgb(var(--ncx-highlight-rgb)/0.70)]"
                  placeholder="e.g. 17"
                />
              ) : (
                <span className="text-xs bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.18)] px-2 py-0.5 rounded">
                  {home.id || "—"}
                </span>
              )}
            </div>
          </div>
          <div className="mt-2 text-sm text-[var(--ncx-text-muted)]">
            W-L:{" "}
            <span className="text-[var(--ncx-text-primary)]">
              {home.wins || 0}-{home.losses || 0}
            </span>{" "}
            • PL/MS:{" "}
            <span className="text-[var(--ncx-text-primary)]">{home.plms || "-"}</span>
          </div>
        </div>
      </div>

      {/* Scores + scenario form */}
      <div className="grid sm:grid-cols-3 gap-4">
        <label className="block">
          <span className="text-sm text-[var(--ncx-text-muted)]">Away Score</span>
          <input
            type="number"
            min={0}
            value={awayPts}
            onChange={(e) => setAwayPts(e.target.value)}
            className="mt-1 w-full rounded-lg bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] border border-[var(--ncx-border)] px-3 py-2 outline-none focus:border-[rgb(var(--ncx-highlight-rgb)/0.60)]"
          />
        </label>

        <label className="block">
          <span className="text-sm text-[var(--ncx-text-muted)]">Home Score</span>
          <input
            type="number"
            min={0}
            value={homePts}
            onChange={(e) => setHomePts(e.target.value)}
            className="mt-1 w-full rounded-lg bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] border border-[var(--ncx-border)] px-3 py-2 outline-none focus:border-[rgb(var(--ncx-highlight-rgb)/0.60)]"
          />
        </label>

        <label className="block">
          <span className="text-sm text-[var(--ncx-text-muted)]">Scenario</span>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            className="mt-1 w-full rounded-lg bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] border border-[var(--ncx-border)] px-3 py-2 outline-none focus:border-[rgb(var(--ncx-highlight-rgb)/0.60)]"
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

      {/* List URLs */}
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm text-[var(--ncx-text-muted)]">Away List (optional)</span>
          <input
            type="url"
            value={awayList}
            onChange={(e) => setAwayList(e.target.value)}
            placeholder="Paste YASB or LBN link"
            className="mt-1 w-full rounded-lg bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] border border-[var(--ncx-border)] px-3 py-2 outline-none focus:border-[rgb(var(--ncx-highlight-rgb)/0.60)]"
          />
          {awayList && !isValidListLink(awayList) && (
            <p className="mt-1 text-xs text-[color:var(--destructive)]">
              Should be a YASB or LBN Link
            </p>
          )}
        </label>

        <label className="block">
          <span className="text-sm text-[var(--ncx-text-muted)]">Home List (optional)</span>
          <input
            type="url"
            value={homeList}
            onChange={(e) => setHomeList(e.target.value)}
            placeholder="Paste YASB or LBN link"
            className="mt-1 w-full rounded-lg bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] border border-[var(--ncx-border)] px-3 py-2 outline-none focus:border-[rgb(var(--ncx-highlight-rgb)/0.60)]"
          />
          {homeList && !isValidListLink(homeList) && (
            <p className="mt-1 text-xs text-[color:var(--destructive)]">
              Should be a YASB or LBN Link
            </p>
          )}
        </label>
      </div>

      {alreadyFilled && editingScores && (
        <label className="flex items-center gap-2 text-sm text-[var(--ncx-text-primary)]">
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
          className="px-6 py-2 rounded-xl bg-[linear-gradient(to_right,var(--ncx-hero-to),var(--ncx-hero-via),var(--ncx-hero-from))] text-white font-semibold shadow-lg disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Report"}
        </button>
        {notice && <span className="text-sm text-[var(--ncx-text-primary)]">{notice}</span>}
      </div>

      {/* subtle validation hint */}
      {listError && (
        <div className="text-xs text-[color:var(--destructive)]">{listError}</div>
      )}
    </div>
  );
}
