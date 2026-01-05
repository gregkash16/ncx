// src/app/m/layout.tsx
import type { ReactNode } from "react";

import MobileBottomNav from "./mobile/MobileBottomNav";
import MobileNavButton from "./mobile/MobileNavButton";
import NotificationsDrawer from "../components/NotificationsDrawer";
import { Settings } from "lucide-react";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const metadata = {
  title: "NCX (Mobile)",
};

export default async function MobileLayout({ children }: { children: ReactNode }) {
  // Server-side session (works in mobile + PWA, no client component required)
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | (typeof session extends { user: infer U }
        ? U
        : { name?: string | null; image?: string | null })
    | undefined;

  // Height of the fixed bottom nav (keep in sync with MobileBottomNav wrapper)
  const NAV_PX = 64;

  return (
    <div className="min-h-[100svh] flex flex-col bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 p-3">
          {/* Left cluster: hamburger, logo, title */}
          <div className="flex items-center gap-3">
            <MobileNavButton />

            <img src="/logo.webp" alt="NCX" className="h-7 w-7 rounded-lg" />
            <h1 className="text-lg font-extrabold tracking-wide bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(255,0,255,0.25)]">
              Nickel&nbsp;City&nbsp;X-Wing
            </h1>
          </div>

          {/* Right cluster: auth + notifications */}
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name ?? "You"}
                    className="h-7 w-7 rounded-full border border-neutral-700"
                  />
                ) : null}

                <span className="hidden sm:inline text-xs font-medium text-neutral-200">
                  {user.name ?? "You"}
                </span>

                <NotificationsDrawer>
                  <button
                    aria-label="Notification settings"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900/70 hover:bg-neutral-800 active:scale-95"
                  >
                    <Settings className="h-5 w-5" />
                  </button>
                </NotificationsDrawer>

                {/* Sign out via POST with callback back to /m */}
                <form method="post" action="/api/auth/signout" className="m-0 p-0">
                  <input type="hidden" name="callbackUrl" value="/m" />
                  <button
                    type="submit"
                    className="rounded-lg border border-neutral-800 bg-neutral-900/70 px-2 py-1 text-[10px] text-neutral-300 hover:bg-neutral-800"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            ) : (
              <a
                href="/api/auth/signin/discord?callbackUrl=%2Fm"
                className="rounded-lg border border-neutral-800 bg-neutral-900/70 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800"
              >
                Sign in
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main content:
          - Document scroll
          - Bottom padding reserves space for fixed bottom nav + safe area */}
      <main
        className="flex-1 pt-[env(safe-area-inset-top)]"
        style={{
          paddingBottom: `calc(${NAV_PX}px + env(safe-area-inset-bottom))`,
        }}
      >
        <div className="mx-auto max-w-screen-sm px-3">{children}</div>
      </main>

      {/* Fixed bottom nav wrapper */}
      <div
        className="fixed inset-x-0 bottom-0 z-30"
        style={{
          height: `calc(${NAV_PX}px + env(safe-area-inset-bottom))`,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <MobileBottomNav />
      </div>
    </div>
  );
}
