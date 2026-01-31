// src/app/m/playoffs/MobilePlayoffs.tsx
import Image from "next/image";
import Link from "next/link";
import { fetchOverallStandingsCached } from "@/lib/googleSheets";
import { teamSlug } from "@/lib/slug";

type OverallRow = Awaited<ReturnType<typeof fetchOverallStandingsCached>>[number];
type SeedNumber = 1 | 2 | 3 | 4;

type SeededTeam = {
  seed: SeedNumber;
  rank: number;
  team: string;
  wins: number;
  losses: number;
  gameWins: number;
  points: number;
  slug: string;
};

type Region = {
  index: number;
  oneSeed: SeededTeam;
  twoSeed: SeededTeam;
  threeSeed: SeededTeam;
  fourSeed: SeededTeam;
};

function toSeeded(row: OverallRow, seed: SeedNumber): SeededTeam {
  return {
    seed,
    rank: Number(row.rank),
    team: row.team,
    wins: Number(row.wins),
    losses: Number(row.losses),
    gameWins: Number(row.gameWins),
    points: Number(row.points),
    slug: teamSlug(row.team),
  };
}

function buildRegions(rows: OverallRow[]): Region[] {
  if (!rows || rows.length < 16) return [];
  const top16 = rows.slice(0, 16);

  const oneSeeds = top16.slice(0, 4).map((r) => toSeeded(r, 1));
  const twoSeeds = top16.slice(4, 8).map((r) => toSeeded(r, 2));
  const threeSeeds = top16.slice(8, 12).map((r) => toSeeded(r, 3));
  const fourSeeds = top16.slice(12, 16).map((r) => toSeeded(r, 4));

  const twoByDiff = [...twoSeeds].sort((a, b) => b.rank - a.rank);
  const threeByDiff = [...threeSeeds].sort((a, b) => b.rank - a.rank);
  const fourByDiff = [...fourSeeds].sort((a, b) => b.rank - a.rank);

  return oneSeeds.map((oneSeed, i) => ({
    index: i,
    oneSeed,
    twoSeed: twoByDiff[i],
    threeSeed: threeByDiff[i],
    fourSeed: fourByDiff[i],
  }));
}

function RegionCard({ region }: { region: Region }) {
  const { index, oneSeed, twoSeed, threeSeed, fourSeed } = region;

  const game1Home = oneSeed;
  const game1Away = fourSeed;

  const game2Home = twoSeed.rank < threeSeed.rank ? twoSeed : threeSeed;
  const game2Away = game2Home === twoSeed ? threeSeed : twoSeed;

  const matchRow = (label: string, away: SeededTeam, home: SeededTeam) => (
    <div className="rounded-xl bg-[var(--ncx-bg-panel)] border border-[var(--ncx-border)] px-3 py-2 text-sm">
      <div className="text-[11px] uppercase text-[var(--ncx-text-muted)] mb-1 flex justify-between">
        <span>{label}</span>
        <span>Higher seed is home</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/m/team/${encodeURIComponent(away.slug)}`}
          prefetch={false}
          className="flex items-center gap-2 min-w-0 hover:underline underline-offset-2"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[rgb(0_0_0/0.35)] border border-[var(--ncx-border)] overflow-hidden shrink-0">
            <Image
              src={`/logos/${away.slug}.webp`}
              alt={`${away.team} logo`}
              width={28}
              height={28}
              className="object-contain"
              unoptimized
            />
          </span>
          <span className="truncate text-[var(--ncx-text-primary)]">
            <span className="text-xs text-[var(--ncx-text-muted)] mr-1">
              ({away.seed})
            </span>
            {away.team}
            <span className="ml-1 text-[11px] text-[var(--ncx-text-muted)]">
              #{away.rank}
            </span>
          </span>
        </Link>

        <span className="mx-1 text-[11px] text-[var(--ncx-text-muted)]">at</span>

        <Link
          href={`/m/team/${encodeURIComponent(home.slug)}`}
          prefetch={false}
          className="flex items-center gap-2 min-w-0 justify-end hover:underline underline-offset-2 text-right"
        >
          <span className="truncate text-[var(--ncx-text-primary)]">
            <span className="text-xs text-[var(--ncx-text-muted)] mr-1">
              ({home.seed})
            </span>
            {home.team}
            <span className="ml-1 text-[11px] text-[var(--ncx-text-muted)]">
              #{home.rank}
            </span>
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[rgb(0_0_0/0.35)] border border-[var(--ncx-border)] overflow-hidden shrink-0">
            <Image
              src={`/logos/${home.slug}.webp`}
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

  return (
    <section className="rounded-2xl bg-[var(--ncx-bg-panel)] border border-[var(--ncx-border)] p-3 space-y-3">
      <header className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-[rgb(0_0_0/0.35)] border border-[var(--ncx-border)] flex items-center justify-center overflow-hidden">
          <Image
            src={`/logos/${oneSeed.slug}.webp`}
            alt={`${oneSeed.team} logo`}
            width={36}
            height={36}
            className="object-contain"
            unoptimized
          />
        </div>
        <div>
          <div className="text-[11px] uppercase text-[var(--ncx-text-muted)]">
            Region {index + 1}
          </div>
          <div className="text-xs font-semibold text-[var(--ncx-text-primary)]">
            Top Seed:{" "}
            <span className="text-[rgb(var(--ncx-primary-rgb))]">
              {oneSeed.team} (1) – #{oneSeed.rank}
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
  let data: OverallRow[] = [];
  let errorMsg: string | null = null;

  try {
    data = await fetchOverallStandingsCached();
  } catch {
    errorMsg =
      "We hit the Google Sheets read limit momentarily. Please try again in a minute.";
  }

  if (errorMsg) {
    return (
      <div className="rounded-2xl border border-[var(--ncx-border)] bg-[var(--ncx-bg-panel)] p-4 text-center text-sm text-[rgb(var(--ncx-secondary-rgb))]">
        {errorMsg}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-[var(--ncx-border)] bg-[var(--ncx-bg-panel)] p-4 text-center text-sm text-[var(--ncx-text-muted)]">
        No standings data available.
      </div>
    );
  }

  const regions = buildRegions(data);
  if (!regions.length) {
    return (
      <div className="rounded-2xl border border-[var(--ncx-border)] bg-[var(--ncx-bg-panel)] p-4 text-center text-sm text-[var(--ncx-text-muted)]">
        Need at least 16 teams in the standings to build the playoff bracket.
      </div>
    );
  }

  const [r1, r2, r3, r4] = regions;
  const leftRegions = [r1, r4];
  const rightRegions = [r2, r3];

  return (
    <section className="w-full space-y-4 p-3">
      <div className="rounded-2xl border border-[var(--ncx-border)] bg-[var(--ncx-bg-panel)] p-3 text-center">
        <h1 className="text-lg font-extrabold tracking-wide ncx-hero-title ncx-hero-glow mb-1">
          Playoff Bracket
        </h1>
        <p className="text-[11px] text-[var(--ncx-text-muted)]">
          Top 16 advance. 1–4 are 1-seeds, 5–8 are 2-seeds, 9–12 are 3-seeds,
          13–16 are 4-seeds.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-3">
          {leftRegions.map((region) => (
            <RegionCard key={region.index} region={region} />
          ))}
        </div>

        <div className="space-y-3">
          <section className="rounded-2xl bg-[var(--ncx-bg-panel)] border border-[var(--ncx-border)] p-3 text-xs">
            <h3 className="text-center text-xs font-semibold text-[rgb(var(--ncx-primary-rgb))] mb-2 uppercase tracking-wide">
              Final Four
            </h3>

            <div className="space-y-2">
              <div className="rounded-lg bg-[rgb(0_0_0/0.35)] border border-[var(--ncx-border)] px-3 py-2">
                <div className="text-[11px] uppercase text-[var(--ncx-text-muted)] mb-1">
                  Semifinal 1
                </div>
                <div className="text-[12px] text-[var(--ncx-text-primary)]">
                  Winner Region 1 vs Winner Region 4
                </div>
              </div>

              <div className="rounded-lg bg-[rgb(0_0_0/0.35)] border border-[var(--ncx-border)] px-3 py-2">
                <div className="text-[11px] uppercase text-[var(--ncx-text-muted)] mb-1">
                  Semifinal 2
                </div>
                <div className="text-[12px] text-[var(--ncx-text-primary)]">
                  Winner Region 2 vs Winner Region 3
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-[var(--ncx-bg-panel)] border border-[rgb(var(--ncx-secondary-rgb)/0.6)] p-3 text-xs">
            <h3 className="text-center text-xs font-semibold text-[rgb(var(--ncx-secondary-rgb))] mb-2 uppercase tracking-wide">
              Championship
            </h3>
            <div className="text-[12px] text-[var(--ncx-text-primary)] text-center">
              Winner Semifinal 1 vs Winner Semifinal 2
            </div>
          </section>
        </div>

        <div className="space-y-3">
          {rightRegions.map((region) => (
            <RegionCard key={region.index} region={region} />
          ))}
        </div>
      </div>
    </section>
  );
}
