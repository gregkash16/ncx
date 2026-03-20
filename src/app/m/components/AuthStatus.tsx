"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { isCapacitor, startDiscordLogin } from "@/lib/capacitor";
import { useIOSSession } from "@/lib/useIOSSession";
import { useEffect } from "react";

export default function AuthStatus() {
  // Use custom hook that checks both NextAuth and iOS sessions
  const { data: session, status } = useIOSSession();

  // Loading
  if (status === "loading") {
    return (
      <div className="text-xs text-[var(--ncx-text-muted)]">
        …
      </div>
    );
  }

  // ✅ Signed in
  if (session?.user) {
    const name = session.user.name ?? "You";
    const avatar = session.user.image;

    return (
      <div className="flex items-center gap-2">
        {/* Avatar */}
        {avatar && (
          <img
            src={avatar}
            alt={name}
            className="h-7 w-7 rounded-full border border-[var(--ncx-border)]"
          />
        )}

        {/* Name */}
        <span className="text-xs font-medium text-[var(--ncx-text-primary)]">
          {name}
        </span>

        {/* Sign out */}
        <button
          onClick={async () => {
            if (isCapacitor()) {
              // In iOS app, clear custom session cookie
              await fetch('/api/auth/ios-logout', { method: 'POST' });
              // Force page reload to update UI
              window.location.href = '/m';
            } else {
              // In browser, use NextAuth's sign out
              signOut({ callbackUrl: "/m" });
            }
          }}
          className="
            rounded-lg
            border border-[var(--ncx-border)]
            bg-[var(--ncx-bg-elev)]
            px-2 py-1
            text-[10px]
            text-[var(--ncx-text-muted)]
            hover:bg-[var(--ncx-bg-elev-hover)]
          "
        >
          Sign out
        </button>
      </div>
    );
  }

  // ❌ Not signed in
  const handleSignIn = async () => {
    if (isCapacitor()) {
      // In native app, use custom Discord OAuth with Safari
      const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '';
      await startDiscordLogin(clientId);
    } else {
      // In browser, use NextAuth's normal flow
      signIn("discord", { callbackUrl: "/m" });
    }
  };

  return (
    <button
      onClick={handleSignIn}
      className="
        rounded-lg
        border border-[var(--ncx-border)]
        bg-[var(--ncx-bg-elev)]
        px-3 py-1.5
        text-xs font-medium
        text-[var(--ncx-text-primary)]
        hover:bg-[var(--ncx-bg-elev-hover)]
      "
    >
      Sign in
    </button>
  );
}
