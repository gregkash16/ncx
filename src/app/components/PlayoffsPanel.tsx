// src/app/components/PlayoffsPanel.tsx
import Image from "next/image";
import { pool } from "@/lib/db";
import { teamSlug } from "@/lib/slug";

/* ---------------------------------------------
   Types
--------------------------------------------- */
export type OverallRow = {
  rank: number;
  team: string;
  wins: number;
  losses: number;
  gameWins: number;
  points: number;
};

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

/* ---------------------------------------------
   Load standings from MySQL
--------------------------------------------- */
async function fetchOverallStandingsFromDb(): Promise<OverallRow[]> {
  const sql =
    "SELECT `rank`, `team`, `wins`, `losses`, `game_wins`, `points` FROM `overall_standings` ORDER BY `rank` ASC";

  const [rows] = await pool.query<any[]>(sql);

  return (rows ?? []).map((r) => ({
    rank: Number(r.rank),
    team: String(r.team ?? ""),
    wins: Number(r.wins ?? 0),
    losses: Number(r.losses ?? 0),
    gameWins: Number(r.game_wins ?? 0),
    points: Number(r.points ?? 0),
  }));
}

/* ---------------------------------------------
   Helpers
--------------------------------------------- */
function toSeeded(row: OverallRow, seed: SeedNumber): SeededTeam {
  const slug = teamSlug(row.team);
  return {
    seed,
    rank: row.rank,
    team: row.team,
    wins: row.wins,
    losses: row.losses,
    gameWins: row.gameWins,
    points: row.points,
    slug,
  };
}

function buildRegions(rows: OverallRow[]): Region[] {
  if (!rows || rows.length < 16) return [];

  const top16 = rows.slice(0, 16);

  const oneSeeds = top16.slice(0, 4).map((r) => toSeeded(r, 1));
  const twoSeeds = top16.slice(4, 8).map((r) => toSeeded(r, 2));
  const threeSeeds = top16.slice(8, 12).map((r) => toSeeded(r, 3));
  const fourSeeds = top16.slice(12, 16).map((r) => toSeeded(r, 4));

  // "difficulty" ordering: worse rank number is harder
  const twoByDifficulty = [...twoSeeds].sort((a, b) => b.rank - a.rank);
  const threeByDifficulty = [...threeSeeds].sort((a, b) => b.rank - a.rank);
  const fourByDifficulty = [...fourSeeds].sort((a, b) => b.rank - a.rank);

  return oneSeeds.map((oneSeed, idx) => ({
    index: idx,
    oneSeed,
    twoSeed: twoByDifficulty[idx],
    threeSeed: threeByDifficulty[idx],
    fourSeed: fourByDifficulty[idx],
  }));
}

/* ---------------------------------------------
   Region card UI
--------------------------------------------- */
function RegionCard({ region }: { region: Region }) {
  const { index, oneSeed, twoSeed, threeSeed, fourSeed } = region;
  const regionName = `Region ${index + 1}`;
  const topSeedTeam = oneSeed.team;

  const game1Home = oneSeed;
  const game1Away = fourSeed;

  const game2Home = twoSeed.rank < threeSeed.rank ? twoSeed : threeSeed;
  const game2Away = game2Home === twoSeed ? threeSeed : twoSeed;

  const matchRow = (label: string, away: SeededTeam, home: SeededTeam) => {
    const awayHref = `/?tab=team&team=${encodeURIComponent(away.slug)}`;
    const homeHref = `/?tab=team&team=${encodeURIComponent(home.slug)}`;

    return (
      <div className="rounded-xl bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.12)] border border-[var(--ncx-border)] px-3 py-2 text-sm">
        <div className="text-[11px] uppercase text-[var(--ncx-text-muted)] mb-1 flex justify-between">
          <span>{label}</span>
          <span>Higher seed is home</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <a
            href={awayHref}
            className="flex items-center gap-2 min-w-0 hover:underline"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.18)] border border-[var(--ncx-border)] overflow-hidden shrink-0">
              <Image
                src={`/logos/${away.slug}.webp`}
                alt={away.team}
                width={28}
                height={28}
                unoptimized
              />
            </span>
            <span className="truncate">
              <span className="text-xs text-[var(--ncx-text-muted)] mr-1">
                ({away.seed})
              </span>
              <span className="text-[var(--ncx-text-primary)]">{away.team}</span>
              <span className="ml-1 text-[11px] text-[var(--ncx-text-muted)]">
                #{away.rank}
              </span>
            </span>
          </a>

          <span className="mx-1 text-[11px] text-[var(--ncx-text-muted)]">at</span>

          <a
            href={homeHref}
            className="flex items-center gap-2 min-w-0 justify-end hover:underline"
          >
            <span className="truncate">
              <span className="text-xs text-[var(--ncx-text-muted)] mr-1">
                ({home.seed})
              </span>
              <span className="text-[var(--ncx-text-primary)]">{home.team}</span>
              <span className="ml-1 text-[11px] text-[var(--ncx-text-muted)]">
                #{home.rank}
              </span>
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.18)] border border-[var(--ncx-border)] overflow-hidden shrink-0">
              <Image
                src={`/logos/${home.slug}.webp`}
                alt={home.team}
                width={28}
                height={28}
                unoptimized
              />
            </span>
          </a>
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] p-4 space-y-3">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.18)] border border-[var(--ncx-border)] flex items-center justify-center">
          <Image
            src={`/logos/${oneSeed.slug}.webp`}
            alt={topSeedTeam}
            width={40}
            height={40}
            unoptimized
          />
        </div>
        <div>
          <div className="text-xs uppercase text-[var(--ncx-text-muted)]">
            {regionName}
          </div>
          <div className="text-sm font-semibold text-[var(--ncx-text-primary)]">
            Top Seed:{" "}
            <span className="text-[rgb(var(--ncx-primary-rgb))]">
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

/* ---------------------------------------------
   Main Component
--------------------------------------------- */
export default async function PlayoffsPanel() {
  let data: OverallRow[] = [];
  let errorMsg: string | null = null;

  try {
    data = await fetchOverallStandingsFromDb();
  } catch (err) {
    console.error("❌ PlayoffsPanel DB error:", err);
    errorMsg = "Database unavailable. Please try again.";
  }

  if (errorMsg) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] text-sm text-[rgb(var(--ncx-highlight-rgb))] text-center">
        {errorMsg}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] text-sm text-[var(--ncx-text-muted)] text-center">
        No standings data available.
      </div>
    );
  }

  const regions = buildRegions(data);
  if (!regions.length) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] text-sm text-[var(--ncx-text-muted)] text-center">
        Need 16 teams for playoffs.
      </div>
    );
  }

  const [region1, region2, region3, region4] = regions;
  const leftRegions = [region1, region4];
  const rightRegions = [region2, region3];

  return (
    <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)]">
      <h2 className="text-2xl font-bold tracking-wide text-center mb-4">
        <span className="text-[rgb(var(--ncx-highlight-rgb))]">PLAYOFF</span>{" "}
        <span className="text-[rgb(var(--ncx-primary-rgb))]">BRACKET</span>
      </h2>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.9fr_1.15fr] gap-6 items-stretch">
        <div className="space-y-4">
          {leftRegions.map((r) => (
            <RegionCard key={r.index} region={r} />
          ))}
        </div>

        <div className="flex flex-col justify-center gap-4">
          <section className="rounded-2xl bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.12)] border border-[var(--ncx-border)] p-4 text-sm">
            <h3 className="text-center text-sm font-semibold text-[rgb(var(--ncx-primary-rgb))] mb-2 uppercase">
              Final Four
            </h3>
            <div className="space-y-3 text-xs text-[var(--ncx-text-primary)] text-center">
              <div>Winner Region 1 vs Winner Region 4</div>
              <div>Winner Region 2 vs Winner Region 3</div>
            </div>
          </section>

          <section className="rounded-2xl bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.14)] border border-[rgb(var(--ncx-highlight-rgb)/0.60)] p-4 text-sm">
            <h3 className="text-center text-sm font-semibold text-[rgb(var(--ncx-highlight-rgb))] mb-2 uppercase">
              Championship
            </h3>
            <div className="text-xs text-[var(--ncx-text-primary)] text-center">
              Winner Semifinal 1 vs Winner Semifinal 2
            </div>
          </section>
        </div>

        <div className="space-y-4">
          {rightRegions.map((r) => (
            <RegionCard key={r.index} region={r} />
          ))}
        </div>
      </div>
    </div>
  );
}
