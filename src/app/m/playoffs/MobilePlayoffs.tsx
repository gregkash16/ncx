// src/app/m/playoffs/MobilePlayoffs.tsx
import Image from "next/image";
import Link from "next/link";
import { fetchOverallStandingsCached } from "@/lib/googleSheets";
import { teamSlug } from "@/lib/slug";

type OverallRow = Awaited<ReturnType<typeof fetchOverallStandingsCached>>[number];

type SeedNumber = 1 | 2 | 3 | 4;

type SeededTeam = {
  seed: SeedNumber;        // 1–4
  rank: number;            // overall rank (1–16)
  team: string;
  wins: number;
  losses: number;
  gameWins: number;
  points: number;
  slug: string;
};

type Region = {
  index: number;           // 0..3
  oneSeed: SeededTeam;
  twoSeed: SeededTeam;
  threeSeed: SeededTeam;
  fourSeed: SeededTeam;
};

function toSeeded(row: OverallRow, seed: SeedNumber): SeededTeam {
  const slug = teamSlug(row.team);

  return {
    seed,
    rank: Number(row.rank),
    team: row.team,
    wins: Number(row.wins),
    losses: Number(row.losses),
    gameWins: Number(row.gameWins),
    points: Number(row.points),
    slug,
  };
}

function buildRegions(rows: OverallRow[]): Region[] {
  if (!rows || rows.length < 16) return [];

  // Assume rows are sorted by overall rank ascending
  const top16 = rows.slice(0, 16);

  const oneSeeds = top16.slice(0, 4).map((r) => toSeeded(r, 1));
  const twoSeeds = top16.slice(4, 8).map((r) => toSeeded(r, 2));
  const threeSeeds = top16.slice(8, 12).map((r) => toSeeded(r, 3));
  const fourSeeds = top16.slice(12, 16).map((r) => toSeeded(r, 4));

  // Order each seed group from "easiest" (highest rank number) to "hardest"
  const twoByDifficulty = [...twoSeeds].sort((a, b) => b.rank - a.rank);     // 8,7,6,5
  const threeByDifficulty = [...threeSeeds].sort((a, b) => b.rank - a.rank); // 12,11,10,9
  const fourByDifficulty = [...fourSeeds].sort((a, b) => b.rank - a.rank);   // 16,15,14,13

  const regions: Region[] = oneSeeds.map((oneSeed, idx) => {
    return {
      index: idx,
      oneSeed,
      twoSeed: twoByDifficulty[idx],
      threeSeed: threeByDifficulty[idx],
      fourSeed: fourByDifficulty[idx],
    };
  });

  return regions;
}

function RegionCard({ region }: { region: Region }) {
  const { index, oneSeed, twoSeed, threeSeed, fourSeed } = region;
  const regionName = `Region ${index + 1}`;
  const topSeedTeam = oneSeed.team;

  // Game 1: 1 vs 4 (higher seed = home)
  const game1Home = oneSeed;
  const game1Away = fourSeed;

  // Game 2: 2 vs 3 (higher seed = home)
  const game2Home = twoSeed.rank < threeSeed.rank ? twoSeed : threeSeed;
  const game2Away = game2Home === twoSeed ? threeSeed : twoSeed;

  const matchRow = (label: string, away: SeededTeam, home: SeededTeam) => {
    const awayHref = `/m/team/${encodeURIComponent(away.slug)}`;
    const homeHref = `/m/team/${encodeURIComponent(home.slug)}`;

    const awayLogo = `/logos/${away.slug}.png`;
    const homeLogo = `/logos/${home.slug}.png`;

    return (
      <div className="rounded-xl bg-neutral-950/70 border border-neutral-800 px-3 py-2 text-sm">
        <div className="text-[11px] uppercase text-neutral-400 mb-1 flex justify-between">
          <span>{label}</span>
          <span>Higher seed is home</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* AWAY (lower seed) */}
          <Link
            href={awayHref}
            prefetch={false}
            className="flex items-center gap-2 min-w-0 hover:underline underline-offset-2"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-900 border border-neutral-700 overflow-hidden shrink-0">
              <Image
                src={awayLogo}
                alt={`${away.team} logo`}
                width={28}
                height={28}
                className="object-contain"
                unoptimized
              />
            </span>
            <span className="truncate">
              <span className="text-xs text-neutral-400 mr-1">
                ({away.seed})
              </span>
              {away.team}
              <span className="ml-1 text-[11px] text-neutral-500">
                #{away.rank}
              </span>
            </span>
          </Link>

          <span className="mx-1 text-[11px] text-neutral-500">at</span>

          {/* HOME (higher seed) */}
          <Link
            href={homeHref}
            prefetch={false}
            className="flex items-center gap-2 min-w-0 justify-end hover:underline underline-offset-2 text-right"
          >
            <span className="truncate">
              <span className="text-xs text-neutral-400 mr-1">
                ({home.seed})
              </span>
              {home.team}
              <span className="ml-1 text-[11px] text-neutral-500">
                #{home.rank}
              </span>
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-900 border border-neutral-700 overflow-hidden shrink-0">
              <Image
                src={homeLogo}
                alt={`${home.team} logo`}
                width={28}
                height={28}
                className="object-contain"
                unoptimized
              />
            </span>
          </Link>
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-2xl bg-neutral-900/70 border border-neutral-800 p-3 space-y-3">
      <header className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-neutral-950 border border-neutral-700 flex items-center justify-center overflow-hidden">
          <Image
            src={`/logos/${oneSeed.slug}.png`}
            alt={`${topSeedTeam} logo`}
            width={36}
            height={36}
            className="object-contain"
            unoptimized
          />
        </div>
        <div>
          <div className="text-[11px] uppercase text-neutral-400">
            {regionName}
          </div>
          <div className="text-xs font-semibold text-neutral-100">
            Top Seed:{" "}
            <span className="text-cyan-300">
              {topSeedTeam} (1) – #{oneSeed.rank}
            </span>
          </div>
        </div>
      </header>

      <div className="space-y-2">
        {matchRow("First Round – Game 1", game1Away, game1Home)}
        {matchRow("First Round – Game 2", game2Away, game2Home)}
      </div>
    </section>
  );
}

export default async function MobilePlayoffs() {
  let data: Awaited<ReturnType<typeof fetchOverallStandingsCached>> = [];
  let errorMsg: string | null = null;

  try {
    data = await fetchOverallStandingsCached();
  } catch (e: any) {
    errorMsg =
      "We hit the Google Sheets read limit momentarily. Please try again in a minute.";
  }

  if (errorMsg) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 text-center text-sm text-amber-300">
        {errorMsg}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 text-center text-sm text-neutral-300">
        No standings data available.
      </div>
    );
  }

  const regions = buildRegions(data);
  if (!regions.length) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 text-center text-sm text-neutral-300">
        Need at least 16 teams in the standings to build the playoff bracket.
      </div>
    );
  }

  // Explicit mapping so Final Four is:
  // Semifinal 1: Region 1 vs Region 4
  // Semifinal 2: Region 2 vs Region 3
  const region1 = regions[0];
  const region2 = regions[1];
  const region3 = regions[2];
  const region4 = regions[3];

  const leftRegions = [region1, region4];
  const rightRegions = [region2, region3];

  return (
    <section className="w-full space-y-4 p-3">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-3 text-center">
        <h1 className="text-lg font-extrabold tracking-wide bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 bg-clip-text text-transparent mb-1">
          Playoff Bracket
        </h1>
        <p className="text-[11px] text-neutral-400">
          Top 16 advance. 1–4 are 1-seeds, 5–8 are 2-seeds, 9–12 are 3-seeds, 13–16 are 4-seeds.
          Bracket is structured so that if all favorites win, the #1 and #2 overall teams meet in
          the championship.
        </p>
      </div>

      {/* Regions & Final Four stacked for mobile */}
      <div className="space-y-4">
        {/* LEFT side: Region 1 & 4 */}
        <div className="space-y-3">
          {leftRegions.map((region) => (
            <RegionCard key={region.index} region={region} />
          ))}
        </div>

        {/* Final Four + Championship */}
        <div className="space-y-3">
          <section className="rounded-2xl bg-neutral-950/80 border border-neutral-800 p-3 text-xs">
            <h3 className="text-center text-xs font-semibold text-cyan-300 mb-2 uppercase tracking-wide">
              Final Four
            </h3>

            <div className="space-y-2">
              <div className="rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2">
                <div className="text-[11px] uppercase text-neutral-400 mb-1">
                  Semifinal 1
                </div>
                <div className="text-[12px] text-neutral-200">
                  Winner <span className="text-pink-300">Region 1</span> vs Winner{" "}
                  <span className="text-pink-300">Region 4</span>
                </div>
              </div>

              <div className="rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2">
                <div className="text-[11px] uppercase text-neutral-400 mb-1">
                  Semifinal 2
                </div>
                <div className="text-[12px] text-neutral-200">
                  Winner <span className="text-pink-300">Region 2</span> vs Winner{" "}
                  <span className="text-pink-300">Region 3</span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-neutral-950/90 border border-yellow-500/60 p-3 text-xs">
            <h3 className="text-center text-xs font-semibold text-yellow-300 mb-2 uppercase tracking-wide">
              Championship
            </h3>
            <div className="text-[12px] text-neutral-100 text-center">
              Winner Semifinal 1 vs Winner Semifinal 2
            </div>
            <div className="mt-2 text-[11px] text-neutral-400 text-center">
              If all favorites win, this matchup will be between the #1 and #2 overall teams from
              the regular season.
            </div>
          </section>
        </div>

        {/* RIGHT side: Region 2 & 3 */}
        <div className="space-y-3">
          {rightRegions.map((region) => (
            <RegionCard key={region.index} region={region} />
          ))}
        </div>
      </div>
    </section>
  );
}
