// src/app/components/DesktopNavTabs.tsx
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type TabKey =
  | "home"
  | "current"
  | "matchups"
  | "standings"
  | "indstats"
  | "advstats"
  | "players"
  | "report"
  | "prefs"
  | "podcast"; // ✅ add

const tabsBase: Array<{ key: TabKey; label: string; href: string }> = [
  { key: "home", label: "Home", href: "/" },
  { key: "current", label: "Current Week", href: "/?tab=current" },
  { key: "matchups", label: "Matchups", href: "/?tab=matchups" },
  { key: "standings", label: "Standings", href: "/?tab=standings" },
  { key: "indstats", label: "Ind. Stats", href: "/?tab=indstats" },
  { key: "advstats", label: "Adv. Stats", href: "/?tab=advstats" },
  { key: "players", label: "Players", href: "/?tab=players" },
  { key: "podcast", label: "Podcast", href: "/?tab=podcast" },
  { key: "report", label: "Report a Game", href: "/?tab=report" },
];

export default function DesktopNavTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ✅ If tab=prefs but preseason is off, we treat it as home for highlighting.
  const rawTab = (searchParams.get("tab") as TabKey | null) ?? "home";

  // ✅ Only show the Season 9 pill when PRE_SEASON is enabled.
  // IMPORTANT: This must be NEXT_PUBLIC_ to be readable in a client component.
  const preSeasonEnabled = process.env.NEXT_PUBLIC_PRE_SEASON === "true";

  const tabs: Array<{ key: TabKey; label: string; href: string }> = preSeasonEnabled
    ? [
        ...tabsBase,
        // ✅ pill comes after Report a Game
        { key: "prefs", label: "S9 Signups", href: "/?tab=prefs" },
      ]
    : tabsBase;

  const active: TabKey | null = pathname === "/" ? rawTab : null;

  const btnBase =
    "group relative overflow-hidden rounded-xl border border-purple-500/40 bg-zinc-900 px-6 py-3 font-semibold text-white shadow-lg transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-pink-500/50";

  const gradientLayer =
    "pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100";

  const labelLayer = "relative z-10";

  return (
    <div className="mt-3 mb-4 flex justify-center">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {tabs.map(({ key, label, href }) => {
          // If preseason is off and user somehow is on tab=prefs, don't show it as active.
          const isActive =
            pathname === "/" &&
            ((key === "prefs" && !preSeasonEnabled) ? false : active === key);

          return (
            <Link key={key} href={href} scroll={false} className={btnBase}>
              <span
                className={`${gradientLayer} bg-gradient-to-r from-pink-600 via-purple-500 to-cyan-500 ${
                  isActive ? "opacity-100" : ""
                }`}
              />
              <span className={labelLayer}>{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
