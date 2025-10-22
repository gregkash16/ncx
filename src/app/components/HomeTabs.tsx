'use client';

import React, { useEffect, useMemo, useState, isValidElement, cloneElement, ReactElement } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type TabKey = "current" | "matchups" | "standings" | "report" | "indstats";

type ReportPanelLikeProps = {
  goToTab?: (key: TabKey) => void;
};

type HomeTabsProps = {
  currentWeekPanel: React.ReactNode;
  matchupsPanel?: React.ReactNode;
  standingsPanel?: React.ReactNode;
  indStatsPanel?: React.ReactNode;
  reportPanel?: ReactElement<ReportPanelLikeProps> | null;
};

export default function HomeTabs({
  currentWeekPanel,
  matchupsPanel,
  standingsPanel,
  indStatsPanel,
  reportPanel,
}: HomeTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlTab = (searchParams.get("tab") as TabKey | null) ?? null;
  const [active, setActive] = useState<TabKey>(urlTab ?? "current");

  // Keep active tab in sync with URL (when clicking a matchup link)
  useEffect(() => {
    if (urlTab && urlTab !== active) setActive(urlTab);
  }, [urlTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const btnBase =
    "group relative overflow-hidden rounded-xl border border-purple-500/40 bg-zinc-900 px-6 py-3 font-semibold text-white shadow-lg transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-pink-500/50";
  const gradientLayer =
    "pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100";
  const labelLayer = "relative z-10";

  const isActive = (key: TabKey) => active === key;

  // Update the URL when user clicks buttons (keep existing ?q= if present)
  function goToTab(key: TabKey) {
    const q = searchParams.get("q");
    const usp = new URLSearchParams(searchParams.toString());
    usp.set("tab", key);
    if (q) usp.set("q", q); else usp.delete("q");
    router.replace(`?${usp.toString()}`, { scroll: false });
    setActive(key);
  }

  const reportWithProp =
    reportPanel && isValidElement<ReportPanelLikeProps>(reportPanel)
      ? cloneElement(reportPanel, { goToTab })
      : reportPanel;

  return (
    <div className="w-full">
      {/* Tab Buttons */}
      <div className="flex flex-wrap justify-center gap-4 mt-3 mb-4">
        {([
          { key: "current" as const, label: "Current Week" },
          { key: "matchups" as const, label: "Matchups" },
          { key: "standings" as const, label: "Standings" },
          { key: "indstats" as const, label: "Ind. Stats" },
          { key: "report" as const, label: "Report a Game" },
        ]).map(({ key, label }) => (
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

      {/* Panels */}
      <div
        className={`relative mx-auto px-2 sm:px-4 ${
          active === "indstats" ? "w-full max-w-[115rem]" : "max-w-6xl"
        }`}
      >
        {active === "current" && currentWeekPanel}
        {active === "matchups" && matchupsPanel}
        {active === "standings" && standingsPanel}
        {active === "indstats" && indStatsPanel}
        {active === "report" && reportWithProp}
      </div>
    </div>
  );
}
