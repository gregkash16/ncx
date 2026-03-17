// src/app/m/mobile/MobileBottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Home as HomeIcon,
  Trophy as TrophyIcon,
  List as ListIcon,
  ClipboardEdit,
  CalendarDays,
  Settings,
} from "lucide-react";
import NotificationsDrawer from "../../components/NotificationsDrawer";

const NAV_PX = 64;

const TABS = [
  { href: "/m", label: "Home", icon: HomeIcon },
  { href: "/m/current", label: "Current", icon: CalendarDays },
  { href: "/m/matchups", label: "Matchups", icon: ListIcon },
  { href: "/m/standings", label: "Standings", icon: TrophyIcon },
  { href: "/m/report", label: "Report", icon: ClipboardEdit },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();


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
          const active = t.href === "/m"
            ? pathname === "/m"
            : pathname.startsWith(t.href);

          const Icon = t.icon;

          const activeLabelCls =
            "font-semibold text-[rgb(var(--ncx-primary-rgb))]";
          const inactiveLabelCls =
            "text-[var(--ncx-text-muted)] hover:text-[var(--ncx-text-primary)]";

          const activeIconCls = "text-[rgb(var(--ncx-primary-rgb))]";
          const inactiveIconCls = "text-[var(--ncx-text-muted)]";

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

        {/* Settings/Notifications */}
        <li className="flex-1 text-center">
          <NotificationsDrawer>
            <button
              className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] transition-colors text-[var(--ncx-text-muted)] hover:text-[var(--ncx-text-primary)]"
              aria-label="Notification settings"
            >
              <Settings
                size={22}
                strokeWidth={2}
                className="transition-all"
              />
              Settings
            </button>
          </NotificationsDrawer>
        </li>
      </ul>
    </nav>
  );
}
