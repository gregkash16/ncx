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

type BracketDef = {
  label: string;
  topMatch: [number, number];
  bottomMatch: [number, number];
};

const BRACKETS: BracketDef[] = [
  { label: "Bracket A", topMatch: [1, 16], bottomMatch: [8, 12] },
  { label: "Bracket B", topMatch: [2, 15], bottomMatch: [7, 11] },
  { label: "Bracket C", topMatch: [3, 14], bottomMatch: [6, 10] },
  { label: "Bracket D", topMatch: [4, 13], bottomMatch: [5, 9] },
];

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
   Seed slot (single team row in a matchup)
--------------------------------------------- */
function SeedSlot({
  seedRank,
  row,
  mobile,
}: {
  seedRank: number;
  row: OverallRow | undefined;
  mobile?: boolean;
}) {
  const teamName = row?.team ?? "TBD";
  const slug = row ? teamSlug(row.team) : "";
  const href = row
    ? mobile
      ? `/m/team/${encodeURIComponent(slug)}`
      : `/?tab=team&team=${encodeURIComponent(slug)}`
    : undefined;

  const inner = (
    <div className="flex items-center gap-2 rounded-md bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.4)] border border-[var(--ncx-border)] px-2 py-1.5 hover:bg-white/5 transition-colors h-9">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[rgb(var(--ncx-highlight-rgb)/0.18)] text-[10px] font-bold text-[rgb(var(--ncx-highlight-rgb))]">
        {seedRank}
      </span>
      {row ? (
        <Image
          src={`/logos/${slug}.webp`}
          alt={teamName}
          width={22}
          height={22}
          unoptimized
          className="shrink-0"
        />
      ) : (
        <span className="inline-block h-[22px] w-[22px] shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--ncx-text-primary)]">
        {teamName}
      </span>
      {row && (
        <span className="shrink-0 text-[10px] text-[var(--ncx-text-muted)]">
          {row.wins}-{row.losses}
        </span>
      )}
    </div>
  );

  return href ? <a href={href} className="block">{inner}</a> : inner;
}

/* ---------------------------------------------
   Matchup (two seed slots stacked)
--------------------------------------------- */
function Matchup({
  match,
  byRank,
  mobile,
}: {
  match: [number, number];
  byRank: Map<number, OverallRow>;
  mobile?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <SeedSlot seedRank={match[0]} row={byRank.get(match[0])} mobile={mobile} />
      <SeedSlot seedRank={match[1]} row={byRank.get(match[1])} mobile={mobile} />
    </div>
  );
}

/* ---------------------------------------------
   Round 1 bracket card (two matchups + label)
--------------------------------------------- */
function R1Card({
  def,
  byRank,
  mobile,
}: {
  def: BracketDef;
  byRank: Map<number, OverallRow>;
  mobile?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[rgb(var(--ncx-highlight-rgb))] px-1">
        {def.label}
      </div>
      <Matchup match={def.topMatch} byRank={byRank} mobile={mobile} />
      <div className="h-3" />
      <Matchup match={def.bottomMatch} byRank={byRank} mobile={mobile} />
    </div>
  );
}

/* ---------------------------------------------
   TBD slot for future rounds
--------------------------------------------- */
function TbdSlot({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.25)] border border-dashed border-[var(--ncx-border)] px-2 py-1.5 h-9">
      <span className="text-xs text-[var(--ncx-text-muted)] italic">{label}</span>
    </div>
  );
}

/* ---------------------------------------------
   SVG bracket connector lines
   Draws lines from two source boxes to one target
--------------------------------------------- */
function BracketConnector({ side }: { side: "left" | "right" }) {
  // For the left side, lines go right →
  // For the right side, lines go left ←
  const isLeft = side === "left";

  return (
    <svg
      className="shrink-0 hidden xl:block"
      width="32"
      height="100%"
      viewBox="0 0 32 100"
      preserveAspectRatio="none"
      style={{ height: "100%" }}
    >
      {isLeft ? (
        <>
          <line x1="0" y1="25" x2="16" y2="25" stroke="rgb(var(--ncx-highlight-rgb))" strokeWidth="1.5" strokeOpacity="0.4" />
          <line x1="0" y1="75" x2="16" y2="75" stroke="rgb(var(--ncx-highlight-rgb))" strokeWidth="1.5" strokeOpacity="0.4" />
          <line x1="16" y1="25" x2="16" y2="75" stroke="rgb(var(--ncx-highlight-rgb))" strokeWidth="1.5" strokeOpacity="0.4" />
          <line x1="16" y1="50" x2="32" y2="50" stroke="rgb(var(--ncx-highlight-rgb))" strokeWidth="1.5" strokeOpacity="0.4" />
        </>
      ) : (
        <>
          <line x1="32" y1="25" x2="16" y2="25" stroke="rgb(var(--ncx-highlight-rgb))" strokeWidth="1.5" strokeOpacity="0.4" />
          <line x1="32" y1="75" x2="16" y2="75" stroke="rgb(var(--ncx-highlight-rgb))" strokeWidth="1.5" strokeOpacity="0.4" />
          <line x1="16" y1="25" x2="16" y2="75" stroke="rgb(var(--ncx-highlight-rgb))" strokeWidth="1.5" strokeOpacity="0.4" />
          <line x1="16" y1="50" x2="0" y2="50" stroke="rgb(var(--ncx-highlight-rgb))" strokeWidth="1.5" strokeOpacity="0.4" />
        </>
      )}
    </svg>
  );
}

/* ---------------------------------------------
   Main Component
--------------------------------------------- */
export default async function PlayoffsPanel({ mobile }: { mobile?: boolean } = {}) {
  let data: OverallRow[] = [];
  let errorMsg: string | null = null;

  try {
    data = await fetchOverallStandingsFromDb();
  } catch (err) {
    console.error("PlayoffsPanel DB error:", err);
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

  if (data.length < 16) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] text-sm text-[var(--ncx-text-muted)] text-center">
        Need 16 teams for playoffs.
      </div>
    );
  }

  const byRank = new Map(data.map((r) => [r.rank, r]));
  const [bracketA, bracketB, bracketC, bracketD] = BRACKETS;

  return (
    <div className="py-4 space-y-5">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-wide">
          <span className="text-[rgb(var(--ncx-highlight-rgb))]">PLAYOFF</span>{" "}
          <span className="text-[rgb(var(--ncx-primary-rgb))]">BRACKET</span>
        </h2>
        <p className="text-xs text-[var(--ncx-text-muted)] mt-1">
          Top 16 teams seeded by standings. Brackets update live.
        </p>
      </div>

      {/* ── Bracket grid ── */}
      <div className="grid grid-cols-[1fr] xl:grid-cols-[minmax(0,1fr)_32px_minmax(0,0.7fr)_80px_minmax(0,0.7fr)_32px_minmax(0,1fr)] items-stretch gap-y-6 xl:gap-y-0">

        {/* ─── LEFT: Round 1 (A top, D bottom) ─── */}
        <div className="flex flex-col justify-between gap-6 xl:gap-4">
          <R1Card def={bracketA} byRank={byRank} mobile={mobile} />
          <R1Card def={bracketD} byRank={byRank} mobile={mobile} />
        </div>

        {/* Connector: R1 left → Semifinal left */}
        <div className="hidden xl:flex items-stretch">
          <BracketConnector side="left" />
        </div>

        {/* ─── LEFT SEMIFINAL ─── */}
        <div className="flex flex-col justify-center">
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[rgb(var(--ncx-primary-rgb))] px-1">
              Semifinal 1
            </div>
            <div className="flex flex-col gap-0.5">
              <TbdSlot label="Winner Bracket A" />
              <TbdSlot label="Winner Bracket D" />
            </div>
          </div>
        </div>

        {/* ─── CENTER: Championship ─── */}
        <div className="flex flex-col items-center justify-center">
          <div className="rounded-xl border-2 border-[rgb(var(--ncx-highlight-rgb)/0.5)] bg-[rgb(var(--ncx-highlight-rgb)/0.08)] px-3 py-4 text-center w-full">
            <div className="text-[9px] font-bold uppercase tracking-widest text-[rgb(var(--ncx-highlight-rgb))] mb-2">
              Finals
            </div>
            <div className="w-8 h-8 mx-auto rounded-lg bg-[rgb(var(--ncx-highlight-rgb)/0.15)] flex items-center justify-center mb-2">
              <span className="text-base">🏆</span>
            </div>
            <div className="text-[10px] text-[var(--ncx-text-muted)] leading-tight">
              SF1 Winner<br />vs<br />SF2 Winner
            </div>
          </div>
        </div>

        {/* ─── RIGHT SEMIFINAL ─── */}
        <div className="flex flex-col justify-center">
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[rgb(var(--ncx-primary-rgb))] px-1">
              Semifinal 2
            </div>
            <div className="flex flex-col gap-0.5">
              <TbdSlot label="Winner Bracket B" />
              <TbdSlot label="Winner Bracket C" />
            </div>
          </div>
        </div>

        {/* Connector: Semifinal right → R1 right */}
        <div className="hidden xl:flex items-stretch">
          <BracketConnector side="right" />
        </div>

        {/* ─── RIGHT: Round 1 (B top, C bottom) ─── */}
        <div className="flex flex-col justify-between gap-6 xl:gap-4">
          <R1Card def={bracketB} byRank={byRank} mobile={mobile} />
          <R1Card def={bracketC} byRank={byRank} mobile={mobile} />
        </div>
      </div>
    </div>
  );
}
