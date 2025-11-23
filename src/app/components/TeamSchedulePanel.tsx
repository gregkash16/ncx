// src/app/components/TeamSchedulePanel.tsx
import Link from "next/link";
import Image from "next/image";
import { fetchScheduleForTeam, TeamScheduleRow, getSheets } from "@/lib/googleSheets";
import { teamSlug } from "@/lib/slug";
import PlayerDMLink from "@/app/components/PlayerDMLink";

/* ----------------------------- helpers ----------------------------- */
function normalizeWeekLabel(label: string): string {
  const s = String(label ?? "").trim();
  if (!s) return "WEEK 1";
  const m = s.match(/week\s*(\d+)/i);
  if (m) return `WEEK ${parseInt(m[1], 10)}`;
  const n = parseInt(s, 10);
  if (Number.isFinite(n) && n > 0) return `WEEK ${n}`;
  return s.toUpperCase();
}

function toInt(val: unknown): number {
  const s = String(val ?? "").trim();
  if (s === "" || s === "-" || s === "–" || s === "—") return 0;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

type Status = "SCHEDULED" | "IN PROGRESS" | "FINAL";

type EnrichedRow = TeamScheduleRow & {
  week: string;
  status: Status;
  awayWins: number;
  homeWins: number;
  seriesOver: boolean;
};

type PanelMode = "desktop" | "mobile";

/** Optional roster info for the team page, per player. */
export type TeamRosterPlayer = {
  ncxid: string;
  name: string;
  faction?: string | null;
  discordId?: string | null;
  discordTag?: string | null;

  // Individual stats (mirrors IndRow fields, but all as strings for display)
  wins?: string;
  losses?: string;
  points?: string;
  plms?: string;
  games?: string;
  winPct?: string;
  ppg?: string;
  efficiency?: string;
  war?: string;
  h2h?: string;
  potato?: string;
  sos?: string;
};

/** Team advanced stats (from AdvStats Table1). */
export type TeamAdvStats = {
  team: string;
  totalGames: string;
  avgWins: string;
  avgLoss: string;
  avgPoints: string;
  avgPlms: string;
  avgGames: string;
  avgWinPct: string;
  avgPpg: string;
  avgEfficiency: string;
  avgWar: string;
  avgH2h: string;
  avgPotato: string;
  avgSos: string;
};

/**
 * Read the week grid (A1:Q120) and derive wins like CurrentWeekCard:
 * - Away Team = col D (index 3)
 * - Away Wins = col E (index 4)
 * - Home Team = col L (index 11)
 * - Home Wins = col M (index 12)
 * We scan each 10-row block starting at visual row 10 (idx 9): 9, 19, 29, ... 119
 */
async function deriveSeriesFromWeek(weekTab: string, away: string, home: string) {
  const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID || process.env.SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) return { awayWins: 0, homeWins: 0, found: false };

  const sheets = getSheets();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${weekTab}!A1:Q120`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const data = resp.data.values ?? [];

  for (let rowNum = 9; rowNum < 120; rowNum += 10) {
    const idx = rowNum - 1;
    const row = data[idx] ?? [];
    const awayTeam = String(row[3] ?? "").trim();
    const homeTeam = String(row[11] ?? "").trim();
    if (!awayTeam && !homeTeam) continue;

    const matchesDirect = awayTeam === away && homeTeam === home;
    const matchesFlipped = awayTeam === home && homeTeam === away;
    if (!matchesDirect && !matchesFlipped) continue;

    const awayWins = toInt(row[4]);
    const homeWins = toInt(row[12]);

    if (matchesFlipped) {
      return { awayWins: homeWins, homeWins: awayWins, found: true };
    }
    return { awayWins, homeWins, found: true };
  }

  return { awayWins: 0, homeWins: 0, found: false };
}

async function enrichRowWithScore(row: TeamScheduleRow): Promise<EnrichedRow> {
  const weekTab = normalizeWeekLabel(row.week);
  try {
    const { awayWins, homeWins, found } = await deriveSeriesFromWeek(weekTab, row.away, row.home);
    if (!found) {
      return {
        ...row,
        week: weekTab,
        status: "SCHEDULED",
        awayWins: 0,
        homeWins: 0,
        seriesOver: false,
      };
    }
    const seriesOver = awayWins >= 4 || homeWins >= 4;
    const status: Status =
      awayWins > 0 || homeWins > 0 ? (seriesOver ? "FINAL" : "IN PROGRESS") : "SCHEDULED";
    return { ...row, week: weekTab, status, awayWins, homeWins, seriesOver };
  } catch {
    return {
      ...row,
      week: weekTab,
      status: "SCHEDULED",
      awayWins: 0,
      homeWins: 0,
      seriesOver: false,
    };
  }
}

function StatusCell({ row, teamName }: { row: EnrichedRow; teamName: string }) {
  if (row.status === "SCHEDULED") {
    return <span className="text-zinc-500">Scheduled</span>;
  }
  if (row.status === "IN PROGRESS") {
    return <span className="font-semibold text-yellow-300">In Progress</span>;
  }

  const viewingIsAway = row.away === teamName;
  const viewingIsHome = row.home === teamName;
  const viewingWon =
    (viewingIsAway && row.awayWins > row.homeWins) ||
    (viewingIsHome && row.homeWins > row.awayWins);
  const viewingLost =
    (viewingIsAway && row.awayWins < row.homeWins) ||
    (viewingIsHome && row.homeWins < row.awayWins);

  if (viewingWon) {
    return (
      <div className="flex items-center justify-end gap-2 text-green-400 font-semibold">
        <span>Winner</span>
        <Image
          src={`/logos/${teamSlug(teamName)}.png`}
          alt={`${teamName} logo`}
          width={24}
          height={24}
          className="object-contain rounded"
          unoptimized
        />
      </div>
    );
  }
  if (viewingLost) {
    return (
      <div className="flex items-center justify-end gap-2 text-red-400 font-semibold">
        <span>Loser</span>
        <Image
          src={`/logos/${teamSlug(teamName)}.png`}
          alt={`${teamName} logo`}
          width={24}
          height={24}
          className="object-contain rounded"
          unoptimized
        />
      </div>
    );
  }
  return <span className="text-zinc-400">Final</span>;
}

/* ---- faction icon helpers (same mapping idea as MatchupsPanel) ---- */
const FACTION_FILE: Record<string, string> = {
  REBELS: "Rebels.png",
  EMPIRE: "Empire.png",
  REPUBLIC: "Republic.png",
  CIS: "CIS.png",
  RESISTANCE: "Resistance.png",
  "FIRST ORDER": "First Order.png",
  SCUM: "Scum.png",
};

function factionIconSrc(faction?: string | null) {
  const key = (faction || "").toUpperCase().trim();
  const file = FACTION_FILE[key];
  return file ? `/factions/${file}` : "";
}

/* ----------------------------- PANEL ----------------------------- */

type TeamSchedulePanelProps = {
  team: string;
  /** desktop = "/?tab=current&w=...", mobile = "/m/current?w=..." */
  mode?: PanelMode;

  /** Roster of players with Discord + stats. */
  roster?: TeamRosterPlayer[];

  /** Optional advanced stats row for this team (from AdvStats Table1). */
  teamAdvStats?: TeamAdvStats;
};

export default async function TeamSchedulePanel({
  team,
  mode = "desktop",
  roster,
  teamAdvStats,
}: TeamSchedulePanelProps) {
  const { teamName, rows } = await fetchScheduleForTeam(team);

  if (!rows.length) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800">
        <h2 className="text-2xl font-bold">Team Schedule</h2>
        <p className="mt-2 text-zinc-400">Couldn’t find a schedule for “{team}”.</p>
      </div>
    );
  }

  const enrichedRows = await Promise.all(rows.map(enrichRowWithScore));

  // Series summary from the schedule
  let seriesWins = 0;
  let seriesLosses = 0;
  let seriesInProgress = 0;
  let totalMapsWon = 0;
  let totalMapsLost = 0;

  for (const r of enrichedRows) {
    const viewingIsAway = r.away === teamName;
    const viewingIsHome = r.home === teamName;
    const mapsFor = viewingIsAway ? r.awayWins : viewingIsHome ? r.homeWins : 0;
    const mapsAgainst = viewingIsAway ? r.homeWins : viewingIsHome ? r.awayWins : 0;

    totalMapsWon += mapsFor;
    totalMapsLost += mapsAgainst;

    if (r.status === "FINAL") {
      if (mapsFor > mapsAgainst) seriesWins += 1;
      else if (mapsAgainst > mapsFor) seriesLosses += 1;
    } else if (r.status === "IN PROGRESS") {
      seriesInProgress += 1;
    }
  }

  const totalSeries = seriesWins + seriesLosses + seriesInProgress;

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800">
      {/* Hero card */}
      <header className="mb-6">
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
    {/* LEFT — Logo + Title */}
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20 rounded-2xl bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center">
        {/* No glow */}
        <Image
          src={`/logos/${teamSlug(teamName)}.png`}
          alt={`${teamName} logo`}
          width={80}
          height={80}
          className="object-contain"
          unoptimized
        />
      </div>

      <div>
        <h2 className="text-3xl font-extrabold tracking-wide">
          <span className="text-cyan-400">{teamName}</span>{" "}
          <span className="text-zinc-200">Team Hub</span>
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Roster, advanced team metrics, and weekly results for{" "}
          <span className="text-cyan-300 font-semibold">{teamName}</span>.
        </p>
      </div>
    </div>

    {/* RIGHT — Series record pill + wide Adv Stats box */}
    <div className="flex-1 md:max-w-2xl flex flex-col sm:flex-row gap-4 ml-auto">
      {/* Series Record pill (kept compact) */}
      <div className="rounded-xl bg-zinc-800/70 border border-zinc-700 px-4 py-2 w-full sm:w-64 md:w-72 shrink-0">
        <div className="text-xs uppercase text-zinc-400">Series Record</div>
        <div className="font-mono text-lg">
          {seriesWins}-{seriesLosses}
          {totalSeries ? (
            <span className="text-zinc-400 text-xs ml-2">
              ({totalSeries} series, {seriesInProgress} in progress)
            </span>
          ) : null}
        </div>
        <div className="mt-1 text-xs text-zinc-400">
          Games:{" "}
          <span className="font-mono text-zinc-100">
            {totalMapsWon}-{totalMapsLost}
          </span>
        </div>
      </div>

      {/* Wide Advanced Stats box fills remaining space */}
      {teamAdvStats && (
        <div className="rounded-xl bg-zinc-800/70 border border-cyan-500/40 px-4 py-4 w-full sm:flex-1">
          <div className="text-xs uppercase text-cyan-300 mb-2">
            Team Advanced Averages
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-2 text-sm text-zinc-300">
            <div>
              Win%:{" "}
              <span className="font-mono text-zinc-100">
                {teamAdvStats.avgWinPct || "—"}
              </span>
            </div>

            <div>
              PPG:{" "}
              <span className="font-mono text-zinc-100">
                {teamAdvStats.avgPpg || "—"}
              </span>
            </div>

            <div>
              Eff:{" "}
              <span className="font-mono text-zinc-100">
                {teamAdvStats.avgEfficiency || "—"}
              </span>
            </div>

            <div>
              PL/MS:{" "}
              <span className="font-mono text-zinc-100">
                {teamAdvStats.avgPlms || "—"}
              </span>
            </div>

            <div>
              Potato:{" "}
              <span className="font-mono text-zinc-100">
                {teamAdvStats.avgPotato || "—"}
              </span>
            </div>

            <div>
              SOS:{" "}
              <span className="font-mono text-zinc-100">
                {teamAdvStats.avgSos || "—"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
</header>


      {/* Main grid: roster + schedule */}
      <div className="grid gap-6 md:grid-cols-[minmax(0,2.1fr)_minmax(0,3fr)]">
        <TeamRosterCard teamName={teamName} roster={roster} />
        <TeamTable rows={enrichedRows} teamName={teamName} mode={mode} />
      </div>
    </div>
  );
}

/* ----------------------------- ROSTER CARD ----------------------------- */

function TeamRosterCard({
  teamName,
  roster,
}: {
  teamName: string;
  roster?: TeamRosterPlayer[];
}) {
  if (!roster || roster.length === 0) {
    return (
      <section className="rounded-2xl bg-zinc-950/60 border border-zinc-800 p-4">
        <h3 className="text-lg font-semibold mb-2">
          <span className="text-cyan-300">Roster</span>{" "}
          <span className="text-zinc-300">/ Players</span>
        </h3>
        <p className="text-sm text-zinc-400">
          Roster data isn’t wired up yet for <span className="text-cyan-300">{teamName}</span>.
          Once you pass <code>roster</code> into <code>TeamSchedulePanel</code>, players, factions,
          and Discord DM links will appear here.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-zinc-950/60 border border-zinc-800 p-4">
      <h3 className="text-lg font-semibold mb-3">
        <span className="text-cyan-300">Roster</span>{" "}
        <span className="text-zinc-300">/ Players</span>
      </h3>

      <ul className="space-y-2">
        {roster.map((p) => {
          const icon = factionIconSrc(p.faction);
          const tooltip = p.discordTag ? `@${p.discordTag}` : "Open DM";

          const record =
            p.wins || p.losses ? `${p.wins ?? "0"}-${p.losses ?? "0"}` : "—";

          return (
            <li
              key={p.ncxid}
              className="flex items-start gap-3 rounded-xl bg-zinc-900/80 border border-zinc-800 px-3 py-2"
            >
              {/* Faction icon with glow */}
              {icon && (
                <Image
                  src={icon}
                  alt={`${p.faction ?? "Faction"} icon`}
                  width={32}
                  height={32}
                  /* className="object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.65)]" */
                  unoptimized
                />
              )}

              <div className="min-w-0 flex-1">
                {/* Name + NCX pill on one line */}
                <div className="flex items-center gap-2">
                  <PlayerDMLink
                    name={p.name}
                    discordId={p.discordId}
                    titleSuffix={tooltip}
                    className="font-semibold text-cyan-200 hover:text-cyan-100"
                  />
                  <span className="rounded-full bg-zinc-800/80 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200 font-mono whitespace-nowrap">
                    {p.ncxid}
                  </span>
                </div>

                {/* Faction + stats */}
                <div className="mt-1 text-[11px] text-zinc-400 space-y-0.5">
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {p.faction && (
                      <span className="uppercase tracking-wide">{p.faction}</span>
                    )}
                    <span>
                      Record:{" "}
                      <span className="font-mono text-zinc-100">{record}</span>
                    </span>
                    {p.points && (
                      <span>
                        Pts:{" "}
                        <span className="font-mono text-zinc-100">
                          {p.points}
                        </span>
                      </span>
                    )}
                    {p.plms && (
                      <span>
                        PL/MS:{" "}
                        <span className="font-mono text-zinc-100">
                          {p.plms}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {p.efficiency && (
                      <span>
                        Eff:{" "}
                        <span className="font-mono text-zinc-100">
                          {p.efficiency}
                        </span>
                      </span>
                    )}
                    {p.potato && (
                      <span>
                        Potato:{" "}
                        <span className="font-mono text-zinc-100">
                          {p.potato}
                        </span>
                      </span>
                    )}
                    {p.sos && (
                      <span>
                        SOS:{" "}
                        <span className="font-mono text-zinc-100">
                          {p.sos}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ----------------------------- TABLE ----------------------------- */

async function TeamTable({
  rows,
  teamName,
  mode,
}: {
  rows: EnrichedRow[];
  teamName: string;
  mode: PanelMode;
}) {
  return (
    <section className="rounded-2xl bg-zinc-950/60 border border-zinc-800 p-4">
      <h3 className="text-lg font-semibold mb-3">
        <span className="text-pink-400">Schedule</span>{" "}
        <span className="text-zinc-300">&amp; Results</span>
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-zinc-200">
          <thead className="text-sm uppercase text-zinc-400">
            <tr className="[&>th]:py-2 [&>th]:px-2">
              <th className="w-24">Week</th>
              <th className="w-[40%]">Away</th>
              <th className="w-[40%]">Home</th>
              <th className="text-right w-36">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {rows.map((r, i) => {
              const weekLabel = normalizeWeekLabel(r.week);

              // 🔒 Use explicit string URLs so they can't get rewritten to `?w=...` on `/m`.
              const weekHref =
                mode === "mobile"
                  ? `/m/current?w=${encodeURIComponent(weekLabel)}`
                  : `/?tab=current&w=${encodeURIComponent(weekLabel)}`;

              let rowTone = "";
              if (r.status === "FINAL") {
                const viewingIsAway = r.away === teamName;
                const viewingIsHome = r.home === teamName;
                const viewingWon =
                  (viewingIsAway && r.awayWins > r.homeWins) ||
                  (viewingIsHome && r.homeWins > r.awayWins);
                const viewingLost =
                  (viewingIsAway && r.awayWins < r.homeWins) ||
                  (viewingIsHome && r.homeWins < r.awayWins);

                if (viewingWon) rowTone = "bg-green-900/20 border-green-700/50";
                else if (viewingLost) rowTone = "bg-red-900/20 border-red-700/50";
              } else if (r.status === "IN PROGRESS") {
                rowTone = "bg-yellow-900/15 border-yellow-700/40";
              }

              return (
                <tr key={`${weekLabel}-${i}`} className={`border-t border-zinc-800 ${rowTone}`}>
                  {/* Week → link to Current Week (desktop) or Mobile Current (mobile) */}
                  <td className="py-2 px-2">
                    <Link
                      href={weekHref}
                      prefetch={false}
                      className="text-cyan-300 hover:text-cyan-200 underline-offset-2 hover:underline"
                    >
                      {weekLabel}
                    </Link>
                  </td>

                  {/* Away */}
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Image
                        src={`/logos/${teamSlug(r.away)}.png`}
                        alt={`${r.away} logo`}
                        width={24}
                        height={24}
                        className="object-contain rounded"
                        unoptimized
                      />
                      <span className="truncate">{r.away}</span>
                    </div>
                  </td>

                  {/* Home */}
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Image
                        src={`/logos/${teamSlug(r.home)}.png`}
                        alt={`${r.home} logo`}
                        width={24}
                        height={24}
                        className="object-contain rounded"
                        unoptimized
                      />
                      <span className="truncate">{r.home}</span>
                    </div>
                  </td>

                  {/* Status → Winner/Loser/In Progress */}
                  <td className="py-2 px-2 text-right">
                    <StatusCell row={r} teamName={teamName} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-6 text-sm text-zinc-400">
          Click any <span className="text-cyan-300">Week</span> to jump to the{" "}
          <span className="text-cyan-300">
            {mode === "mobile" ? "Mobile Current Week" : "Current Week"}
          </span>{" "}
          view with that week selected.
        </div>
      </div>
    </section>
  );
}
