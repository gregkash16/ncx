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
  { href: "/m", label: "Home", icon: HomeIcon },
  { href: "/m/current", label: "Current", icon: CalendarDays },
  { href: "/m/matchups", label: "Matchups", icon: ListIcon },
  { href: "/m/standings", label: "Standings", icon: TrophyIcon },
  // Special stats tab: tap vs long-press
  { href: "/m/indstats", label: "Stats", icon: BarChart3 },
  { href: "/m/report", label: "Report", icon: ClipboardEdit },
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
      className="relative h-full border-t border-[var(--ncx-border)] bg-[rgb(0_0_0/0.45)] backdrop-blur supports-[backdrop-filter]:backdrop-blur-md"
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

          const activeLabelCls = "font-semibold text-[rgb(var(--ncx-primary-rgb))]";
          const inactiveLabelCls = "text-[var(--ncx-text-muted)] hover:text-[var(--ncx-text-primary)]";

          const activeIconCls = "text-[rgb(var(--ncx-primary-rgb))]";
          const inactiveIconCls = "text-[var(--ncx-text-muted)]";

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
                    active ? activeLabelCls : inactiveLabelCls
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon
                    size={22}
                    strokeWidth={2}
                    className={`mb-0.5 transition-all duration-200 ${
                      active ? activeIconCls : inactiveIconCls
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
            href = qs.toString()
              ? `/m/matchups?${qs.toString()}`
              : "/m/matchups";
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
                  active ? activeLabelCls : inactiveLabelCls
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  size={22}
                  strokeWidth={2}
                  className={`mb-0.5 transition-all duration-200 ${
                    active ? activeIconCls : inactiveIconCls
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
          <div className="pointer-events-auto flex gap-2 rounded-2xl border border-[var(--ncx-border)] bg-[rgb(0_0_0/0.55)] px-3 py-2 shadow-lg">
            <button
              type="button"
              onClick={() => goStatsRoute("/m/indstats")}
              className="rounded-lg border border-[var(--ncx-border)] bg-[rgb(0_0_0/0.28)] px-3 py-1 text-xs font-semibold text-[var(--ncx-text-primary)] hover:bg-[rgb(0_0_0/0.40)]"
            >
              Ind Stats
            </button>
            <button
              type="button"
              onClick={() => goStatsRoute("/m/advstats")}
              className="rounded-lg border border-[var(--ncx-border)] bg-[rgb(0_0_0/0.28)] px-3 py-1 text-xs font-semibold text-[var(--ncx-text-primary)] hover:bg-[rgb(0_0_0/0.40)]"
            >
              Adv Stats
            </button>
            <button
              type="button"
              onClick={() => goStatsRoute("/m/players")}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--ncx-border)] bg-[rgb(0_0_0/0.28)] px-3 py-1 text-xs font-semibold text-[var(--ncx-text-primary)] hover:bg-[rgb(0_0_0/0.40)]"
            >
              <UsersIcon className="h-3 w-3 text-[rgb(var(--ncx-primary-rgb))]" />
              Players
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
