"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Trophy as TrophyIcon,
  BarChart3,
  Users as UsersIcon,
  List as ListIcon, // ✅ new for "Matchups"
} from "lucide-react";

const TABS = [
  { href: "/m",            label: "Current",   icon: Home },
  { href: "/m/matchups",   label: "Matchups",  icon: ListIcon },
  { href: "/m/standings",  label: "Standings", icon: TrophyIcon },
  { href: "/m/indstats",   label: "Ind Stats", icon: BarChart3 },
  { href: "/m/advstats",   label: "Adv",       icon: BarChart3 },
  { href: "/m/players",    label: "Players",   icon: UsersIcon },
];


export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Mobile tabs"
    >
      {/* use flex + justify-center to center the nav */}
      <ul className="mx-auto flex max-w-screen-sm justify-center gap-4 px-2">
        {TABS.map((t) => {
          const active =
            t.href === "/m" ? pathname === "/m" : pathname.startsWith(t.href);
          const Icon = t.icon;

          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`flex flex-col items-center justify-center px-2 py-2 text-[10px] transition-colors ${
                  active
                    ? "text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 font-semibold"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  size={20}
                  strokeWidth={2}
                  className={`mb-0.5 ${
                    active
                      ? "text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400"
                      : "text-neutral-400"
                  } transition-all duration-200`}
                />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
