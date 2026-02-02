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

const NAV_PX = 64;

const TABS = [
  { href: "/m", label: "Home", icon: HomeIcon },
  { href: "/m/current", label: "Current", icon: CalendarDays },
  { href: "/m/matchups", label: "Matchups", icon: ListIcon },
  { href: "/m/standings", label: "Standings", icon: TrophyIcon },
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
    }, 500);
  }

  function endPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!longPressTriggered.current) {
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
      aria-label="Mobile tabs"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--ncx-border)] bg-[rgb(0_0_0/0.45)] backdrop-blur supports-[backdrop-filter]:backdrop-blur-md"
      style={{
        height: `calc(${NAV_PX}px + env(safe-area-inset-bottom))`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <ul className="mx-auto flex h-[64px] max-w-screen-sm justify-between px-3">
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

          const activeLabelCls =
            "font-semibold text-[rgb(var(--ncx-primary-rgb))]";
          const inactiveLabelCls =
            "text-[var(--ncx-text-muted)] hover:text-[var(--ncx-text-primary)]";

          const activeIconCls = "text-[rgb(var(--ncx-primary-rgb))]";
          const inactiveIconCls = "text-[var(--ncx-text-muted)]";

          if (isStatsTab) {
            return (
              <li key={t.href} className="flex-1 text-center">
                <button
                  type="button"
                  onPointerDown={startLongPress}
                  onPointerUp={endPress}
                  onPointerLeave={cancelPress}
                  className={`flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
                    active ? activeLabelCls : inactiveLabelCls
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon
                    size={22}
                    strokeWidth={2}
                    className={`transition-all ${
                      active ? activeIconCls : inactiveIconCls
                    }`}
                  />
                  {t.label}
                </button>
              </li>
            );
          }

          let href = t.href;

          if (t.href === "/m/current") {
            const w = searchParams.get("w");
            const qs = new URLSearchParams();
            if (w) qs.set("w", w);
            href = qs.toString() ? `/m/current?${qs}` : "/m/current";
          } else if (t.href === "/m/matchups") {
            const w = searchParams.get("w");
            const q = searchParams.get("q");
            const qs = new URLSearchParams();
            if (w) qs.set("w", w);
            if (q) qs.set("q", q);
            href = qs.toString()
              ? `/m/matchups?${qs}`
              : "/m/matchups";
          }

          return (
            <li key={t.href} className="flex-1 text-center">
              <Link
                href={href}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
                  active ? activeLabelCls : inactiveLabelCls
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  size={22}
                  strokeWidth={2}
                  className={`transition-all ${
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
              onClick={() => goStatsRoute("/m/indstats")}
              className="rounded-lg border border-[var(--ncx-border)] bg-[rgb(0_0_0/0.28)] px-3 py-1 text-xs font-semibold"
            >
              Ind Stats
            </button>
            <button
              onClick={() => goStatsRoute("/m/advstats")}
              className="rounded-lg border border-[var(--ncx-border)] bg-[rgb(0_0_0/0.28)] px-3 py-1 text-xs font-semibold"
            >
              Adv Stats
            </button>
            <button
              onClick={() => goStatsRoute("/m/players")}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--ncx-border)] bg-[rgb(0_0_0/0.28)] px-3 py-1 text-xs font-semibold"
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
