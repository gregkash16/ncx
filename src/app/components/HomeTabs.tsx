// src/app/components/HomeTabs.tsx
"use client";

import React, { isValidElement, cloneElement, ReactElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type TabKey =
  | "home"
  | "current"
  | "matchups"
  | "standings"
  | "indstats"
  | "advstats"
  | "players"
  | "podcast" // ✅ NEW
  | "report"
  | "prefs"
  | "team"
  | "playoffs";

const MATCHUPS: TabKey = "matchups";
function isMatchups(k: TabKey): k is "matchups" {
  return k === MATCHUPS;
}

type ReportPanelLikeProps = {
  goToTab?: (key: TabKey) => void;
};

type HomeTabsProps = {
  homePanel?: React.ReactNode;
  currentWeekPanel: React.ReactNode;
  matchupsPanel?: React.ReactNode;
  standingsPanel?: React.ReactNode;
  indStatsPanel?: React.ReactNode;
  advStatsPanel?: React.ReactNode;
  playersPanel?: React.ReactNode;

  // ✅ NEW: podcast panel
  podcastPanel?: React.ReactNode;

  reportPanel?: ReactElement<ReportPanelLikeProps> | null;

  // ✅ Season 9 prefs panel (only shown when enabled)
  prefsPanel?: React.ReactNode;

  teamPanel?: React.ReactNode; // still supported, just hidden
  playoffsPanel?: React.ReactNode; // secret tab
  hideButtons?: boolean;

  // ✅ gate the pill + routing for prefs
  preSeasonEnabled?: boolean;
};

export default function HomeTabs({
  homePanel,
  currentWeekPanel,
  matchupsPanel,
  standingsPanel,
  indStatsPanel,
  advStatsPanel,
  playersPanel,

  // ✅ IMPORTANT: actually destructure it so it's in scope
  podcastPanel,

  reportPanel,
  prefsPanel,
  teamPanel,
  playoffsPanel,
  hideButtons = false,
  preSeasonEnabled = false,
}: HomeTabsProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const hasTeam = !!teamPanel;
  const hasPlayoffs = !!playoffsPanel;

  // Only consider prefs "available" if we're in preseason AND a panel is provided
  const hasPrefs = !!prefsPanel && preSeasonEnabled;

  // Podcast is always allowed if a panel is provided (no preseason gating)
  const hasPodcast = !!podcastPanel;

  // 🔑 Single source of truth: URL `tab` param
  const urlTabRaw = (searchParams.get("tab") as TabKey) || "home";
  let active: TabKey = urlTabRaw;

  // If tab points to something unavailable, fall back to home
  if (active === "team" && !hasTeam) active = "home";
  if (active === "playoffs" && !hasPlayoffs) active = "home";
  if (active === "prefs" && !hasPrefs) active = "home";
  if (active === "podcast" && !hasPodcast) active = "home";

  const btnBase =
    "group relative overflow-hidden rounded-xl border border-purple-500/40 bg-zinc-900 px-6 py-3 font-semibold text-white shadow-lg transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-pink-500/50";
  const gradientLayer =
    "pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100";
  const labelLayer = "relative z-10";

  const isActive = (key: TabKey) => active === key;

  function goToTab(key: TabKey) {
    // Prevent navigation to prefs when disabled (also cleans URL if someone clicks old link)
    if (key === "prefs" && !hasPrefs) {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      params.delete("tab");
      params.delete("q");
      const href = params.toString() ? `${pathname}?${params}` : pathname;
      router.replace(href, { scroll: false });
      return;
    }

    // Prevent navigation to podcast if panel isn't provided (safety)
    if (key === "podcast" && !hasPodcast) {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      params.delete("tab");
      params.delete("q");
      const href = params.toString() ? `${pathname}?${params}` : pathname;
      router.replace(href, { scroll: false });
      return;
    }

    const params = new URLSearchParams(Array.from(searchParams.entries()));

    if (isMatchups(key)) {
      params.set("tab", MATCHUPS);
      const href = params.toString() ? `${pathname}?${params}` : pathname;
      router.replace(href, { scroll: false });
      return;
    }

    if (key === "team") {
      if (hasTeam) {
        params.set("tab", "team");
        const href = params.toString() ? `${pathname}?${params}` : pathname;
        router.replace(href, { scroll: false });
      }
      return;
    }

    if (key === "home") {
      params.delete("tab");
    } else {
      params.set("tab", key);
    }

    if (!isMatchups(key)) {
      params.delete("q");
    }

    const href = params.toString() ? `${pathname}?${params}` : pathname;
    router.replace(href, { scroll: false });
  }

  const reportWithProp =
    reportPanel && isValidElement<ReportPanelLikeProps>(reportPanel)
      ? cloneElement(reportPanel, { goToTab })
      : reportPanel;

  // Buttons (prefs only appears when preseason enabled)
  const buttons: Array<{ key: TabKey; label: string }> = [
    { key: "home", label: "Home" },
    { key: "current", label: "Current Week" },
    { key: MATCHUPS, label: "Matchups" },
    { key: "standings", label: "Standings" },
    { key: "indstats", label: "Ind. Stats" },
    { key: "advstats", label: "Adv. Stats" },
    { key: "players", label: "Players" },
    ...(hasPodcast ? [{ key: "podcast" as const, label: "Podcast" }] : []),
    { key: "report", label: "Report a Game" },
    ...(hasPrefs ? [{ key: "prefs" as const, label: "SEASON 9" }] : []),
  ];

  return (
    <div className="w-full">
      {!hideButtons && (
        <div className="mt-3 mb-4 flex justify-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {buttons.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => goToTab(key)}
                className={btnBase}
              >
                <span
                  className={`${gradientLayer} bg-gradient-to-r from-pink-600 via-purple-500 to-cyan-500 ${
                    isActive(key) ? "opacity-100" : ""
                  }`}
                />
                <span className={labelLayer}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        className={`relative mx-auto px-2 sm:px-4 ${
          active === "indstats" || active === "advstats"
            ? "w-full max-w-[115rem]"
            : "max-w-6xl"
        }`}
      >
        {active === "home" && homePanel}
        {active === "current" && currentWeekPanel}
        {isMatchups(active) && matchupsPanel}
        {active === "standings" && standingsPanel}
        {active === "indstats" && indStatsPanel}
        {active === "advstats" && advStatsPanel}
        {active === "players" && playersPanel}

        {/* ✅ Podcast */}
        {active === "podcast" && podcastPanel}

        {active === "report" && reportWithProp}

        {/* ✅ prefs panel (only when enabled) */}
        {active === "prefs" && hasPrefs && prefsPanel}

        {/* ✅ still render Team panel when tab=team, even without a button */}
        {active === "team" && hasTeam && teamPanel}

        {/* ✅ secret Playoffs tab, only if panel provided */}
        {active === "playoffs" && hasPlayoffs && playoffsPanel}
      </div>
    </div>
  );
}
