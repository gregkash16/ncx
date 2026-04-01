// src/app/components/ArcadePanel.tsx
"use client";

import Link from "next/link";

const games = [
  {
    slug: "trench-run",
    title: "Trench Run",
    description: "Navigate the trench, dodge turrets, and fire the shot that counts.",
    image: "/trench-run/trench-run-thumb.png",
  },
  {
    slug: "tauntaun-run",
    title: "TaunTaun Run",
    description: "Race across Hoth on your TaunTaun. Dodge ice, rocks, and AT-ATs to survive.",
    image: "/tauntaun-run/tauntaun-run-thumb.png",
  },
  {
    slug: "pod-racer",
    title: "Pod Racer",
    description: "Top-down Boonta Eve racing. Pick your pod, dodge hazards, and set the fastest time.",
    image: "/pod-racer/pod-racer-thumb.png",
  },
];

export default function ArcadePanel() {
  return (
    <div className="mx-auto max-w-5xl py-6">
      <h2
        className="mb-2 text-center text-4xl font-extrabold tracking-widest"
        style={{
          color: "#FFD700",
          textShadow: "0 0 12px rgba(255,215,0,0.4), 0 2px 4px rgba(0,0,0,0.5)",
          letterSpacing: "0.15em",
        }}
      >
        ARCADE
      </h2>
      <p className="mb-8 text-center text-sm text-[var(--ncx-text-muted)]">
        Games for the NCX community. More coming soon.
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => (
          <Link
            key={game.slug}
            href={`/arcade/${game.slug}`}
            className="group relative overflow-hidden rounded-2xl border border-[var(--ncx-border)] bg-[var(--ncx-bg-panel)] transition-all duration-300 hover:scale-[1.02] hover:border-[rgb(var(--ncx-primary-rgb)/0.5)]"
          >
            <div className="aspect-video w-full overflow-hidden bg-black">
              <img
                src={game.image}
                alt={game.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div className="p-4">
              <h3 className="text-lg font-bold text-[var(--ncx-text-primary)]">{game.title}</h3>
              <p className="mt-1 text-sm text-[var(--ncx-text-muted)]">{game.description}</p>
            </div>
            <div
              className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"
              style={{
                background: "linear-gradient(to bottom, transparent 60%, rgb(var(--ncx-primary-rgb) / 0.08))",
              }}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
