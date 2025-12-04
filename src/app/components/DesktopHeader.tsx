// src/app/components/DesktopHeader.tsx
"use client";

import NotificationsDrawer from "../components/NotificationsDrawer";
import { Menu } from "lucide-react";
import { useSession, signOut, signIn } from "next-auth/react";

export default function DesktopHeader() {
  const { data } = useSession();
  const user = data?.user;

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
      {/* Reduce vertical padding to make the bar shorter */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
        {/* Left: hamburger + logo */}
        <div className="flex items-center gap-3">
          <NotificationsDrawer title="Notifications">
            <button
              aria-label="Open menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900/70 hover:bg-neutral-800 active:scale-95"
            >
              <Menu className="h-5 w-5" />
            </button>
          </NotificationsDrawer>

          <a href="/" className="flex items-center gap-2">
            <img src="/logo.webp" alt="NCX" className="h-7 w-7 rounded-lg" />
            <h1 className="text-base font-extrabold tracking-wide bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Nickel&nbsp;City&nbsp;X-Wing
            </h1>
          </a>
        </div>

        {/* Right: compact “Desktop” label + small Discord pill */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-neutral-400">Desktop</span>

          {/* Compact auth pill */}
          {user ? (
            <div className="flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/70 px-2 py-1">
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name ?? "You"}
                  className="h-6 w-6 rounded-full border border-neutral-700"
                />
              ) : null}
              <span className="max-w-[10rem] truncate text-xs text-neutral-200">
                {user.name ?? "You"}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-[2px] text-[10px] text-neutral-300 hover:bg-neutral-800"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("discord", { callbackUrl: "/" })}
              className="rounded-full border border-neutral-800 bg-neutral-900/70 px-3 py-1 text-xs font-medium text-neutral-200 hover:bg-neutral-800"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
