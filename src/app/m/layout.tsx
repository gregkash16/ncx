// src/app/m/layout.tsx
import type { ReactNode } from "react";
import MobileBottomNav from "./mobile/MobileBottomNav";
import NotificationsDrawer from "../components/NotificationsDrawer";
import { Menu } from "lucide-react";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const metadata = {
  title: "NCX (Mobile)",
};

export default async function MobileLayout({ children }: { children: ReactNode }) {
  // Server-side session (works in mobile + PWA, no client component required)
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | (typeof session extends { user: infer U } ? U : { name?: string | null; image?: string | null })
    | undefined;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 p-3">
          {/* Left cluster: menu, logo, title */}
          <div className="flex items-center gap-3">
            <NotificationsDrawer>
              <button
                aria-label="Open menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900/70 hover:bg-neutral-800 active:scale-95"
              >
                <Menu className="h-5 w-5" />
              </button>
            </NotificationsDrawer>

            <img src="/logo.png" alt="NCX" className="h-7 w-7 rounded-lg" />
            <h1 className="text-lg font-extrabold tracking-wide bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(255,0,255,0.25)]">
              Nickel&nbsp;City&nbsp;X-Wing
            </h1>
          </div>

          {/* Right cluster: Auth status + desktop link */}
          <div className="flex items-center gap-2">
            {/* Auth status (server-rendered) */}
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

            <a
              href="/?desktop=1"
              className="text-xs font-medium text-neutral-300 underline underline-offset-4 hover:text-white"
            >
              Desktop
            </a>
          </div>
        </div>
      </header>

      {/* Main content (scrollable even with bottom nav); respect iOS safe areas */}
      <main className="flex-1 overflow-y-auto pb-[76px] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-screen-sm px-3 pb-[env(safe-area-inset-bottom)]">
          {children}
        </div>
      </main>

      {/* Bottom nav (fixed) */}
      <MobileBottomNav />
    </div>
  );
}
