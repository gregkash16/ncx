// src/app/m/MobileTabs.tsx
"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ClipboardEdit } from "lucide-react";
import type { TabKey } from "@/app/components/HomeTabs";

const NAV_PX = 64;

const TABS: { key: TabKey; label: string; icon?: ReactNode }[] = [
  { key: "current", label: "Current" },
  { key: "matchups", label: "Matchups" },
  { key: "standings", label: "Standings" },
  { key: "indstats", label: "Ind Stats" },
  { key: "advstats", label: "Adv" },
  { key: "players", label: "Players" },
  {
    key: "report",
    label: "Report",
    icon: <ClipboardEdit className="h-4 w-4" />,
  },
];

export default function MobileTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  let active: TabKey = "current";

  if (pathname.startsWith("/m/matchups")) active = "matchups";
  else if (pathname.startsWith("/m/standings")) active = "standings";
  else if (pathname.startsWith("/m/indstats")) active = "indstats";
  else if (pathname.startsWith("/m/advstats")) active = "advstats";
  else if (pathname.startsWith("/m/players")) active = "players";
  else if (pathname.startsWith("/m/report")) active = "report";
  else active = "current";

  function go(tab: TabKey) {
    if (tab === "matchups") {
      const qs = new URLSearchParams();
      const w = searchParams.get("w");
      const q = searchParams.get("q");
      if (w) qs.set("w", w);
      if (q) qs.set("q", q);
      router.replace(
        qs.toString() ? `/m/matchups?${qs}` : "/m/matchups",
        { scroll: false }
      );
      return;
    }

    if (tab === "current") {
      const qs = new URLSearchParams();
      const w = searchParams.get("w");
      if (w) qs.set("w", w);
      router.replace(
        qs.toString() ? `/m/current?${qs}` : "/m/current",
        { scroll: false }
      );
      return;
    }

    router.replace(`/m/${tab}`, { scroll: false });
  }

  return (
    <nav
      aria-label="Mobile tabs"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--ncx-border)] bg-[var(--ncx-panel-bg)]/90 backdrop-blur"
      style={{
        height: `calc(${NAV_PX}px + env(safe-area-inset-bottom))`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <ul className="mx-auto grid h-[64px] max-w-screen-sm grid-cols-7">
        {TABS.map((t) => (
          <li key={t.key}>
            <button
              type="button"
              aria-current={active === t.key ? "page" : undefined}
              onClick={() => go(t.key)}
              className={`flex h-full w-full flex-col items-center justify-center gap-0.5 text-[12px] ${
                active === t.key
                  ? "font-semibold text-[var(--ncx-text-primary)]"
                  : "text-[var(--ncx-text-muted)]"
              }`}
            >
              {t.icon && (
                <span
                  className={
                    active === t.key
                      ? "text-[rgb(var(--ncx-primary-rgb))]"
                      : ""
                  }
                >
                  {t.icon}
                </span>
              )}
              <span>{t.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
