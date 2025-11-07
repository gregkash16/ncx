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

  // Determine active tab:
  // - If we're on /m/matchups (route), force "matchups"
  // - Otherwise, fall back to ?tab=... (default "current")
  let active: TabKey = "current";
  if (pathname.startsWith("/m/matchups")) {
    active = "matchups";
  } else {
    active = (searchParams.get("tab") as TabKey) || "current";
  }

  function go(tab: TabKey) {
    // Route-based navigation for Matchups; query-tab for everything else under /m
    if (tab === "matchups") {
      // Preserve existing week (w) and query (q) if present
      const w = searchParams.get("w");
      const q = searchParams.get("q");
      const qs = new URLSearchParams();
      if (w) qs.set("w", w);
      if (q) qs.set("q", q);
      const href = qs.toString() ? `/m/matchups?${qs.toString()}` : `/m/matchups`;
      router.replace(href, { scroll: false });
      return;
    }

    // Navigating to any non-matchups tab keeps us on /m
    // - "current": remove tab (default) and KEEP 'w' so week view persists
    // - other tabs: set tab, CLEAR 'q' (matchups search) and 'w' (week) to avoid cross-tab leakage
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    // Always clear the matchups search when leaving matchups
    params.delete("q");

    if (tab === "current") {
      // Current is the default tab, so remove explicit tab marker
      params.delete("tab");
      // Keep 'w' as-is so week selection on Current persists
      const next = params.toString();
      router.replace(next ? `/m?${next}` : `/m`, { scroll: false });
      return;
    }

    // Other tabs live under /m with ?tab=...
    params.set("tab", tab);
    // Don't carry week selection into unrelated tabs
    params.delete("w");

    const next = params.toString();
    router.replace(next ? `/m?${next}` : `/m`, { scroll: false });
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
