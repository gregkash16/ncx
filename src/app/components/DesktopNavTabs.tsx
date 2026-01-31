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
  | "podcast";

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

  const rawTab = (searchParams.get("tab") as TabKey | null) ?? "home";

  // IMPORTANT: must be NEXT_PUBLIC_
  const preSeasonEnabled = process.env.NEXT_PUBLIC_PRE_SEASON === "true";

  const tabs = preSeasonEnabled
    ? [...tabsBase, { key: "prefs", label: "S9 Signups", href: "/?tab=prefs" }]
    : tabsBase;

  const active: TabKey | null = pathname === "/" ? rawTab : null;

  return (
    <div className="mt-3 mb-4 flex justify-center">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {tabs.map(({ key, label, href }) => {
          const isActive =
            pathname === "/" &&
            !(!preSeasonEnabled && key === "prefs") &&
            active === key;

          return (
            <Link
              key={key}
              href={href}
              scroll={false}
              className="group relative overflow-hidden rounded-xl border px-6 py-3 font-semibold transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2"
              style={{
                background: "var(--ncx-bg-panel)",
                borderColor: "var(--ncx-border)",
                color: "var(--ncx-text-primary)",
              }}
            >
              {/* FILL LAYER — this is the missing piece */}
              <span
                className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
                style={{
                  opacity: isActive ? 1 : 0,
                  background: `linear-gradient(
                    to right,
                    var(--ncx-hero-from),
                    var(--ncx-hero-via),
                    var(--ncx-hero-to)
                  )`,
                }}
              />

              {/* HOVER FILL — kicks in when not active */}
              {!isActive && (
                <span
                  className="pointer-events-none absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: `linear-gradient(
                      to right,
                      var(--ncx-hero-from),
                      var(--ncx-hero-via),
                      var(--ncx-hero-to)
                    )`,
                  }}
                />
              )}

              {/* Text */}
              <span className="relative z-10">{label}</span>
            </Link>

          );
        })}
      </div>
    </div>
  );
}
