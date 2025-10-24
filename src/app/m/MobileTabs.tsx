// src/app/m/MobileTabs.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { TabKey } from "@/app/components/HomeTabs";

const TABS: { key: TabKey; label: string }[] = [
  { key: "current",  label: "Current" },
  { key: "matchups", label: "Matchups" },
  { key: "standings",label: "Standings" },
  { key: "indstats", label: "Ind Stats" },
  { key: "advstats", label: "Adv" },
  { key: "players",  label: "Players" },
  { key: "report",   label: "Report" },
];

export default function MobileTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = (searchParams.get("tab") as TabKey) || "current";

  function go(tab: TabKey) {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (tab === "current") params.delete("tab");
    else params.set("tab", tab);

    // Clear the matchups search when switching away from it (mirrors desktop)
    if (tab !== "matchups") params.delete("q");

    const next = params.toString();
    const href = next ? `${pathname}?${next}` : pathname;
    router.replace(href, { scroll: false });
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Mobile tabs"
    >
      <ul className="mx-auto grid max-w-screen-sm grid-cols-7">
        {TABS.map((t) => (
          <li key={t.key}>
            <button
              className={`w-full py-2 text-[11px] ${
                active === t.key ? "font-semibold" : "text-neutral-400"
              }`}
              onClick={() => go(t.key)}
              aria-current={active === t.key ? "page" : undefined}
              type="button"
            >
              {t.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

