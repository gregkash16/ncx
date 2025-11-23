// src/app/components/PlayoffsPanel.tsx
import Image from "next/image";
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
  // Need at least 16 teams to build the bracket
  if (!rows || rows.length < 16) return [];

  // Assume rows are sorted by overall rank ascending
  const top16 = rows.slice(0, 16);

  const oneSeeds = top16.slice(0, 4).map((r) => toSeeded(r, 1));
  const twoSeeds = top16.slice(4, 8).map((r) => toSeeded(r, 2));
  const threeSeeds = top16.slice(8, 12).map((r) => toSeeded(r, 3));
  const fourSeeds = top16.slice(12, 16).map((r) => toSeeded(r, 4));

  // Sort each seed group from "easiest" (highest rank number) to "hardest"
  // so the #1 overall seed gets the *bottom* ranked 2/3/4, etc.
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
    const awayHref = `/?tab=team&team=${encodeURIComponent(away.slug)}`;
    const homeHref = `/?tab=team&team=${encodeURIComponent(home.slug)}`;

    const awayLogo = `/logos/${away.slug}.png`;
    const homeLogo = `/logos/${home.slug}.png`;

    return (
      <div className="rounded-xl bg-zinc-950/70 border border-zinc-800 px-3 py-2 text-sm">
        <div className="text-[11px] uppercase text-zinc-400 mb-1 flex justify-between">
          <span>{label}</span>
          <span>Higher seed is home</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* AWAY (lower seed) */}
          <a
            href={awayHref}
            className="flex items-center gap-2 min-w-0 hover:underline underline-offset-2"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 border border-zinc-700 overflow-hidden shrink-0">
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
              <span className="text-xs text-zinc-400 mr-1">
                ({away.seed})
              </span>
              {away.team}
              <span className="ml-1 text-[11px] text-zinc-500">
                #{away.rank}
              </span>
            </span>
          </a>

          <span className="mx-1 text-[11px] text-zinc-500">at</span>

          {/* HOME (higher seed) */}
          <a
            href={homeHref}
            className="flex items-center gap-2 min-w-0 justify-end hover:underline underline-offset-2 text-right"
          >
            <span className="truncate">
              <span className="text-xs text-zinc-400 mr-1">
                ({home.seed})
              </span>
              {home.team}
              <span className="ml-1 text-[11px] text-zinc-500">
                #{home.rank}
              </span>
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 border border-zinc-700 overflow-hidden shrink-0">
              <Image
                src={homeLogo}
                alt={`${home.team} logo`}
                width={28}
                height={28}
                className="object-contain"
                unoptimized
              />
            </span>
          </a>
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-4 space-y-3">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-zinc-950 border border-zinc-700 flex items-center justify-center overflow-hidden">
          <Image
            src={`/logos/${oneSeed.slug}.png`}
            alt={`${topSeedTeam} logo`}
            width={40}
            height={40}
            className="object-contain"
            unoptimized
          />
        </div>
        <div>
          <div className="text-xs uppercase text-zinc-400">
            {regionName}
          </div>
          <div className="text-sm font-semibold text-zinc-100">
            Top Seed:{" "}
            <span className="text-cyan-300">
              {topSeedTeam} (1) – #{oneSeed.rank}
            </span>
          </div>
          <div className="text-[11px] text-zinc-500">
            1–4 seeds in this region are matched so the top seed has the
            easiest path.
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

export default async function PlayoffsPanel() {
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
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-sm text-amber-300 text-center">
        {errorMsg}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-sm text-zinc-400 text-center">
        No standings data available.
      </div>
    );
  }

  const regions = buildRegions(data);

  if (!regions.length) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-sm text-zinc-400 text-center">
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

  // For visual NCAA style: left side = Region 1 & 4, right side = Region 2 & 3
  const leftRegions = [region1, region4];
  const rightRegions = [region2, region3];

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800">
      <h2 className="text-2xl font-bold tracking-wide text-center mb-4">
        <span className="text-pink-400">PLAYOFF</span>{" "}
        <span className="text-cyan-400">BRACKET</span>
      </h2>

      <p className="text-xs text-zinc-400 text-center mb-6 max-w-xl mx-auto">
        Teams 1–4 are 1-seeds, 5–8 are 2-seeds, 9–12 are 3-seeds, and 13–16 are
        4-seeds. The top-ranked 1-seed is paired with the lowest 2, 3, and 4
        seeds to create the easiest path. Bracket is structured so that if all
        favorites win, the #1 and #2 overall teams meet in the championship.
      </p>

      {/* NCAA-style layout: two sides converging to a championship */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.9fr_1.15fr] gap-6 items-stretch">
        {/* LEFT SIDE: Region 1 & 4 */}
        <div className="space-y-4">
          {leftRegions.map((region) => (
            <RegionCard key={region.index} region={region} />
          ))}
        </div>

        {/* CENTER: Final Four + Championship */}
        <div className="flex flex-col justify-center gap-4">
          <section className="rounded-2xl bg-zinc-950/80 border border-zinc-800 p-4 text-sm shadow-[0_0_25px_rgba(236,72,153,0.25)]">
            <h3 className="text-center text-sm font-semibold text-cyan-300 mb-2 uppercase tracking-wide">
              Final Four
            </h3>

            <div className="space-y-3">
              <div className="rounded-lg bg-zinc-900/80 border border-zinc-700 px-3 py-2">
                <div className="text-[11px] uppercase text-zinc-400 mb-1">
                  Semifinal 1
                </div>
                <div className="text-xs text-zinc-200">
                  Winner{" "}
                  <span className="text-pink-300">Region 1</span>{" "}
                  vs Winner{" "}
                  <span className="text-pink-300">Region 4</span>
                </div>
              </div>

              <div className="rounded-lg bg-zinc-900/80 border border-zinc-700 px-3 py-2">
                <div className="text-[11px] uppercase text-zinc-400 mb-1">
                  Semifinal 2
                </div>
                <div className="text-xs text-zinc-200">
                  Winner{" "}
                  <span className="text-pink-300">Region 2</span>{" "}
                  vs Winner{" "}
                  <span className="text-pink-300">Region 3</span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-zinc-950/90 border border-yellow-500/60 p-4 text-sm shadow-[0_0_30px_rgba(250,204,21,0.35)]">
            <h3 className="text-center text-sm font-semibold text-yellow-300 mb-2 uppercase tracking-wide">
              Championship
            </h3>
            <div className="text-xs text-zinc-100 text-center">
              Winner Semifinal 1 vs Winner Semifinal 2
            </div>
            <div className="mt-2 text-[11px] text-zinc-400 text-center">
              If all favorites win, this matchup will be between the #1 and #2
              overall teams from the regular season.
            </div>
          </section>
        </div>

        {/* RIGHT SIDE: Region 2 & 3 */}
        <div className="space-y-4">
          {rightRegions.map((region) => (
            <RegionCard key={region.index} region={region} />
          ))}
        </div>
      </div>
    </div>
  );
}
