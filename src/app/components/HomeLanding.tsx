// src/app/components/HomeLanding.tsx
import React from "react";
import { teamSlug } from "@/lib/slug";
import MyMatchupWidget from "@/app/components/MyMatchupWidget";

type TeamLogo = {
  /** Display name, used for alt text + tooltip */
  name: string;
  /** Path to the logo in /public/logos, e.g. "/logos/jagged-axe.webp" */
  logoSrc: string;
  /**
   * Value used to pre-filter Ind. Stats by team
   * and to build a team slug for the team profile page.
   */
  filterValue: string;
};

type HomeLandingProps = {
  /** Optional welcome line like "Welcome Greg – NCX123" */
  message?: string;
  /** Optional extra className for layout differences (if you ever need it) */
  className?: string;
  /**
   * Optional function to customize where team logos link.
   * If omitted, defaults to the team profile behavior:
   * "/?tab=team&team=<teamSlug>"
   */
  buildTeamHref?: (team: TeamLogo) => string;
  /**
   * Optional override for the "League Rules" tile link.
   * Desktop: default "/rules"
   * Mobile: pass "/m/rules"
   */
  rulesHref?: string;
  /**
   * NCXID -> faction label map (e.g. "REBELS", "EMPIRE").
   * Same thing you already pass into MatchupsPanel as factionMap.
   */
  factionMap?: Record<string, string>;
};

const teams: TeamLogo[] = [
  { name: "BERSERKERS",           logoSrc: "/logos/berserkers.webp",           filterValue: "BERSERKERS" },
  { name: "DEGENERATES",          logoSrc: "/logos/degenerates.webp",          filterValue: "DEGENERATES" },
  { name: "FIREBIRDS",            logoSrc: "/logos/firebirds.webp",            filterValue: "FIREBIRDS" },
  { name: "FOXES",                logoSrc: "/logos/foxes.webp",                filterValue: "FOXES" },
  { name: "GAMBLERS",             logoSrc: "/logos/gamblers.webp",             filterValue: "GAMBLERS" },
  { name: "HAVOC",                logoSrc: "/logos/havoc.webp",                filterValue: "HAVOC" },
  { name: "HEADHUNTERS",          logoSrc: "/logos/headhunters.webp",          filterValue: "HEADHUNTERS" },
  { name: "HOTSHOTS",             logoSrc: "/logos/hotshots.webp",             filterValue: "HOTSHOTS" },
  { name: "JAGGED AXE",           logoSrc: "/logos/jagged-axe.webp",           filterValue: "JAGGED AXE" },
  { name: "KDB",                  logoSrc: "/logos/kdb.webp",                  filterValue: "KDB" },
  { name: "MAWLERS",              logoSrc: "/logos/mawlers.webp",              filterValue: "MAWLERS" },
  { name: "MEATBAGS",             logoSrc: "/logos/meatbags.webp",             filterValue: "MEATBAGS" },
  { name: "MEGA MILK UNION",      logoSrc: "/logos/mega-milk-union.webp",      filterValue: "MEGA MILK UNION" },
  { name: "MISFITS",              logoSrc: "/logos/misfits.webp",              filterValue: "MISFITS" },
  { name: "MON CALA SC",          logoSrc: "/logos/mon-cala-sc.webp",          filterValue: "MON CALA SC" },
  { name: "NERF HERDERS",         logoSrc: "/logos/nerf-herders.webp",         filterValue: "NERF HERDERS" },
  { name: "ORDER 66",             logoSrc: "/logos/order-66.webp",             filterValue: "ORDER 66" },
  { name: "OUTER RIM HEROES",     logoSrc: "/logos/outer-rim-heroes.webp",     filterValue: "OUTER RIM HEROES" },
  { name: "PUDDLE JUMPERS",       logoSrc: "/logos/puddle-jumpers.webp",       filterValue: "PUDDLE JUMPERS" },
  { name: "PUNISHERS",            logoSrc: "/logos/punishers.webp",            filterValue: "PUNISHERS" },
  { name: "RAVE CRAB CHAMPIONS",  logoSrc: "/logos/rave-crab-champions.webp",  filterValue: "RAVE CRAB CHAMPIONS" },
  { name: "STARKILLERS",          logoSrc: "/logos/starkillers.webp",          filterValue: "STARKILLERS" },
  { name: "VOODOO KREWE",         logoSrc: "/logos/voodoo-krewe.webp",         filterValue: "VOODOO KREWE" },
  { name: "WOLFPACK",             logoSrc: "/logos/wolfpack.webp",             filterValue: "WOLFPACK" },
];

// Ensure alphabetical order by name
const sortedTeams = [...teams].sort((a, b) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
);

export default function HomeLanding({
  message,
  className,
  buildTeamHref,
  rulesHref,
  factionMap,
}: HomeLandingProps) {
  const rulesLink = rulesHref ?? "/rules";

  // Default behavior: click logo → team profile page
  const defaultBuildTeamHref = (team: TeamLogo) =>
    `/?tab=team&team=${encodeURIComponent(teamSlug(team.filterValue))}`;

  return (
    <div className={`mx-auto max-w-4xl ${className ?? ""}`}>
      <div className="rounded-2xl border border-purple-500/40 bg-zinc-900/70 p-6 md:p-8 shadow-xl">
        {/* Header with centered season logo */}
        <div className="flex flex-col items-center text-center gap-4 mb-6">
          <img
            src="/logo.webp"
            alt="Season Logo"
            fetchPriority="high"
            className="h-40 w-auto ..."
          />
          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Season 8 Draft League Hub
            </h2>
            {message && (
              <p className="text-sm md:text-base text-zinc-300">{message}</p>
            )}
            <p className="text-xs md:text-sm text-zinc-400">
              Use the links below to watch games, join the community, check the rules,
              or jump straight to a team page.
            </p>
          </div>
        </div>

        {/* Link grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <a
            href="https://www.youtube.com/@NickelCityXWing"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center rounded-xl border border-red-500/40 bg-zinc-950/60 px-4 py-3 text-sm font-semibold hover:bg-red-500/20 hover:border-red-400 transition"
          >
            YouTube Channel
          </a>

          <a
            href="https://www.twitch.tv/nickelcityxwing"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center rounded-xl border border-purple-500/40 bg-zinc-950/60 px-4 py-3 text-sm font-semibold hover:bg-purple-500/20 hover:border-purple-400 transition"
          >
            Twitch Stream
          </a>

          <a
            href="https://discord.com/invite/ncx"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center rounded-xl border border-indigo-500/40 bg-zinc-950/60 px-4 py-3 text-sm font-semibold hover:bg-indigo-500/20 hover:border-indigo-400 transition"
          >
            Discord Server
          </a>

          <a
            href={rulesLink}
            className="flex items-center justify-center rounded-xl border border-cyan-500/40 bg-zinc-950/60 px-4 py-3 text-sm font-semibold hover:bg-cyan-500/20 hover:border-cyan-400 transition"
          >
            League Rules
          </a>

          {/* NEW — Streamer Kit */}
          <a
            href="https://drive.google.com/drive/folders/1cJHX4xa8I-QtRqle-IvWWdOFbnlNGIfp?usp=drive_link"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center rounded-xl border border-yellow-500/40 bg-zinc-950/60 px-4 py-3 text-sm font-semibold hover:bg-yellow-500/20 hover:border-yellow-400 transition"
          >
            Streamer Kit
          </a>

          {/* NEW — Season 9 Sign Up */}
          <a
            href="https://forms.gle/X7VNuw1jbDp5985g8"
            target="_blank"
            rel="noreferrer"
            className="
              group relative isolate overflow-hidden
              flex items-center justify-center gap-2
              rounded-2xl border border-blue-400/60
              bg-gradient-to-r from-blue-600/25 via-cyan-500/15 to-purple-600/25
              px-4 py-3 text-sm font-extrabold tracking-wide text-zinc-50
              shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_12px_40px_rgba(59,130,246,0.25)]
              hover:shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_16px_55px_rgba(34,211,238,0.30)]
              hover:border-cyan-300/70
              transition
            "
          >
            {/* glow blob */}
            <span
              className="
                pointer-events-none absolute -inset-10 -z-10
                opacity-70 blur-2xl
                bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.55),transparent_55%)]
                group-hover:opacity-100
                transition
              "
            />

            {/* shimmer sweep */}
            <span
              className="
                pointer-events-none absolute inset-0 -z-10
                translate-x-[-120%] group-hover:translate-x-[120%]
                bg-gradient-to-r from-transparent via-white/15 to-transparent
                transition-transform duration-1000
              "
            />

            {/* badge */}
            <span className="inline-flex items-center rounded-full bg-cyan-400/20 border border-cyan-300/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-cyan-200 animate-pulse">
              New
            </span>

            <span className="relative">Season 9 Sign-Ups</span>

            <span className="relative text-cyan-200 group-hover:translate-x-0.5 transition-transform">
              →
            </span>
          </a>

        </div>

        {/* NEW: Inline "Your Matchup" widget (only shows if logged in & has game) */}
        <MyMatchupWidget factionMap={factionMap} />

        {/* Team logos grid */}
        {sortedTeams.length > 0 && (
          <div className="mt-8">
            <h3 className="text-center text-sm font-semibold text-zinc-300 mb-4">
              Jump to a Team Page
            </h3>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-3 place-items-center">
              {sortedTeams.map((team) => {
                const href = buildTeamHref
                  ? buildTeamHref(team)
                  : defaultBuildTeamHref(team);

                return (
                  <a
                    key={team.name}
                    href={href}
                    className="group flex h-20 w-20 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950/80 hover:border-cyan-400 hover:bg-zinc-900 transition overflow-hidden"
                    title={team.name}
                  >
                    <img
                      src={team.logoSrc}
                      alt={team.name}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                    />
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
