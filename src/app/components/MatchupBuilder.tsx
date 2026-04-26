// src/app/components/MatchupBuilder.tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";

/* ── Types ── */

type AllTimeStats = {
  wins: number;
  losses: number;
  points: number;
  adjPpg: string;
  winPct: string;
  games: number;
  plms: number;
  championships: number;
};

type RosterPlayer = {
  ncxid: string;
  name: string;
  firstName: string;
  lastName: string;
  faction: string;
  wins: number;
  losses: number;
  points: number;
  ppg: string;
  war: string;
  winPct: string;
  games: number;
  plms: number;
  assigned: boolean;
  allTime: AllTimeStats;
};

type SlotData = {
  slot: number;
  awayNcxid: string | null;
  awayName: string | null;
  homeNcxid: string | null;
  homeName: string | null;
  status: "awaiting_away" | "awaiting_home" | "awaiting_veto_window" | "locked";
  vetoed: boolean;
  vetoedHomeNcxid: string | null;
  pendingSub: boolean;
};

type SeriesData = {
  currentSlot: number;
  vetoUsed: boolean;
  finalized: boolean;
  finalizedAt: string | null;
};

type DraftState = {
  needsSelection: false;
  weekLabel: string;
  allWeeks: string[];
  awayTeam: string;
  homeTeam: string;
  series: SeriesData;
  slots: SlotData[];
  awayRoster: RosterPlayer[];
  homeRoster: RosterPlayer[];
  myRole: "away_captain" | "home_captain" | "admin";
  isMyTurn: boolean;
  captainTeams: string[];
  isAdmin: boolean;
};

type SelectionState = {
  needsSelection: true;
  weekLabel: string;
  allWeeks: string[];
  mySeries: { awayTeam: string; homeTeam: string }[];
  captainTeams: string[];
  isAdmin: boolean;
};

type ApiResponse = DraftState | SelectionState;

/* ── Faction image helper ── */
const FACTION_FILE: Record<string, string> = {
  REBELS: "Rebels.webp",
  EMPIRE: "Empire.webp",
  REPUBLIC: "Republic.webp",
  CIS: "CIS.webp",
  RESISTANCE: "Resistance.webp",
  "FIRST ORDER": "First Order.webp",
  SCUM: "Scum.webp",
};
function factionImg(faction: string): string | null {
  const key = (faction ?? "").toUpperCase().trim();
  const file = FACTION_FILE[key];
  return file ? `/factions/${file}` : null;
}

/* ── Component ── */

export default function MatchupBuilder() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  // Pending pick — selected but not yet confirmed
  const [pendingPick, setPendingPick] = useState<{ ncxid: string; side: "away" | "home" } | null>(null);

  // Post-finalize substitution flow
  const [subTarget, setSubTarget] = useState<{ slot: number; side: "away" | "home" } | null>(null);
  const [pendingSubPick, setPendingSubPick] = useState<{ ncxid: string } | null>(null);

  // Selection state for when captain has multiple series or admin
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [selectedAway, setSelectedAway] = useState<string | null>(null);
  const [selectedHome, setSelectedHome] = useState<string | null>(null);
  const [forceSelection, setForceSelection] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedWeek) params.set("week", selectedWeek);
    if (selectedAway) params.set("away", selectedAway);
    if (selectedHome) params.set("home", selectedHome);
    // When the user explicitly clicked "Change", tell the server not to
    // auto-detect the captain's series — otherwise it just snaps back.
    if (forceSelection && (!selectedAway || !selectedHome)) {
      params.set("selection", "true");
    }
    return `/api/matchup-builder?${params.toString()}`;
  }, [selectedWeek, selectedAway, selectedHome, forceSelection]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(buildUrl(), { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setError("Access denied. Only team captains can use the Matchup Builder.");
          return;
        }
        if (res.status === 401) {
          setError("Please log in with Discord to use the Matchup Builder.");
          return;
        }
        setError(body.error ?? "Failed to load");
        return;
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  // Merge a light /state payload into the existing DraftState, recomputing
  // each roster player's `assigned` flag from assignedAwayIds/assignedHomeIds.
  const applyLightState = useCallback((state: any) => {
    setData((prev) => {
      if (!prev || prev.needsSelection) return prev;
      const assignedAway = new Set<string>(state.assignedAwayIds ?? []);
      const assignedHome = new Set<string>(state.assignedHomeIds ?? []);
      return {
        ...prev,
        series: state.series,
        slots: state.slots,
        isMyTurn: state.isMyTurn,
        myRole: state.myRole ?? prev.myRole,
        awayRoster: prev.awayRoster.map((p) => ({ ...p, assigned: assignedAway.has(p.ncxid) })),
        homeRoster: prev.homeRoster.map((p) => ({ ...p, assigned: assignedHome.has(p.ncxid) })),
      };
    });
  }, []);

  // Light state fetch — used after actions for immediate feedback and as a
  // polling fallback if SSE is unavailable.
  const fetchLightState = useCallback(async (week: string, away: string, home: string) => {
    try {
      const params = new URLSearchParams({ week, away, home });
      const res = await fetch(`/api/matchup-builder/state?${params}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      applyLightState(json);
    } catch {
      /* ignore — SSE or next poll will catch up */
    }
  }, [applyLightState]);

  // Initial full fetch (rosters + weeks + series + slots).
  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Collapse the live-draft identity into a single string for effect deps.
  // Stays active post-finalize so substitutions propagate between captains.
  const streamKey =
    data && !data.needsSelection
      ? `${data.weekLabel}|${data.awayTeam}|${data.homeTeam}`
      : null;

  // SSE stream for live state updates once we have an active draft.
  useEffect(() => {
    if (!streamKey) return;
    const [weekLabel, awayTeam, homeTeam] = streamKey.split("|") as [string, string, string];
    const params = new URLSearchParams({ week: weekLabel, away: awayTeam, home: homeTeam });

    // Prefer SSE; fall back to polling /state every 4s if EventSource isn't
    // available (old browsers) or consistently errors.
    if (typeof window !== "undefined" && "EventSource" in window) {
      const es = new EventSource(`/api/matchup-builder/stream?${params}`);
      esRef.current = es;
      let errorCount = 0;

      es.onmessage = (ev) => {
        errorCount = 0;
        try {
          const state = JSON.parse(ev.data);
          applyLightState(state);
        } catch {
          /* malformed message — ignore */
        }
      };
      es.onerror = () => {
        errorCount += 1;
        // If it keeps erroring, drop SSE and poll instead.
        if (errorCount >= 3) {
          es.close();
          esRef.current = null;
          pollingRef.current = setInterval(
            () => fetchLightState(weekLabel, awayTeam, homeTeam),
            4000
          );
        }
      };

      return () => {
        es.close();
        esRef.current = null;
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }

    // No EventSource support — poll /state.
    pollingRef.current = setInterval(
      () => fetchLightState(weekLabel, awayTeam, homeTeam),
      4000
    );
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [streamKey, applyLightState, fetchLightState]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const doAction = async (url: string, body: any) => {
    setActionLoading(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setToast({ msg: json.error ?? "Action failed", type: "err" });
      } else {
        // Refresh via light /state for instant feedback; SSE will also push
        // an event within ~2s and reconcile.
        if (data && !data.needsSelection) {
          await fetchLightState(data.weekLabel, data.awayTeam, data.homeTeam);
        }
      }
    } catch (e: any) {
      setToast({ msg: e.message ?? "Network error", type: "err" });
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Render: loading / error ── */

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-400">
        <div className="animate-spin mr-3 h-5 w-5 rounded-full border-2 border-cyan-400 border-t-transparent" />
        Loading Matchup Builder...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center text-red-400">{error}</div>
    );
  }

  if (!data) return null;

  /* ── Render: needs selection (or forced back to selection) ── */

  const showSelection = data.needsSelection || forceSelection;

  if (showSelection) {
    // Build selection data from either response type
    const allWeeks: string[] = data.allWeeks;
    const currentWeekLabel: string = data.weekLabel;
    const isAdmin: boolean = data.isAdmin;
    const captainTeams: string[] = data.captainTeams;
    // For mySeries: if full draft data, we need to re-fetch with no away/home to get the list
    // Instead, show a "go back" option + week selector that triggers a clean fetch
    const mySeries: { awayTeam: string; homeTeam: string }[] =
      data.needsSelection ? (data as SelectionState).mySeries : [];

    // The polling effect refetches with selection=true (see buildUrl) when
    // forceSelection flips on; show a spinner until that response lands and
    // the response carries needsSelection: true with mySeries populated.
    if (forceSelection && !data.needsSelection) {
      return (
        <div className="flex items-center justify-center py-20 text-zinc-400">
          <div className="animate-spin mr-3 h-5 w-5 rounded-full border-2 border-cyan-400 border-t-transparent" />
          Loading...
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto py-8">
        <h2 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
          Matchup Builder
        </h2>

        {/* Week selector */}
        <div className="mb-6">
          <label className="block text-sm text-zinc-400 mb-2">Select Week</label>
          <div className="flex flex-wrap gap-2">
            {allWeeks.map((w) => (
              <button
                key={w}
                onClick={() => { setSelectedWeek(w); setSelectedAway(null); setSelectedHome(null); setForceSelection(false); setData(null); setLoading(true); }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  (selectedWeek ?? currentWeekLabel) === w
                    ? "bg-gradient-to-r from-pink-600 to-cyan-500 text-white"
                    : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-purple-500/50"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Series for this week */}
        {mySeries.length === 0 ? (
          <p className="text-zinc-500 text-center">No matchups found for this week.</p>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm text-zinc-400 mb-2">Select Series</label>
            {mySeries.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelectedAway(s.awayTeam);
                  setSelectedHome(s.homeTeam);
                  setSelectedWeek(selectedWeek ?? currentWeekLabel);
                  setForceSelection(false);
                  setData(null);
                  setLoading(true);
                }}
                className="w-full px-6 py-4 rounded-xl border border-zinc-700 bg-zinc-900/60 hover:border-purple-500/60 transition flex items-center justify-between"
              >
                <span className="text-lg font-semibold text-zinc-200">{s.awayTeam}</span>
                <span className="text-zinc-500 text-sm">vs</span>
                <span className="text-lg font-semibold text-zinc-200">{s.homeTeam}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── Render: draft in progress ── */

  const d = data as DraftState;
  const { series, slots, awayRoster, homeRoster, myRole, isMyTurn, awayTeam, homeTeam, weekLabel } = d;

  const currentSlotData = slots.find((s) => s.slot === series.currentSlot);

  // Determine status banner
  let bannerText = "";
  let bannerColor = "bg-zinc-800 border-zinc-700";

  if (series.finalized) {
    bannerText = "Matchups Finalized";
    bannerColor = "bg-green-900/40 border-green-500/50";
  } else if (isMyTurn) {
    if (currentSlotData?.status === "awaiting_veto_window") {
      bannerText = "Accept or Veto the home pick";
      bannerColor = "bg-amber-900/40 border-amber-500/50";
    } else {
      bannerText = `YOUR TURN — Select a player for Matchup ${series.currentSlot}`;
      bannerColor = "bg-emerald-900/40 border-emerald-500/50";
    }
  } else if (currentSlotData) {
    if (currentSlotData.status === "awaiting_away") {
      bannerText = `Waiting for ${awayTeam} captain to pick...`;
    } else if (currentSlotData.status === "awaiting_home") {
      bannerText = `Waiting for ${homeTeam} captain to pick...`;
    } else if (currentSlotData.status === "awaiting_veto_window") {
      bannerText = `Waiting for ${awayTeam} captain to accept or veto...`;
    }
    bannerColor = "bg-zinc-800/60 border-zinc-600";
  }

  const allLocked = slots.every((s) => s.status === "locked");

  const handleSelectPlayer = (ncxid: string, side: "away" | "home") => {
    if (actionLoading) return;
    // Toggle off if clicking the same player
    if (pendingPick?.ncxid === ncxid && pendingPick?.side === side) {
      setPendingPick(null);
    } else {
      setPendingPick({ ncxid, side });
    }
  };

  const handleConfirmPick = () => {
    if (!pendingPick || actionLoading) return;
    doAction("/api/matchup-builder/pick", {
      week: weekLabel,
      awayTeam,
      homeTeam,
      slot: series.currentSlot,
      ncxid: pendingPick.ncxid,
      side: pendingPick.side,
    });
    setPendingPick(null);
  };

  const handleCancelPick = () => {
    setPendingPick(null);
  };

  const handleVeto = () => {
    if (actionLoading) return;
    doAction("/api/matchup-builder/veto", {
      week: weekLabel,
      awayTeam,
      homeTeam,
      slot: series.currentSlot,
    });
  };

  const handleAccept = () => {
    if (actionLoading) return;
    doAction("/api/matchup-builder/accept", {
      week: weekLabel,
      awayTeam,
      homeTeam,
      slot: series.currentSlot,
    });
  };

  const handleFinalize = () => {
    if (actionLoading) return;
    doAction("/api/matchup-builder/finalize", {
      week: weekLabel,
      awayTeam,
      homeTeam,
    });
  };

  const handleStartSub = (slot: number, side: "away" | "home") => {
    if (actionLoading) return;
    setPendingPick(null);
    setPendingSubPick(null);
    if (subTarget?.slot === slot && subTarget?.side === side) {
      setSubTarget(null);
    } else {
      setSubTarget({ slot, side });
    }
  };

  const handleCancelSub = () => {
    setSubTarget(null);
    setPendingSubPick(null);
  };

  const handleSelectSubCandidate = (ncxid: string) => {
    if (actionLoading) return;
    if (pendingSubPick?.ncxid === ncxid) {
      setPendingSubPick(null);
    } else {
      setPendingSubPick({ ncxid });
    }
  };

  const handleConfirmSub = async () => {
    if (!subTarget || !pendingSubPick || actionLoading) return;
    const target = subTarget;
    const pick = pendingSubPick;
    setSubTarget(null);
    setPendingSubPick(null);
    await doAction("/api/matchup-builder/sub", {
      week: weekLabel,
      awayTeam,
      homeTeam,
      slot: target.slot,
      ncxid: pick.ncxid,
      side: target.side,
    });
  };

  const handleRefinalize = () => {
    if (actionLoading) return;
    if (!confirm("Re-finalize matchups? This writes the pending sub(s) to the sheet and re-runs the seed.")) return;
    doAction("/api/matchup-builder/refinalize", {
      week: weekLabel,
      awayTeam,
      homeTeam,
    });
  };

  const handleReset = async () => {
    if (actionLoading) return;
    if (!confirm(`Reset draft for ${awayTeam} vs ${homeTeam} (${weekLabel})? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/matchup-builder", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week: weekLabel, awayTeam, homeTeam }),
      });
      const json = await res.json();
      if (!res.ok) {
        setToast({ msg: json.error ?? "Reset failed", type: "err" });
      } else {
        setToast({ msg: "Draft reset", type: "ok" });
        setData(null);
        setLoading(true);
        // Re-fetch will auto-create fresh draft rows
        await fetchData();
      }
    } catch (e: any) {
      setToast({ msg: e.message ?? "Network error", type: "err" });
    } finally {
      setActionLoading(false);
    }
  };

  const canPickAway =
    !series.finalized &&
    currentSlotData?.status === "awaiting_away" &&
    (myRole === "away_captain" || myRole === "admin");

  const canPickHome =
    !series.finalized &&
    currentSlotData?.status === "awaiting_home" &&
    (myRole === "home_captain" || myRole === "admin");

  const showVetoButtons =
    !series.finalized &&
    currentSlotData?.status === "awaiting_veto_window" &&
    (myRole === "away_captain" || myRole === "admin");

  const canSubAwaySide =
    series.finalized && (myRole === "away_captain" || myRole === "admin");
  const canSubHomeSide =
    series.finalized && (myRole === "home_captain" || myRole === "admin");
  const hasPendingSubs = slots.some((s) => s.pendingSub);
  const canRefinalize =
    series.finalized &&
    hasPendingSubs &&
    (myRole === "away_captain" || myRole === "home_captain" || myRole === "admin");

  /* ── Roster card ── */
  const renderRoster = (roster: RosterPlayer[], side: "away" | "home", canPick: boolean) => {
    const teamName = side === "away" ? awayTeam : homeTeam;
    const subActive = subTarget?.side === side;
    return (
      <div className="flex-1 min-w-0">
        <h3 className={`text-center text-2xl font-bold mb-4 ${
          side === "away" ? "text-red-400" : "text-blue-400"
        }`}>
          {teamName}
          <span className="text-sm text-zinc-500 ml-2">({side.toUpperCase()})</span>
        </h3>
        {subActive && (
          <div className="mb-4 rounded-lg border border-emerald-500/50 bg-emerald-950/30 px-4 py-3 text-center">
            <div className="text-sm text-emerald-300 font-semibold">
              Subbing for Matchup #{subTarget!.slot} — pick a replacement
            </div>
            <button
              onClick={handleCancelSub}
              className="mt-2 text-xs text-zinc-400 hover:text-zinc-200 underline"
            >
              Cancel sub
            </button>
          </div>
        )}
        <div className="space-y-3">
          {roster.map((p) => {
            const img = factionImg(p.faction);
            // Block vetoed player on the current slot only
            const isVetoBlocked =
              side === "home" &&
              currentSlotData?.vetoedHomeNcxid === p.ncxid &&
              currentSlotData?.slot === series.currentSlot;
            const isSubCandidate = subActive && !p.assigned;
            const isClickable = subActive
              ? isSubCandidate
              : canPick && !p.assigned && !isVetoBlocked;
            const isSelected = subActive
              ? pendingSubPick?.ncxid === p.ncxid
              : pendingPick?.ncxid === p.ncxid && pendingPick?.side === side;
            const assignedSlot = p.assigned
              ? slots.find(
                  (s) =>
                    (side === "away" ? s.awayNcxid : s.homeNcxid) === p.ncxid
                )?.slot
              : null;

            return (
              <div key={p.ncxid}>
                <button
                  disabled={!isClickable || actionLoading}
                  onClick={() =>
                    isClickable &&
                    (subActive
                      ? handleSelectSubCandidate(p.ncxid)
                      : handleSelectPlayer(p.ncxid, side))
                  }
                  className={`w-full rounded-xl border px-4 py-3 transition ${
                    side === "home" ? "text-right" : "text-left"
                  } ${
                    isSelected
                      ? "bg-cyan-950/50 border-cyan-400 ring-1 ring-cyan-400/50 shadow-lg shadow-cyan-500/10"
                      : isVetoBlocked
                        ? "bg-red-950/30 border-red-800/50 opacity-60 cursor-not-allowed"
                        : p.assigned
                          ? "bg-zinc-900/30 border-zinc-800 opacity-50 cursor-default"
                          : isClickable
                            ? "bg-zinc-900/60 border-zinc-700 hover:border-cyan-500/60 hover:bg-zinc-800/80 cursor-pointer"
                            : "bg-zinc-900/60 border-zinc-700 cursor-default"
                  }`}
                >
                  <div className={`flex items-center gap-3 ${side === "home" ? "flex-row-reverse" : ""}`}>
                    {img && (
                      <img src={img} alt={p.faction} className="w-8 h-8 object-contain" />
                    )}
                    <span className="font-semibold text-lg text-zinc-100 flex-1 truncate">
                      {p.name}
                    </span>
                    {isVetoBlocked && (
                      <span className="text-xs font-bold bg-red-600/40 text-red-300 px-2.5 py-1 rounded-full">
                        VETOED
                      </span>
                    )}
                    {assignedSlot != null && (
                      <span className="text-sm font-bold bg-purple-600/40 text-purple-300 px-2.5 py-1 rounded-full">
                        #{assignedSlot}
                      </span>
                    )}
                  </div>
                  {side === "away" ? (
                    <div className="mt-2 flex items-center gap-x-3 text-sm">
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-zinc-400">
                        <span className="text-cyan-500/70 font-semibold">S9</span>
                        <span>{p.wins} W - {p.losses} L</span>
                        <span>PPG: {p.ppg ?? "—"}</span>
                        <span>WAR: {p.war ?? "—"}</span>
                        <span>W%: {p.winPct ?? "—"}</span>
                      </div>
                      <span className="text-zinc-600 font-bold">|</span>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-zinc-500">
                        <span className="text-purple-400/70 font-semibold">ALL</span>
                        <span>{p.allTime.wins} W - {p.allTime.losses} L</span>
                        <span>aPPG: {p.allTime.adjPpg != null && p.allTime.adjPpg !== "—" ? Number(p.allTime.adjPpg).toFixed(1) : "—"}</span>
                        <span>W%: {p.allTime.winPct}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-x-3 text-sm justify-end">
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-zinc-500 justify-end">
                        <span className="text-purple-400/70 font-semibold">ALL</span>
                        <span>{p.allTime.wins} W - {p.allTime.losses} L</span>
                        <span>aPPG: {p.allTime.adjPpg != null && p.allTime.adjPpg !== "—" ? Number(p.allTime.adjPpg).toFixed(1) : "—"}</span>
                        <span>W%: {p.allTime.winPct}</span>
                      </div>
                      <span className="text-zinc-600 font-bold">|</span>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-zinc-400 justify-end">
                        <span className="text-cyan-500/70 font-semibold">S9</span>
                        <span>{p.wins} W - {p.losses} L</span>
                        <span>PPG: {p.ppg ?? "—"}</span>
                        <span>WAR: {p.war ?? "—"}</span>
                        <span>W%: {p.winPct ?? "—"}</span>
                      </div>
                    </div>
                  )}
                </button>

                {/* Confirm / Cancel buttons */}
                {isSelected && (
                  <div className={`flex gap-3 mt-2 ${side === "home" ? "justify-end mr-1" : "ml-1"}`}>
                    <button
                      onClick={subActive ? handleConfirmSub : handleConfirmPick}
                      disabled={actionLoading}
                      className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition disabled:opacity-50"
                    >
                      {actionLoading ? "Submitting..." : subActive ? "Confirm Sub" : "Confirm"}
                    </button>
                    <button
                      onClick={subActive ? () => setPendingSubPick(null) : handleCancelPick}
                      disabled={actionLoading}
                      className="px-6 py-2.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-bold transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ── Matchup slots ── */
  // Helper to find a player's faction from the rosters
  const getFaction = (ncxid: string | null, side: "away" | "home"): string | null => {
    if (!ncxid) return null;
    const roster = side === "away" ? awayRoster : homeRoster;
    return roster.find((p) => p.ncxid === ncxid)?.faction ?? null;
  };

  const renderSlots = () => (
    <div className="w-full max-w-md mx-auto flex flex-col gap-3">
      <h3 className="text-center text-base font-bold text-zinc-400 uppercase tracking-wider mb-2">
        Matchups
      </h3>
      {slots.map((s) => {
        const isActive = s.slot === series.currentSlot && !series.finalized;
        const isLocked = s.status === "locked";
        const awayFactionSrc = factionImg(getFaction(s.awayNcxid, "away") ?? "");
        const homeFactionSrc = factionImg(getFaction(s.homeNcxid, "home") ?? "");
        const subAwayActive = subTarget?.slot === s.slot && subTarget?.side === "away";
        const subHomeActive = subTarget?.slot === s.slot && subTarget?.side === "home";

        return (
          <div
            key={s.slot}
            className={`rounded-xl border px-4 py-3 transition-all ${
              s.pendingSub
                ? "border-amber-500/60 bg-amber-950/20"
                : isActive
                  ? "border-cyan-500/60 bg-cyan-950/30 shadow-lg shadow-cyan-500/10"
                  : isLocked
                    ? "border-green-600/30 bg-green-950/20"
                    : "border-zinc-800 bg-zinc-900/40"
            }`}
          >
            <div className="flex items-center justify-between text-sm text-zinc-500 mb-2">
              <span className="font-bold text-base">#{s.slot}</span>
              {s.pendingSub && <span className="text-amber-400 text-xs font-bold">PENDING SUB</span>}
              {!s.pendingSub && isLocked && <span className="text-green-400 text-xs font-bold">LOCKED</span>}
              {s.vetoed && <span className="text-red-400 text-xs font-bold">VETOED</span>}
              {isActive && !isLocked && (
                <span className="text-cyan-400 text-xs font-bold animate-pulse">ACTIVE</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-base">
              {/* Away side */}
              <div className={`flex-1 flex items-center justify-end gap-2 ${s.awayNcxid ? "" : "opacity-40"}`}>
                {s.awayNcxid ? (
                  <>
                    <div className="flex flex-col items-end min-w-0">
                      <span className="text-zinc-200 text-base font-semibold truncate">{s.awayName}</span>
                      <span className="text-xs text-zinc-500">{s.awayNcxid}</span>
                    </div>
                    {awayFactionSrc && (
                      <img src={awayFactionSrc} alt="" className="w-7 h-7 object-contain flex-shrink-0" />
                    )}
                  </>
                ) : (
                  <span className="text-zinc-600 italic text-sm">—</span>
                )}
              </div>

              <span className="text-zinc-600 text-sm font-bold px-1">vs</span>

              {/* Home side */}
              <div className={`flex-1 flex items-center gap-2 ${s.homeNcxid ? "" : "opacity-40"}`}>
                {s.homeNcxid ? (
                  <>
                    {homeFactionSrc && (
                      <img src={homeFactionSrc} alt="" className="w-7 h-7 object-contain flex-shrink-0" />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-zinc-200 text-base font-semibold truncate">{s.homeName}</span>
                      <span className="text-xs text-zinc-500">{s.homeNcxid}</span>
                    </div>
                  </>
                ) : (
                  <span className="text-zinc-600 italic text-sm">—</span>
                )}
              </div>
            </div>

            {/* Sub buttons (post-finalize) */}
            {series.finalized && (canSubAwaySide || canSubHomeSide) && (
              <div className="mt-3 flex gap-3 justify-center">
                {canSubAwaySide && s.awayNcxid && (
                  <button
                    onClick={() => handleStartSub(s.slot, "away")}
                    disabled={actionLoading}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50 ${
                      subAwayActive
                        ? "bg-emerald-500 text-white"
                        : "bg-emerald-700 hover:bg-emerald-600 text-white"
                    }`}
                  >
                    {subAwayActive ? "Cancel" : "Sub Away"}
                  </button>
                )}
                {canSubHomeSide && s.homeNcxid && (
                  <button
                    onClick={() => handleStartSub(s.slot, "home")}
                    disabled={actionLoading}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50 ${
                      subHomeActive
                        ? "bg-emerald-500 text-white"
                        : "bg-emerald-700 hover:bg-emerald-600 text-white"
                    }`}
                  >
                    {subHomeActive ? "Cancel" : "Sub Home"}
                  </button>
                )}
              </div>
            )}

            {/* Veto / Accept buttons */}
            {isActive && showVetoButtons && s.status === "awaiting_veto_window" && (
              <div className="mt-3 flex gap-3 justify-center">
                <button
                  onClick={handleAccept}
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition disabled:opacity-50"
                >
                  Accept
                </button>
                {!series.vetoUsed && series.currentSlot < 7 && (
                  <button
                    onClick={handleVeto}
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition disabled:opacity-50"
                  >
                    VETO
                    <span className="ml-1 text-xs opacity-70">(1 left)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Veto status indicator */}
      <div className="text-center text-sm mt-2">
        {series.vetoUsed ? (
          <span className="text-zinc-600">Veto used</span>
        ) : (
          <span className="text-amber-400/70">1 veto remaining (away)</span>
        )}
      </div>

      {/* Finalize button */}
      {allLocked && !series.finalized && (myRole === "home_captain" || myRole === "admin") && (
        <button
          onClick={handleFinalize}
          disabled={actionLoading}
          className="mt-4 w-full py-4 rounded-xl text-lg font-bold text-white bg-gradient-to-r from-pink-600 via-purple-500 to-cyan-500 hover:opacity-90 transition disabled:opacity-50 shadow-lg"
        >
          {actionLoading ? "Submitting..." : "Finalize Matchups"}
        </button>
      )}
      {allLocked && !series.finalized && myRole === "away_captain" && (
        <p className="text-center text-sm text-zinc-500 mt-3">
          Waiting for home captain to finalize...
        </p>
      )}

      {/* Re-Finalize button (post-finalize, when pending subs exist) */}
      {canRefinalize && (
        <button
          onClick={handleRefinalize}
          disabled={actionLoading}
          className="mt-4 w-full py-4 rounded-xl text-lg font-bold text-white bg-gradient-to-r from-amber-600 via-orange-500 to-emerald-500 hover:opacity-90 transition disabled:opacity-50 shadow-lg"
        >
          {actionLoading ? "Submitting..." : "Re-Finalize Matchups"}
        </button>
      )}

      {/* Admin reset */}
      {myRole === "admin" && (
        <button
          onClick={handleReset}
          disabled={actionLoading}
          className="mt-5 w-full py-3 rounded-lg text-sm font-semibold text-red-400 border border-red-800/40 bg-red-950/20 hover:bg-red-900/30 transition disabled:opacity-50"
        >
          Reset This Draft
        </button>
      )}
    </div>
  );

  return (
    <div className="py-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
          Matchup Builder
        </h2>
        <div className="flex items-center justify-center gap-4 mt-3">
          <span className="text-zinc-400 text-lg">{weekLabel}</span>
          <button
            onClick={() => {
              setSelectedAway(null);
              setSelectedHome(null);
              setForceSelection(true);
            }}
            className="text-sm text-zinc-500 hover:text-cyan-400 transition underline"
          >
            Change
          </button>
        </div>
      </div>

      {/* Status banner */}
      <div className={`mx-auto max-w-4xl rounded-xl border px-6 py-4 mb-8 text-center text-lg font-semibold ${bannerColor}`}>
        {bannerText}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mx-auto max-w-md rounded-lg px-4 py-2 mb-4 text-center text-sm font-medium ${
          toast.type === "ok" ? "bg-green-900/50 text-green-300" : "bg-red-900/50 text-red-300"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Main 3-column layout */}
      <div className="flex gap-6 items-start">
        {/* Away roster */}
        {renderRoster(awayRoster, "away", canPickAway)}

        {/* Matchup slots */}
        {renderSlots()}

        {/* Home roster */}
        {renderRoster(homeRoster, "home", canPickHome)}
      </div>
    </div>
  );
}
