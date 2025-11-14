"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const tabs = [
  { key: "current", label: "Current Week", href: "/?tab=current" },
  { key: "matchups", label: "Matchups", href: "/?tab=matchups" },
  { key: "standings", label: "Standings", href: "/?tab=standings" },
  { key: "indstats", label: "Ind. Stats", href: "/?tab=indstats" },
  { key: "advstats", label: "Adv. Stats", href: "/?tab=advstats" },
  { key: "players", label: "Players", href: "/?tab=players" },
  { key: "report", label: "Report a Game", href: "/?tab=report" },
];

export type TabKey =
  | "current"
  | "matchups"
  | "standings"
  | "indstats"
  | "advstats"
  | "players"
  | "report";

export default function DesktopNavTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramTab = (searchParams.get("tab") as TabKey | null) ?? "current";

  const active =
    pathname === "/" ? paramTab : (null as TabKey | null); // only highlight on home

  const btnBase =
    "group relative overflow-hidden rounded-xl border border-purple-500/40 bg-zinc-900 px-6 py-3 font-semibold text-white shadow-lg transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-pink-500/50";

  const gradientLayer =
    "pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100";

  const labelLayer = "relative z-10";

  return (
    <div className="mt-3 mb-4 flex justify-center">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {tabs.map(({ key, label, href }) => {
          const isActive = pathname === "/" && active === key;
          return (
            <Link key={key} href={href} scroll={false}>
              <button type="button" className={btnBase}>
                <span
                  className={`${gradientLayer} bg-gradient-to-r from-pink-600 via-purple-500 to-cyan-500 ${
                    isActive ? "opacity-100" : ""
                  }`}
                />
                <span className={labelLayer}>{label}</span>
              </button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
