"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthStatus() {
  const { data: session, status } = useSession();

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
          onClick={() => signOut({ callbackUrl: "/m" })}
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
  return (
    <button
      onClick={() => signIn("discord", { callbackUrl: "/m" })}
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
