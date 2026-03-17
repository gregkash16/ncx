// src/app/m/layout.tsx
import type { ReactNode } from "react";

import MobileBottomNav from "./mobile/MobileBottomNav";
import MobileNavButton from "./mobile/MobileNavButton";
import AuthStatus from "./components/AuthStatus";

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
      {/* Top Bar - Fixed */}
      <header className="fixed inset-x-0 top-0 z-20 border-b border-[var(--ncx-border)] bg-[var(--ncx-panel-bg)] backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
        {/* Status-bar fill */}
        <div
          className="w-full"
          style={{ height: "env(safe-area-inset-top)" }}
        />

        {/* Actual header content */}
        <div className="flex items-center justify-between gap-3 p-3 pb-4">
          {/* Left */}
          <div>
            <MobileNavButton />
          </div>

          {/* Center - Title */}
          <div className="flex-1 text-center">
            <h1 className="text-sm font-extrabold tracking-tight ncx-hero-title ncx-hero-glow leading-tight">
              <div>Nickel City</div>
              <div>X-Wing</div>
            </h1>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Auth status */}
            <AuthStatus />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        className="flex-1"
        style={{
          paddingTop: `calc(65px + env(safe-area-inset-top))`,
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
