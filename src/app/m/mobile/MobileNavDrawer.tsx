// src/app/m/mobile/MobileNavDrawer.tsx
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Home as HomeIcon,
  CalendarDays,
  List as ListIcon,
  Trophy as TrophyIcon,
  BarChart3,
  Users as UsersIcon,
  ClipboardEdit,
  X,
} from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function MobileNavDrawer({ open, onClose }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Guard portal usage until client is mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const links = useMemo(() => {
    const w = searchParams.get("w");
    const q = searchParams.get("q");

    const currentHref = (() => {
      const qs = new URLSearchParams();
      if (w) qs.set("w", w);
      return qs.toString() ? `/m/current?${qs.toString()}` : "/m/current";
    })();

    const matchupsHref = (() => {
      const qs = new URLSearchParams();
      if (w) qs.set("w", w);
      if (q) qs.set("q", q);
      return qs.toString() ? `/m/matchups?${qs.toString()}` : "/m/matchups";
    })();

    return {
      primary: [
        { href: "/m", label: "Home", icon: HomeIcon },
        { href: currentHref, label: "Current", icon: CalendarDays },
        { href: matchupsHref, label: "Matchups", icon: ListIcon },
        { href: "/m/standings", label: "Standings", icon: TrophyIcon },
        { href: "/m/report", label: "Report", icon: ClipboardEdit },
      ],
      stats: [
        { href: "/m/indstats", label: "Ind Stats", icon: BarChart3 },
        { href: "/m/advstats", label: "Adv Stats", icon: BarChart3 },
        { href: "/m/players", label: "Players", icon: UsersIcon },
      ],
    };
  }, [searchParams]);

  function isActive(href: string) {
    if (href === "/m") return pathname === "/m";
    return pathname.startsWith(href);
  }

  if (!open || !mounted) return null;

  const sheet = (
    <div className="fixed inset-0 z-[2147483647]">
      {/* FULLY OPAQUE overlay so nothing shows through */}
      <div className="absolute inset-0 bg-[var(--ncx-bg-start)]" />

      {/* TOP HALF: navigation panel */}
      <aside
        className="absolute inset-0 flex flex-col bg-[var(--ncx-bg-panel)]"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--ncx-border)] p-3">
          <div className="flex items-center gap-2">
            <img src="/logo.webp" alt="NCX" className="h-7 w-7 rounded-lg" />
            <div className="text-sm font-extrabold tracking-wide text-[var(--ncx-text-primary)]">
              NCX
            </div>
          </div>

          <button
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ncx-border)] bg-[rgb(0_0_0/0.28)] hover:bg-[rgb(0_0_0/0.40)] active:scale-95 text-[var(--ncx-text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content inside the top half */}
        <nav className="flex-1 overscroll-contain overflow-y-auto p-2">

          {/* Primary links */}
          <div className="space-y-1">
            {links.primary.map((l) => {
              const Icon = l.icon;
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                    active
                      ? "bg-[rgb(var(--ncx-primary-rgb)/0.12)] text-[var(--ncx-text-primary)] border border-[rgb(var(--ncx-primary-rgb)/0.25)]"
                      : "text-[var(--ncx-text-primary)]/80 hover:bg-[rgb(0_0_0/0.24)] hover:text-[var(--ncx-text-primary)] border border-transparent"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-5 w-5" />
                  {l.label}
                </Link>
              );
            })}
          </div>

          {/* Stats links always visible */}
          <div className="mt-3 border-t border-[var(--ncx-border)] pt-3">
            <div className="px-3 pb-2 text-[11px] font-semibold tracking-wide text-[var(--ncx-text-muted)]">
              STATS
            </div>
            <div className="space-y-1">
              {links.stats.map((l) => {
                const Icon = l.icon;
                const active = pathname.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                      active
                        ? "bg-[rgb(var(--ncx-primary-rgb)/0.12)] text-[var(--ncx-text-primary)] border border-[rgb(var(--ncx-primary-rgb)/0.25)]"
                        : "text-[var(--ncx-text-primary)]/80 hover:bg-[rgb(0_0_0/0.24)] hover:text-[var(--ncx-text-primary)] border border-transparent"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-5 w-5" />
                    {l.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </aside>
    </div>
  );

  return createPortal(sheet, document.body);
}
