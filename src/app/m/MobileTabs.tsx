// src/app/m/MobileTabs.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ClipboardEdit } from "lucide-react"; // 📝 nice icon
import type { TabKey } from "@/app/components/HomeTabs";

const TABS: { key: TabKey; label: string; icon?: React.ReactNode }[] = [
  { key: "current",  label: "Current" },
  { key: "matchups", label: "Matchups" },
  { key: "standings",label: "Standings" },
  { key: "indstats", label: "Ind Stats" },
  { key: "advstats", label: "Adv" },
  { key: "players",  label: "Players" },
  { key: "report",   label: "Report", icon: <ClipboardEdit className="h-4 w-4" /> },
];

export default function MobileTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Determine active tab
  let active: TabKey = "current";
  if (pathname.startsWith("/m/matchups")) {
    active = "matchups";
  } else if (pathname.startsWith("/m/report")) {
    active = "report";
  } else {
    active = (searchParams.get("tab") as TabKey) || "current";
  }

  function go(tab: TabKey) {
    if (tab === "matchups") {
      const w = searchParams.get("w");
      const q = searchParams.get("q");
      const qs = new URLSearchParams();
      if (w) qs.set("w", w);
      if (q) qs.set("q", q);
      const href = qs.toString() ? `/m/matchups?${qs}` : `/m/matchups`;
      router.replace(href, { scroll: false });
      return;
    }

    if (tab === "report") {
      router.replace("/m/report", { scroll: false });
      return;
    }

    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.delete("q");

    if (tab === "current") {
      params.delete("tab");
      const next = params.toString();
      router.replace(next ? `/m?${next}` : `/m`, { scroll: false });
      return;
    }

    params.set("tab", tab);
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
