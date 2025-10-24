'use client';

import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import { usePathname } from "next/navigation";

type Props = {
  /** optional extra className for positioning or hiding */
  className?: string;
};

export default function LoginControl({ className = "" }: Props) {
  const { data: session } = useSession();
  const pathname = usePathname();

  // 🔒 hide completely on mobile routes (/m)
  if (pathname.startsWith("/m")) return null;

  if (session) {
    return (
      <div
        className={`fixed top-4 right-6 z-[9999] flex items-center space-x-3 
          bg-zinc-900/70 backdrop-blur-md border border-purple-500/40 
          rounded-full px-4 py-2 shadow-lg shadow-pink-600/20 text-sm
          hidden md:flex ${className}`}
      >
        {session.user?.image && (
          <Image
            src={session.user.image}
            alt={session.user.name ?? "User avatar"}
            width={28}
            height={28}
            className="rounded-full border border-pink-400/40"
          />
        )}
        <span className="text-zinc-200 truncate max-w-[120px]">
          {session.user?.name}
        </span>
        <button
          onClick={() => signOut()}
          className="text-pink-400 hover:text-cyan-300 transition"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn("discord")}
      className={`fixed top-4 right-6 px-4 py-2 
        bg-gradient-to-r from-pink-600 via-purple-500 to-cyan-500 
        rounded-full text-sm font-semibold shadow-lg shadow-pink-600/30 
        hover:scale-105 transition-transform hidden md:inline-flex ${className}`}
    >
      Log in with Discord
    </button>
  );
}
