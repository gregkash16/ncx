"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function SignInButton() {
  const { data: session } = useSession();

  const baseClasses = `
    rounded-lg
    border border-[var(--ncx-border)]
    bg-[var(--ncx-bg-elev)]
    px-3 py-1.5
    text-sm
    text-[var(--ncx-text-primary)]
    hover:bg-[var(--ncx-bg-elev-hover)]
    active:scale-[0.98]
    transition
  `;

  if (session?.user) {
    return (
      <button
        onClick={() => signOut({ callbackUrl: "/m" })}
        className={baseClasses}
      >
        Sign out
      </button>
    );
  }

  return (
    <button
      onClick={() => signIn("discord", { callbackUrl: "/m" })}
      className={baseClasses}
    >
      Sign in with Discord
    </button>
  );
}
