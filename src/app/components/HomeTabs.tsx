'use client';

import { useState } from "react";

type HomeTabsProps = {
  currentWeekPanel: React.ReactNode;
  standingsPanel?: React.ReactNode;
  matchupsPanel?: React.ReactNode;
  reportPanel?: React.ReactNode;
};

type TabKey = "current" | "standings" | "matchups" | "report";

export default function HomeTabs({
  currentWeekPanel,
  standingsPanel,
  matchupsPanel,
  reportPanel,
}: HomeTabsProps) {
  const [active, setActive] = useState<TabKey>("current");

  const btnBase =
    "group relative overflow-hidden rounded-xl border border-purple-500/40 bg-zinc-900 px-6 py-3 font-semibold text-white shadow-lg transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-pink-500/50";
  const gradientLayer =
    "pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100";
  const labelLayer = "relative z-10";

  const isActive = (key: TabKey) => active === key;

  return (
    <div className="w-full">
      {/* Buttons */}
      <div className="flex flex-wrap justify-center gap-4 mt-3">
        {/* Current Week */}
        <button
          type="button"
          onClick={() => setActive("current")}
          className={btnBase}
        >
          <span
            className={`${gradientLayer} bg-gradient-to-r from-pink-600 via-purple-500 to-cyan-500 ${
              isActive("current") ? "opacity-100" : ""
            }`}
          />
          <span className={labelLayer}>Current Week</span>
        </button>

        {/* Matchups */}
        <button
          type="button"
          onClick={() => setActive("matchups")}
          className={btnBase}
        >
          <span
            className={`${gradientLayer} bg-gradient-to-r from-pink-600 via-purple-500 to-cyan-500 ${
              isActive("matchups") ? "opacity-100" : ""
            }`}
          />
          <span className={labelLayer}>Matchups</span>
        </button>

        {/* View Standings */}
        <button
          type="button"
          onClick={() => setActive("standings")}
          className={btnBase}
        >
          <span
            className={`${gradientLayer} bg-gradient-to-r from-pink-600 via-purple-500 to-cyan-500 ${
              isActive("standings") ? "opacity-100" : ""
            }`}
          />
          <span className={labelLayer}>View Standings</span>
        </button>

        {/* Report a Game */}
        <button
          type="button"
          onClick={() => setActive("report")}
          className={btnBase}
        >
          <span
            className={`${gradientLayer} bg-gradient-to-r from-pink-600 via-purple-500 to-cyan-500 ${
              isActive("report") ? "opacity-100" : ""
            }`}
          />
          <span className={labelLayer}>Report a Game</span>
        </button>
      </div>

      {/* Panels */}
      <div className="relative max-w-6xl mx-auto px-6 pb-24 mt-6">
        {active === "current" && <div>{currentWeekPanel}</div>}
        {active === "matchups" && <div>{matchupsPanel ?? null}</div>}
        {active === "standings" && <div>{standingsPanel ?? null}</div>}
        {active === "report" && (
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-zinc-300">
            <h2 className="text-xl font-semibold text-pink-400 mb-2">
              Report a Game
            </h2>
            <p>Coming soon — we’ll build the report form next.</p>
          </div>
        )}
      </div>
    </div>
  );
}
