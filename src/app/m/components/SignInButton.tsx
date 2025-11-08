// e.g. src/app/m/components/SignInButton.tsx
"use client";
import { signIn, signOut, useSession } from "next-auth/react";

export default function SignInButton() {
  const { data: session } = useSession();

  if (session?.user) {
    return (
      <button
        onClick={() => signOut({ callbackUrl: "/m" })}
        className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm"
      >
        Sign out
      </button>
    );
  }

  return (
    <button
      onClick={() => signIn("discord", { callbackUrl: "/m" })}
      className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm"
    >
      Sign in with Discord
    </button>
  );
}
