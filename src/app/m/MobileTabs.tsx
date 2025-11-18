// src/app/m/MobileTabs.tsx
"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ClipboardEdit } from "lucide-react"; // 📝 nice icon
import type { TabKey } from "@/app/components/HomeTabs";

const TABS: { key: TabKey; label: string; icon?: ReactNode }[] = [
  { key: "current",  label: "Current" },
  { key: "matchups", label: "Matchups" },
  { key: "standings",label: "Standings" },
  { key: "indstats", label: "Ind Stats" },
  { key: "advstats", label: "Adv" },
  { key: "players",  label: "Players" },
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

  // 🔑 Determine active tab purely from pathname
  let active: TabKey = "current";

  if (pathname.startsWith("/m/matchups")) {
    active = "matchups";
  } else if (pathname.startsWith("/m/standings")) {
    active = "standings";
  } else if (pathname.startsWith("/m/indstats")) {
    active = "indstats";
  } else if (pathname.startsWith("/m/advstats")) {
    active = "advstats";
  } else if (pathname.startsWith("/m/players")) {
    active = "players";
  } else if (pathname.startsWith("/m/report")) {
    active = "report";
  } else if (pathname.startsWith("/m/current")) {
    active = "current";
  } else {
    // `/m` (home landing) and anything else default to Current
    active = "current";
  }

  function go(tab: TabKey) {
    if (tab === "matchups") {
      // Preserve w + q when jumping into Matchups
      const w = searchParams.get("w");
      const q = searchParams.get("q");
      const qs = new URLSearchParams();
      if (w) qs.set("w", w);
      if (q) qs.set("q", q);
      const href = qs.toString()
        ? `/m/matchups?${qs.toString()}`
        : `/m/matchups`;
      router.replace(href, { scroll: false });
      return;
    }

    if (tab === "current") {
      // Preserve w when jumping to Current Week
      const w = searchParams.get("w");
      const qs = new URLSearchParams();
      if (w) qs.set("w", w);
      const href = qs.toString()
        ? `/m/current?${qs.toString()}`
        : `/m/current`;
      router.replace(href, { scroll: false });
      return;
    }

    if (tab === "standings") {
      router.replace("/m/standings", { scroll: false });
      return;
    }

    if (tab === "indstats") {
      router.replace("/m/indstats", { scroll: false });
      return;
    }

    if (tab === "advstats") {
      router.replace("/m/advstats", { scroll: false });
      return;
    }

    if (tab === "players") {
      router.replace("/m/players", { scroll: false });
      return;
    }

    if (tab === "report") {
      router.replace("/m/report", { scroll: false });
      return;
    }
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
              className={`w-full flex flex-col items-center justify-center gap-0.5 py-3 text-[12px] ${
                active === t.key ? "font-semibold text-white" : "text-neutral-400"
              }`}
              onClick={() => go(t.key)}
              aria-current={active === t.key ? "page" : undefined}
              type="button"
            >
              {t.icon && <span>{t.icon}</span>}
              <span>{t.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
