"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthStatus() {
  const { data: session, status } = useSession();

  // While NextAuth is loading state
  if (status === "loading") {
    return (
      <div className="text-xs text-neutral-400">
        ...
      </div>
    );
  }

  // ✅ Signed in
  if (session?.user) {
    const name = session.user.name ?? "You";
    const avatar = session.user.image;

    return (
      <div className="flex items-center gap-2">
        {/* Avatar (if Discord profile has one) */}
        {avatar && (
          <img
            src={avatar}
            alt={name}
            className="h-7 w-7 rounded-full border border-neutral-700"
          />
        )}

        {/* Name */}
        <span className="text-xs font-medium text-neutral-200">
          {name}
        </span>

        {/* Sign Out */}
        <button
          onClick={() => signOut({ callbackUrl: "/m" })}
          className="rounded-lg border border-neutral-800 bg-neutral-900/70 px-2 py-1 text-[10px] text-neutral-300 hover:bg-neutral-800"
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
      className="rounded-lg border border-neutral-800 bg-neutral-900/70 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800"
    >
      Sign in
    </button>
  );
}
