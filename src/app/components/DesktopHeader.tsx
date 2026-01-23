// src/app/components/DesktopHeader.tsx
"use client";

import NotificationsDrawer from "../components/NotificationsDrawer";
import { Menu } from "lucide-react";
import { useSession, signOut, signIn } from "next-auth/react";

export default function DesktopHeader() {
  const { data } = useSession();
  const user = data?.user;

  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur supports-[backdrop-filter]:backdrop-blur-md"
      style={{
        background: "var(--ncx-bg-panel)",
        borderColor: "var(--ncx-border)",
      }}
    >
      {/* Compact header height */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
        {/* Left: menu + logo */}
        <div className="flex items-center gap-3">
          <NotificationsDrawer title="Notifications">
            <button
              aria-label="Open menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border transition active:scale-95"
              style={{
                background: "rgb(0 0 0 / 0.25)",
                borderColor: "var(--ncx-border)",
                color: "var(--ncx-text-primary)",
              }}
            >
              <Menu className="h-5 w-5" />
            </button>
          </NotificationsDrawer>

          <a href="/" className="flex items-center gap-2">
            <img
              src="/logo.webp"
              alt="NCX"
              className="h-7 w-7 rounded-lg"
            />
            <h1 className="text-base font-extrabold tracking-wide ncx-hero-title">
              Nickel&nbsp;City&nbsp;X-Wing
            </h1>
          </a>
        </div>

        {/* Right: device label + auth */}
        <div className="flex items-center gap-3">
          <span
            className="hidden sm:inline text-xs"
            style={{ color: "var(--ncx-text-muted)" }}
          >
            Desktop
          </span>

          {user ? (
            <div
              className="flex items-center gap-2 rounded-full border px-2 py-1"
              style={{
                background: "rgb(0 0 0 / 0.25)",
                borderColor: "var(--ncx-border)",
              }}
            >
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name ?? "You"}
                  className="h-6 w-6 rounded-full border"
                  style={{ borderColor: "var(--ncx-border)" }}
                />
              ) : null}

              <span
                className="max-w-[10rem] truncate text-xs"
                style={{ color: "var(--ncx-text-primary)" }}
              >
                {user.name ?? "You"}
              </span>

              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-md border px-2 py-[2px] text-[10px] transition"
                style={{
                  background: "rgb(0 0 0 / 0.25)",
                  borderColor: "var(--ncx-border)",
                  color: "var(--ncx-text-muted)",
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("discord", { callbackUrl: "/" })}
              className="rounded-full border px-3 py-1 text-xs font-medium transition"
              style={{
                background: "rgb(0 0 0 / 0.25)",
                borderColor: "var(--ncx-border)",
                color: "var(--ncx-text-primary)",
              }}
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
