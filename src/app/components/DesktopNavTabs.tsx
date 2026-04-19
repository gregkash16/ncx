// src/app/components/DesktopNavTabs.tsx
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const LIVE_MAX_MS = 2 * 60 * 60 * 1000;
const LIVE_CHANGED_EVENT = "ncx:live-changed";

function parseStartedAtMs(s?: string | null): number {
  if (!s) return 0;
  const t = Date.parse(s);
  if (Number.isFinite(t)) return t;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return 0;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

type TabKey =
  | "home"
  | "current"
  | "matchups"
  | "standings"
  | "indstats"
  | "advstats"
  | "players"
  | "report"
  | "prefs"
  | "podcast"
  | "prevseasons"
  | "arcade"
  | "stream"
  | "playoffs"
  | "builder"
  | "xzone";

const row1Base: Array<{ key: TabKey; label: string; href: string }> = [
  { key: "home",      label: "Home",         href: "/" },
  { key: "current",   label: "Current Week", href: "/?tab=current" },
  { key: "matchups",  label: "Matchups",     href: "/?tab=matchups" },
  { key: "standings", label: "Standings",    href: "/?tab=standings" },
  { key: "report",    label: "Report a Game", href: "/?tab=report" },
  { key: "stream",    label: "Stream",        href: "/?tab=stream" },
];

const row2Base: Array<{ key: TabKey; label: string; href: string }> = [
  { key: "playoffs",  label: "Playoffs",     href: "/?tab=playoffs" },
  { key: "indstats",  label: "Ind. Stats",   href: "/?tab=indstats" },
  { key: "advstats",  label: "Adv. Stats",   href: "/?tab=advstats" },
  { key: "players",     label: "Players",       href: "/?tab=players" },
  { key: "podcast",     label: "Podcast",       href: "/?tab=podcast" },
  { key: "prevseasons", label: "Prev. Seasons", href: "/?tab=prevseasons" },
  { key: "arcade",      label: "Arcade",         href: "/?tab=arcade" },
];

export default function DesktopNavTabs({ showBuilder = false }: { showBuilder?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawTab = (searchParams.get("tab") as TabKey | null) ?? "home";
  const preSeasonEnabled = process.env.NEXT_PUBLIC_PRE_SEASON === "true";

  const row1WithBuilder = showBuilder
    ? [...row1Base, { key: "builder" as TabKey, label: "Builder", href: "/?tab=builder" }]
    : row1Base;

  const row2 = preSeasonEnabled
    ? [...row2Base, { key: "prefs" as TabKey, label: "S9 Signups", href: "/?tab=prefs" }]
    : row2Base;

  const active: TabKey | null = pathname === "/" ? rawTab : null;

  const [hasLive, setHasLive] = useState(false);

  const row1 = hasLive
    ? row1WithBuilder.flatMap((tab) =>
        tab.key === "matchups"
          ? [tab, { key: "xzone" as TabKey, label: "X-ZONE", href: "/?tab=xzone" }]
          : [tab]
      )
    : row1WithBuilder;

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/live-matchups", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const list: Array<{ startedAt: string }> = Array.isArray(json?.live) ? json.live : [];
        const now = Date.now();
        const anyLive = list.some((e) => {
          const t = parseStartedAtMs(e.startedAt);
          return t && now - t < LIVE_MAX_MS;
        });
        if (!cancelled) setHasLive(anyLive);
      } catch {
        // ignore transient errors
      }
    }

    check();
    const id = setInterval(check, 30_000);
    const onLiveChanged = () => check();
    window.addEventListener(LIVE_CHANGED_EVENT, onLiveChanged);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener(LIVE_CHANGED_EVENT, onLiveChanged);
    };
  }, []);

  function renderTab({ key, label, href }: { key: TabKey; label: string; href: string }) {
    const isActive =
      pathname === "/" &&
      !(!preSeasonEnabled && key === "prefs") &&
      active === key;

    const isLiveTab = (key === "matchups" || key === "xzone") && hasLive;

    return (
      <Link
        key={key}
        href={href}
        scroll={false}
        className={[
          "group relative overflow-hidden rounded-xl border px-6 py-3 font-semibold transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2",
          isLiveTab ? "ncx-live-fire border-red-500" : "",
        ].join(" ")}
        style={{
          background: "var(--ncx-bg-panel)",
          ...(isLiveTab ? {} : { borderColor: "var(--ncx-border)" }),
          color: "var(--ncx-text-primary)",
        }}
      >
        {/* FILL LAYER — active state */}
        <span
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
          style={{
            opacity: isActive ? 1 : 0,
            background: "linear-gradient(to right, var(--ncx-hero-from), var(--ncx-hero-via), var(--ncx-hero-to))",
          }}
        />

        {/* HOVER FILL */}
        {!isActive && (
          <span
            className="pointer-events-none absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: "linear-gradient(to right, var(--ncx-hero-from), var(--ncx-hero-via), var(--ncx-hero-to))",
            }}
          />
        )}

        <span className="relative z-10 inline-flex items-center gap-2">
          {isLiveTab && <span className="ncx-live-dot" aria-hidden="true" />}
          {label}
        </span>
      </Link>
    );
  }

  return (
    <div className="mt-3 mb-4 flex flex-col items-center gap-2">
      {/* Row 1: Home, Current Week, Matchups, Standings, Ind. Stats, Adv. Stats */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {row1.map(renderTab)}
      </div>

      {/* Row 2: Players, Podcast, Report, Prev. Seasons (+ S9 Signups if enabled) */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {row2.map(renderTab)}
      </div>
    </div>
  );
}