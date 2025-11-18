// src/app/m/mobile/MobileBottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Home as HomeIcon,
  Trophy as TrophyIcon,
  BarChart3,
  Users as UsersIcon,
  List as ListIcon,
  ClipboardEdit,
  CalendarDays,
} from "lucide-react";
import { useRef, useState } from "react";

const TABS = [
  { href: "/m",           label: "Home",      icon: HomeIcon },
  { href: "/m/current",   label: "Current",   icon: CalendarDays },
  { href: "/m/matchups",  label: "Matchups",  icon: ListIcon },
  { href: "/m/standings", label: "Standings", icon: TrophyIcon },
  // Special stats tab: tap vs long-press
  { href: "/m/indstats",  label: "Stats",     icon: BarChart3 },
  { href: "/m/report",    label: "Report",    icon: ClipboardEdit },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showStatsMenu, setShowStatsMenu] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  function startLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setShowStatsMenu(true);
    }, 500); // ~0.5s long press
  }

  function endPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!longPressTriggered.current) {
      // treat as a normal tap: go to Ind Stats
      router.push("/m/indstats");
    }
  }

  function cancelPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function goStatsRoute(path: string) {
    setShowStatsMenu(false);
    router.push(path);
  }

  return (
    <nav
      className="relative h-full border-t border-neutral-800 bg-neutral-950/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md"
      aria-label="Mobile tabs"
    >
      <ul className="mx-auto flex max-w-screen-sm justify-between px-3">
        {TABS.map((t) => {
          const isStatsTab = t.href === "/m/indstats";

          const active = isStatsTab
            ? ["/m/indstats", "/m/advstats", "/m/players"].some((p) =>
                pathname.startsWith(p)
              )
            : t.href === "/m"
            ? pathname === "/m"
            : pathname.startsWith(t.href);

          const Icon = t.icon;

          if (isStatsTab) {
            // Special stats tab: tap vs long-press
            return (
              <li key={t.href} className="flex-1 text-center">
                <button
                  type="button"
                  onPointerDown={startLongPress}
                  onPointerUp={endPress}
                  onPointerLeave={cancelPress}
                  className={`flex w-full flex-col items-center justify-center py-3 text-[11px] transition-colors ${
                    active
                      ? "font-semibold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon
                    size={22}
                    strokeWidth={2}
                    className={`mb-0.5 transition-all duration-200 ${
                      active ? "text-pink-400" : "text-neutral-400"
                    }`}
                  />
                  {t.label}
                </button>
              </li>
            );
          }

          // Build hrefs that preserve useful query params
          let href = t.href;

          if (t.href === "/m/current") {
            // Preserve ?w when going to Current
            const w = searchParams.get("w");
            const qs = new URLSearchParams();
            if (w) qs.set("w", w);
            href = qs.toString() ? `/m/current?${qs.toString()}` : "/m/current";
          } else if (t.href === "/m/matchups") {
            // Preserve ?w and ?q for Matchups
            const w = searchParams.get("w");
            const q = searchParams.get("q");
            const qs = new URLSearchParams();
            if (w) qs.set("w", w);
            if (q) qs.set("q", q);
            href = qs.toString() ? `/m/matchups?${qs.toString()}` : "/m/matchups";
          } else if (t.href === "/m") {
            // Home: just go to /m (drop filters)
            href = "/m";
          } else if (t.href === "/m/standings") {
            href = "/m/standings";
          } else if (t.href === "/m/report") {
            href = "/m/report";
          }

          return (
            <li key={t.href} className="flex-1 text-center">
              <Link
                href={href}
                className={`flex flex-col items-center justify-center py-3 text-[11px] transition-colors ${
                  active
                    ? "font-semibold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  size={22}
                  strokeWidth={2}
                  className={`mb-0.5 transition-all duration-200 ${
                    active ? "text-pink-400" : "text-neutral-400"
                  }`}
                />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Long-press stats menu */}
      {showStatsMenu && (
        <div className="pointer-events-none absolute inset-x-0 -top-2 mb-2 flex justify-center">
          <div className="pointer-events-auto flex gap-2 rounded-2xl border border-neutral-800 bg-neutral-950/95 px-3 py-2 shadow-lg">
            <button
              type="button"
              onClick={() => goStatsRoute("/m/indstats")}
              className="rounded-lg bg-neutral-900/80 px-3 py-1 text-xs font-semibold text-neutral-100 hover:bg-neutral-800"
            >
              Ind Stats
            </button>
            <button
              type="button"
              onClick={() => goStatsRoute("/m/advstats")}
              className="rounded-lg bg-neutral-900/80 px-3 py-1 text-xs font-semibold text-neutral-100 hover:bg-neutral-800"
            >
              Adv Stats
            </button>
            <button
              type="button"
              onClick={() => goStatsRoute("/m/players")}
              className="inline-flex items-center gap-1 rounded-lg bg-neutral-900/80 px-3 py-1 text-xs font-semibold text-neutral-100 hover:bg-neutral-800"
            >
              <UsersIcon className="h-3 w-3" />
              Players
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
