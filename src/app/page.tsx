'use client';
import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-visible bg-gradient-to-b from-[#0b0b16] via-[#1a1033] to-[#0b0b16] text-zinc-100">

      {/* Subtle animated glow background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,0,150,0.25),transparent_70%)] animate-pulse"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_120%,rgba(0,255,255,0.15),transparent_60%)] blur-3xl"></div>
      </div>

      {/* Hero Section */}
      <section className="relative max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="flex flex-col items-center space-y-8">
          {/* Logo with neon glow */}
          <Image
            src="/logo.png"
            alt="NCX Draft League Season 8"
            width={240}
            height={240}
            priority
            className="drop-shadow-[0_0_30px_rgba(255,0,150,0.5)] hover:scale-105 transition-transform duration-500"
          />

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 text-transparent bg-clip-text drop-shadow-[0_0_25px_rgba(255,0,255,0.25)]">
            DRAFT LEAGUE • SEASON 8
          </h1>

          <p className="text-zinc-400 text-lg max-w-2xl leading-relaxed">
            Organized play. Competitive spirit. Community-driven fun.<br />
            Join the league. Fly casual. Score points.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mt-10">
            <Link
              href="/standings"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-600 via-purple-500 to-cyan-500 text-white font-semibold shadow-lg shadow-pink-600/30 hover:scale-105 transition-transform duration-300"
            >
              View Standings
            </Link>
            <Link
              href="/report"
              className="px-6 py-3 rounded-xl bg-zinc-900 border border-purple-500/40 hover:border-cyan-400/60 text-white font-semibold hover:scale-105 transition-transform duration-300"
            >
              Report a Game
            </Link>
          </div>
        </div>
      </section>

      {/* Decorative neon divider */}
      <div className="h-1 w-3/4 mx-auto bg-gradient-to-r from-pink-600 via-purple-400 to-cyan-400 rounded-full blur-md opacity-60 mb-16" />

      {/* Info Grid */}
      <section className="relative max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 px-6 pb-24">
        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-purple-500/40 transition">
          <h2 className="text-xl font-semibold text-pink-400">Current Week</h2>
          <p className="mt-2 text-zinc-300">Week 5 • 14–20 Oct 2025</p>
        </div>

        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-purple-500/40 transition">
          <h2 className="text-xl font-semibold text-cyan-400">Top Players</h2>
          <ul className="mt-3 text-zinc-300 text-sm space-y-1">
            <li>🏆 Kester — 17 pts</li>
            <li>🔥 Walter — 15 pts</li>
            <li>🚀 Nash — 13 pts</li>
          </ul>
        </div>

        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-purple-500/40 transition">
          <h2 className="text-xl font-semibold text-purple-400">Next Event</h2>
          <p className="mt-2 text-zinc-300">
            Sunday, Oct 27 • League Week 6 • Nickel City Games
          </p>
        </div>
      </section>
    </main>
  );
}
