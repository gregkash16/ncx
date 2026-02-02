// src/app/m/layout.tsx
import type { ReactNode } from "react";

import MobileBottomNav from "./mobile/MobileBottomNav";
import MobileNavButton from "./mobile/MobileNavButton";
import NotificationsDrawer from "../components/NotificationsDrawer";
import AuthStatus from "./components/AuthStatus";

import { Settings } from "lucide-react";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const metadata = {
  title: "NCX (Mobile)",
};

export default async function MobileLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | (typeof session extends { user: infer U }
        ? U
        : { name?: string | null; image?: string | null })
    | undefined;

  const NAV_PX = 64;

  return (
    <div className="min-h-[100dvh] flex flex-col ncx-gradient-bg text-[var(--ncx-text-primary)]">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 border-b border-[var(--ncx-border)] bg-[var(--ncx-panel-bg)] backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
        {/* Status-bar fill */}
        <div
          className="w-full"
          style={{ height: "env(safe-area-inset-top)" }}
        />

        {/* Actual header content */}
        <div className="flex items-center justify-between gap-3 p-3">
          {/* Left */}
          <div className="flex items-center gap-3">
            <MobileNavButton />
            <img src="/logo.webp" alt="NCX" className="h-7 w-7 rounded-lg" />
            <h1 className="text-lg font-extrabold tracking-wide ncx-hero-title ncx-hero-glow">
              Nickel&nbsp;City&nbsp;X-Wing
            </h1>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <NotificationsDrawer>
              <button
                aria-label="Notifications"
                className="
                  relative
                  rounded-lg
                  border border-[var(--ncx-border)]
                  bg-[var(--ncx-bg-elev)]
                  p-2
                  hover:bg-[var(--ncx-bg-elev-hover)]
                  active:scale-[0.97]
                  transition
                "
              >
                <Settings className="h-4 w-4" />
              </button>
            </NotificationsDrawer>

            {/* Auth status */}
            <AuthStatus />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        className="flex-1"
        style={{
          paddingBottom: `calc(${NAV_PX}px + env(safe-area-inset-bottom))`,
        }}
      >
        <div className="mx-auto max-w-screen-sm px-3">{children}</div>
      </main>

      {/* Bottom Nav (single fixed owner) */}
      <MobileBottomNav />
    </div>
  );
}
