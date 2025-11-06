// src/app/m/layout.tsx
import type { ReactNode } from "react";
import MobileBottomNav from "./mobile/MobileBottomNav";
import PushToggle from "../components/PushToggle";

export const metadata = {
  title: "NCX (Mobile)",
};

export default function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 p-3">
          {/* Left: logo + gradient title */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="NCX" className="h-7 w-7 rounded-lg" />
            <h1 className="text-lg font-extrabold tracking-wide bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(255,0,255,0.25)]">
              Nickel&nbsp;City&nbsp;X-Wing
            </h1>
          </div>

          {/* Right: notifications + link */}
          <div className="flex items-center gap-2">
            {/* Push notifications toggle (client component rendered inside server layout) */}
            <PushToggle />

            {/* Desktop link */}
            <a
              href="/?desktop=1"
              className="text-xs font-medium text-neutral-300 underline underline-offset-4 hover:text-white"
            >
              Desktop
            </a>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-[76px] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-screen-sm px-3 pb-[env(safe-area-inset-bottom)]">
          {children}
        </div>
      </main>

      {/* Bottom navigation */}
      <MobileBottomNav />
    </div>
  );
}
