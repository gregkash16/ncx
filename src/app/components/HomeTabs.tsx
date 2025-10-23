'use client';

import React, {
  useState,
  isValidElement,
  cloneElement,
  ReactElement,
  useEffect,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type TabKey = "current" | "matchups" | "standings" | "report" | "indstats" | "players";

/** The only extra prop we inject into the Report panel */
type ReportPanelLikeProps = {
  goToTab?: (key: TabKey) => void;
};

type HomeTabsProps = {
  currentWeekPanel: React.ReactNode;
  matchupsPanel?: React.ReactNode;
  standingsPanel?: React.ReactNode;
  indStatsPanel?: React.ReactNode;
  reportPanel?: ReactElement<ReportPanelLikeProps> | null;
  playersPanel?: React.ReactNode; // ← NEW
};

export default function HomeTabs({
  currentWeekPanel,
  matchupsPanel,
  standingsPanel,
  indStatsPanel,
  reportPanel,
  playersPanel,
}: HomeTabsProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // ---- State: active tab
  const urlTab = (searchParams.get("tab") as TabKey) || "current";
  const [active, setActive] = useState<TabKey>(urlTab);

  // ---- Keep active in sync if URL changes externally (e.g., link click from CurrentWeekCard)
  useEffect(() => {
    if (urlTab !== active) setActive(urlTab);
  }, [urlTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const btnBase =
    "group relative overflow-hidden rounded-xl border border-purple-500/40 bg-zinc-900 px-6 py-3 font-semibold text-white shadow-lg transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-pink-500/50";
  const gradientLayer =
    "pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100";
  const labelLayer = "relative z-10";

  const isActive = (key: TabKey) => active === key;

  // ---- When active changes (from button OR URL), keep URL in sync
  useEffect(() => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));

    // reflect current tab (omit for "current" if you prefer a clean root)
    if (active === "current") params.delete("tab");
    else params.set("tab", active);

    // if not on matchups, nuke q so it won't linger
    if (active !== "matchups") params.delete("q");

    const next = params.toString();
    const href = next ? `${pathname}?${next}` : pathname;

    // Only push a replace if something actually changed
    const curr = searchParams.toString();
    if (curr !== next) {
      router.replace(href, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]); // depend just on active to avoid loops

  // ---- Button click handler (internal tab navigation)
  function goToTab(key: TabKey) {
    // If opening Matchups via the tab button, start clean (clear q)
    if (key === "matchups") {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      params.set("tab", "matchups");
      params.delete("q");
      const href = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(href, { scroll: false });
    }
    setActive(key);
  }

  // Inject goToTab into the report panel (only if it’s a valid element)
  const reportWithProp =
    reportPanel && isValidElement<ReportPanelLikeProps>(reportPanel)
      ? cloneElement(reportPanel, { goToTab })
      : reportPanel;

  return (
    <div className="w-full">
      {/* Tab Buttons */}
      <div className="flex flex-wrap justify-center gap-4 mt-3 mb-4">
        {[
          { key: "current" as const, label: "Current Week" },
          { key: "matchups" as const, label: "Matchups" },
          { key: "standings" as const, label: "Standings" },
          { key: "indstats" as const, label: "Ind. Stats" },
          { key: "players" as const, label: "Players" },  // ← NEW
          { key: "report" as const, label: "Report a Game" },
        ].map(({ key, label }) => (
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
        {active === "players" && playersPanel}
        {active === "report" && reportWithProp}
      </div>
    </div>
  );
}
