// src/app/m/layout.tsx
import type { ReactNode } from "react";

import MobileBottomNav from "./mobile/MobileBottomNav";
import MobileNavButton from "./mobile/MobileNavButton";
import AuthStatus from "./components/AuthStatus";
import MobileHeaderTitle from "./components/MobileHeaderTitle";
import { AuthSetup } from "./layout-auth-setup";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDiscordMapCached } from "@/lib/googleSheets";

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

  // Get NCXID for header
  let headerText = "DRAFT LEAGUE";
  if (session?.user) {
    try {
      const rawSessionId = (session.user as any).discordId ?? (session.user as any).id;
      const sessionId = String(rawSessionId ?? "")
        .trim()
        .replace(/[<@!>]/g, "")
        .replace(/\D/g, "");

      if (sessionId) {
        const discordMap = await getDiscordMapCached();
        const match = (discordMap as any)?.[sessionId];

        if (match) {
          const { ncxid } = match as any;
          headerText = ncxid;
        }
      }
    } catch (err) {
      // On error, keep default
    }
  }

  const NAV_PX = 64;

  return (
    <div className="w-screen max-w-screen overflow-x-hidden min-h-[100dvh] flex flex-col ncx-gradient-bg text-[var(--ncx-text-primary)]">
      {/* Auth setup for iOS deeplinks */}
      <AuthSetup />

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
            <h1 className="text-2xl font-extrabold tracking-tight ncx-hero-title ncx-hero-glow leading-tight">
              <MobileHeaderTitle defaultText={headerText} />
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
        className="flex-1 w-full overflow-x-hidden"
        style={{
          paddingTop: `calc(65px + env(safe-area-inset-top))`,
          paddingBottom: `calc(${NAV_PX}px + env(safe-area-inset-bottom))`,
        }}
      >
        <div className="w-full mx-auto max-w-screen-sm px-3 box-border">{children}</div>
      </main>

      {/* Bottom Nav (single fixed owner) */}
      <MobileBottomNav />
    </div>
  );
}
