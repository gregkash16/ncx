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
      <header
        className="sticky z-20 border-b border-[var(--ncx-border)] bg-[var(--ncx-panel-bg)]/70 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md"
        style={{ top: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between gap-3 p-3">
          <div className="flex items-center gap-3">
            <MobileNavButton />
            <img src="/logo.webp" alt="NCX" className="h-7 w-7 rounded-lg" />
            <h1 className="text-lg font-extrabold tracking-wide ncx-hero-title ncx-hero-glow">
              Nickel&nbsp;City&nbsp;X-Wing
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2">
                {user.image && (
                  <img
                    src={user.image}
                    alt={user.name ?? "You"}
                    className="h-7 w-7 rounded-full border border-[var(--ncx-border)]"
                  />
                )}

                <NotificationsDrawer>
                  <button
                    aria-label="Notification settings"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ncx-border)] bg-[var(--ncx-panel-bg)]/70"
                  >
                    <Settings className="h-5 w-5" />
                  </button>
                </NotificationsDrawer>

                <form method="post" action="/api/auth/signout">
                  <input type="hidden" name="callbackUrl" value="/m" />
                  <button
                    type="submit"
                    className="rounded-lg border border-[var(--ncx-border)] bg-[var(--ncx-panel-bg)]/70 px-2 py-1 text-[10px] text-[var(--ncx-text-muted)]"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            ) : (
              <a
                href="/api/auth/signin/discord?callbackUrl=%2Fm"
                className="rounded-lg border border-[var(--ncx-border)] bg-[var(--ncx-panel-bg)]/70 px-3 py-1.5 text-xs font-medium"
              >
                Sign in
              </a>
            )}
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
