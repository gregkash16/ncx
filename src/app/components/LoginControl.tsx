// src/components/LoginControl.tsx
"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function LoginControl() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <button
        type="button"
        className="rounded-md px-3 py-1 text-sm opacity-70"
        disabled
      >
        Checking session…
      </button>
    );
  }

  // Not logged in – show Discord sign-in
  if (!session?.user) {
    return (
      <button
        type="button"
        onClick={() =>
          signIn("discord", {
            callbackUrl: "/", // or wherever you want to land after login
          })
        }
        className="rounded-md bg-purple-600 px-3 py-1 text-sm font-semibold text-white hover:bg-purple-500"
      >
        Sign in with Discord
      </button>
    );
  }

  // Logged in – show name + sign out
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-zinc-200">
        {session.user.name ?? "Logged in"}
      </span>
      <button
        type="button"
        onClick={() =>
          signOut({
            callbackUrl: "/", // force a hard navigation after logout
          })
        }
        className="rounded-md border border-zinc-500 px-3 py-1 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        Sign out
      </button>
    </div>
  );
}
