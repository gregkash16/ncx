"use client";

import NotificationsDrawer from "../components/NotificationsDrawer";
import { Menu } from "lucide-react";

export default function DesktopHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <NotificationsDrawer
            title="Menu & Notifications"
            navLinks={[
              { href: "/", label: "Home" },
              { href: "/standings", label: "Standings" },
              { href: "/matchups", label: "Matchups" },
              { href: "/statistics", label: "Statistics" },
              { href: "/adv", label: "Adv. Statistics" },
              { href: "/report", label: "Report Game" },
              { href: "/players", label: "Players" },
            ]}
          >
            <button
              aria-label="Open menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900/70 hover:bg-neutral-800 active:scale-95"
            >
              <Menu className="h-5 w-5" />
            </button>
          </NotificationsDrawer>

          <a href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="NCX" className="h-7 w-7 rounded-lg" />
            <h1 className="text-lg font-extrabold tracking-wide bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(255,0,255,0.25)]">
              Nickel&nbsp;City&nbsp;X-Wing
            </h1>
          </a>
        </div>

        <div className="text-sm text-neutral-400">
          Desktop
        </div>
      </div>
    </header>
  );
}
