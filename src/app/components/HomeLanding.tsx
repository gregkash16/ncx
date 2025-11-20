// src/app/components/HomeLanding.tsx
import React from "react";

type TeamLogo = {
  /** Display name, used for alt text + tooltip */
  name: string;
  /** Path to the logo in /public/logos, e.g. "/logos/jagged-axe.png" */
  logoSrc: string;
  /**
   * Value used to pre-filter Ind. Stats by team.
   * This should match the team string in your IndRow.team field.
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
   * If omitted, defaults to the desktop behavior:
   * "/?tab=indstats&indteam=TEAM_NAME"
   */
  buildTeamHref?: (team: TeamLogo) => string;
  /**
   * Optional override for the "League Rules" tile link.
   * Desktop: default "/rules"
   * Mobile: pass "/m/rules"
   */
  rulesHref?: string;
};

const teams: TeamLogo[] = [
  { name: "BERSERKERS",           logoSrc: "/logos/berserkers.png",           filterValue: "BERSERKERS" },
  { name: "DEGENERATES",          logoSrc: "/logos/degenerates.png",          filterValue: "DEGENERATES" },
  { name: "FIREBIRDS",            logoSrc: "/logos/firebirds.png",            filterValue: "FIREBIRDS" },
  { name: "FOXES",                logoSrc: "/logos/foxes.png",                filterValue: "FOXES" },
  { name: "GALACTIC WARDENS",     logoSrc: "/logos/galactic-wardens.png",     filterValue: "GALACTIC WARDENS" },
  { name: "HAVOC",                logoSrc: "/logos/havoc.png",                filterValue: "HAVOC" },
  { name: "HEADHUNTERS",          logoSrc: "/logos/headhunters.png",          filterValue: "HEADHUNTERS" },
  { name: "HOTSHOTS",             logoSrc: "/logos/hotshots.png",             filterValue: "HOTSHOTS" },
  { name: "JAGGED AXE",           logoSrc: "/logos/jagged-axe.png",           filterValue: "JAGGED AXE" },
  { name: "KDB",                  logoSrc: "/logos/kdb.png",                  filterValue: "KDB" },
  { name: "MAWLERS",              logoSrc: "/logos/mawlers.png",              filterValue: "MAWLERS" },
  { name: "MEATBAGS",             logoSrc: "/logos/meatbags.png",             filterValue: "MEATBAGS" },
  { name: "MEGA MILK UNION",      logoSrc: "/logos/mega-milk-union.png",      filterValue: "MEGA MILK UNION" },
  { name: "MISFITS",              logoSrc: "/logos/misfits.png",              filterValue: "MISFITS" },
  { name: "MON CALA SC",          logoSrc: "/logos/mon-cala-sc.png",          filterValue: "MON CALA SC" },
  { name: "NERF HERDERS",         logoSrc: "/logos/nerf-herders.png",         filterValue: "NERF HERDERS" },
  { name: "ORDER 66",             logoSrc: "/logos/order-66.png",             filterValue: "ORDER 66" },
  { name: "OUTER RIM HEROES",     logoSrc: "/logos/outer-rim-heroes.png",     filterValue: "OUTER RIM HEROES" },
  { name: "PUDDLE JUMPERS",       logoSrc: "/logos/puddle-jumpers.png",       filterValue: "PUDDLE JUMPERS" },
  { name: "PUNISHERS",            logoSrc: "/logos/punishers.png",            filterValue: "PUNISHERS" },
  { name: "RAVE CRAB CHAMPIONS",  logoSrc: "/logos/rave-crab-champions.png",  filterValue: "RAVE CRAB CHAMPIONS" },
  { name: "STARKILLERS",          logoSrc: "/logos/starkillers.png",          filterValue: "STARKILLERS" },
  { name: "VOODOO KREWE",         logoSrc: "/logos/voodoo-krewe.png",         filterValue: "VOODOO KREWE" },
  { name: "WOLFPACK",             logoSrc: "/logos/wolfpack.png",             filterValue: "WOLFPACK" },
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
}: HomeLandingProps) {
  const rulesLink = rulesHref ?? "/rules";

  return (
    <div className={`mx-auto max-w-4xl ${className ?? ""}`}>
      <div className="rounded-2xl border border-purple-500/40 bg-zinc-900/70 p-6 md:p-8 shadow-xl">
        {/* Header with centered season logo */}
        <div className="flex flex-col items-center text-center gap-4 mb-6">
          <img
            src="/logo.png"
            alt="Season Logo"
            className="h-40 w-auto rounded-xl border border-purple-500/40 shadow-lg object-contain"
          />
          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Season 8 Draft League Hub
            </h2>
            {message && (
              <p className="text-sm md:text-base text-zinc-300">{message}</p>
            )}
            <p className="text-xs md:text-sm text-zinc-400">
              Use the links below to watch games, join the community, and check
              the rules.
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
        </div>

        {/* Team logos grid */}
        {sortedTeams.length > 0 && (
          <div className="mt-8">
            <h3 className="text-center text-sm font-semibold text-zinc-300 mb-4">
              Jump to team&apos;s Individual Stats
            </h3>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-3 place-items-center">
              {sortedTeams.map((team) => {
                const href = buildTeamHref
                  ? buildTeamHref(team)
                  : `/?tab=indstats&indteam=${encodeURIComponent(
                      team.filterValue
                    )}`;

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
