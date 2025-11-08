// src/components/HomeTabs.tsx
'use client';

import React, {
  useState,
  isValidElement,
  cloneElement,
  ReactElement,
  useEffect,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";


export type TabKey =
  | "current"
  | "matchups"
  | "standings"
  | "indstats"
  | "advstats"
  | "players"
  | "report";

type ReportPanelLikeProps = {
  goToTab?: (key: TabKey) => void;
};

type HomeTabsProps = {
  currentWeekPanel: React.ReactNode;
  matchupsPanel?: React.ReactNode;
  standingsPanel?: React.ReactNode;
  indStatsPanel?: React.ReactNode;
  advStatsPanel?: React.ReactNode;
  playersPanel?: React.ReactNode;
  reportPanel?: ReactElement<ReportPanelLikeProps> | null;
  hideButtons?: boolean;
};

export default function HomeTabs({
  currentWeekPanel,
  matchupsPanel,
  standingsPanel,
  indStatsPanel,
  advStatsPanel,
  playersPanel,
  reportPanel,
  hideButtons = false,
}: HomeTabsProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const urlTab = (searchParams.get("tab") as TabKey) || "current";
  const [active, setActive] = useState<TabKey>(urlTab);

  useEffect(() => {
    if (urlTab !== active) setActive(urlTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab]);

  const btnBase =
    "group relative overflow-hidden rounded-xl border border-purple-500/40 bg-zinc-900 px-6 py-3 font-semibold text-white shadow-lg transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-pink-500/50";
  const gradientLayer =
    "pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100";
  const labelLayer = "relative z-10";

  const isActive = (key: TabKey) => active === key;

  useEffect(() => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));

    if (active === "current") params.delete("tab");
    else params.set("tab", active);

    if (active !== "matchups") params.delete("q");

    const next = params.toString();
    const href = next ? `${pathname}?${next}` : pathname;
    const curr = searchParams.toString();

    if (curr !== next) router.replace(href, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function goToTab(key: TabKey) {
    if (key === "matchups") {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      params.set("tab", "matchups");
      params.delete("q");
      const href = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(href, { scroll: false });
    }
    setActive(key);
  }

  const reportWithProp =
    reportPanel && isValidElement<ReportPanelLikeProps>(reportPanel)
      ? cloneElement(reportPanel, { goToTab })
      : reportPanel;

  return (
    <div className="w-full">
      {/* Header: perfectly centered tab row + compact toggle */}
      {!hideButtons && (
        <div className="mt-3 mb-4 flex justify-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { key: "current" as const, label: "Current Week" },
              { key: "matchups" as const, label: "Matchups" },
              { key: "standings" as const, label: "Standings" },
              { key: "indstats" as const, label: "Ind. Stats" },
              { key: "advstats" as const, label: "Adv. Stats" },
              { key: "players" as const, label: "Players" },
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
        </div>
      )}



      {/* Panels */}
      <div
        className={`relative mx-auto px-2 sm:px-4 ${
          active === "indstats" || active === "advstats"
            ? "w-full max-w-[115rem]"
            : "max-w-6xl"
        }`}
      >
        {active === "current" && currentWeekPanel}
        {active === "matchups" && matchupsPanel}
        {active === "standings" && standingsPanel}
        {active === "indstats" && indStatsPanel}
        {active === "advstats" && advStatsPanel}
        {active === "players" && playersPanel}
        {active === "report" && reportWithProp}
      </div>
    </div>
  );
}
