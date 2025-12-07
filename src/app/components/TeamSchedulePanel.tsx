// src/app/components/TeamSchedulePanel.tsx
import Link from "next/link";
import Image from "next/image";
import {
  fetchScheduleForTeam,
  TeamScheduleRow,
  getSheets,
} from "@/lib/googleSheets";
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

/**
 * Read the week grid (A1:Q120) and derive wins like CurrentWeekCard:
 * - Away Team = col D (index 3)
 * - Away Wins = col E (index 4)
 * - Home Team = col L (index 11)
 * - Home Wins = col M (index 12)
 * We scan each 10-row block starting at visual row 10 (idx 9): 9, 19, 29, ... 119
 */
async function deriveSeriesFromWeek(weekTab: string, away: string, home: string) {
  const spreadsheetId =
    process.env.NCX_LEAGUE_SHEET_ID || process.env.SHEETS_SPREADSHEET_ID;
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
    const { awayWins, homeWins, found } = await deriveSeriesFromWeek(
      weekTab,
      row.away,
      row.home
    );
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
      awayWins > 0 || homeWins > 0
        ? seriesOver
          ? "FINAL"
          : "IN PROGRESS"
        : "SCHEDULED";
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
          src={`/logos/${teamSlug(teamName)}.webp`}
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
          src={`/logos/${teamSlug(teamName)}.webp`}
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

/* ----------------------------- ROSTER TYPES (EXPORTS) ----------------------------- */

/**
 * These must match how /src/app/(desktop)/page.tsx builds the roster.
 */
export type TeamRosterPlayer = {
  ncxid: string;
  name: string;
  faction: string | null;
  discordId: string | null;
  discordTag: string | null;

  // NEW: optional captain flag
  isCaptain?: boolean;

  // All of these are strings in page.tsx’s buildTeamRoster
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

/* ----------------------------- FACTION ICONS ----------------------------- */

const FACTION_FILE: Record<string, string> = {
  REBELS: "Rebels.webp",
  EMPIRE: "Empire.webp",
  REPUBLIC: "Republic.webp",
  CIS: "CIS.webp",
  RESISTANCE: "Resistance.webp",
  "FIRST ORDER": "First Order.webp",
  SCUM: "Scum.webp",
};

function factionIconSrc(faction?: string | null) {
  const key = (faction || "").toUpperCase().trim();
  const file = FACTION_FILE[key];
  return file ? `/factions/${file}` : "";
}

/* ----------------------------- PANEL ----------------------------- */

export type TeamSchedulePanelProps = {
  team: string;
  mode: "desktop" | "mobile";

  // Optional: provided by (desktop)/page.tsx
  roster?: TeamRosterPlayer[];
  teamAdvStats?: TeamAdvStats;
};

export default async function TeamSchedulePanel({
  team,
  mode = "desktop",
  roster,
  teamAdvStats,
}: TeamSchedulePanelProps) {
  const [{ teamName, rows }] = await Promise.all([fetchScheduleForTeam(team)]);

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-6">
      {!rows.length ? (
        <>
          <h2 className="text-2xl font-bold">Team Schedule</h2>
          <p className="mt-2 text-zinc-400">Couldn’t find a schedule for “{team}”.</p>
        </>
      ) : (
        <>
          {/* Header */}
          <header className="flex items-center gap-3">
            <span className="shrink-0 rounded-md overflow-hidden bg-zinc-800 border border-zinc-700 w-[40px] h-[40px] flex items-center justify-center">
              <Image
                src={`/logos/${teamSlug(teamName)}.webp`}
                alt={`${teamName} logo`}
                width={40}
                height={40}
                className="object-contain"
                unoptimized
              />
            </span>
            <div>
              <h2 className="text-2xl font-extrabold tracking-wide flex items-center gap-2 flex-wrap">
                <span className="text-cyan-400">{teamName}</span>{" "}
                <span className="text-zinc-200">Team Hub</span>
              </h2>
              <p className="text-xs text-zinc-500">
                Roster, factions, and series schedule for the {teamName}.
              </p>
            </div>
          </header>

          {/* Optional: team advanced stats summary */}
          {teamAdvStats && (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 grid gap-3 md:grid-cols-2 text-xs text-zinc-300">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-2">
                  Team Performance Snapshot
                </h3>
                <div className="space-y-1">
                  <div>
                    Games Played:{" "}
                    <span className="text-zinc-100">{teamAdvStats.totalGames}</span>
                  </div>
                  <div>
                    Avg Wins / Loss:{" "}
                    <span className="text-zinc-100">
                      {teamAdvStats.avgWins} / {teamAdvStats.avgLoss}
                    </span>
                  </div>
                  <div>
                    Avg Points:{" "}
                    <span className="text-zinc-100">{teamAdvStats.avgPoints}</span> • PL/MS:{" "}
                    <span className="text-zinc-100">{teamAdvStats.avgPlms}</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-2">
                  Efficiency & Difficulty
                </h3>
                <div className="space-y-1">
                  <div>
                    Win% / PPG:{" "}
                    <span className="text-zinc-100">
                      {teamAdvStats.avgWinPct} / {teamAdvStats.avgPpg}
                    </span>
                  </div>
                  <div>
                    Eff / WAR:{" "}
                    <span className="text-zinc-100">
                      {teamAdvStats.avgEfficiency} / {teamAdvStats.avgWar}
                    </span>
                  </div>
                  <div>
                    H2H / Potato / SoS:{" "}
                    <span className="text-zinc-100">
                      {teamAdvStats.avgH2h} / {teamAdvStats.avgPotato} /{" "}
                      {teamAdvStats.avgSos}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ROSTER CARD (if provided) */}
          {roster && roster.length > 0 && (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-lg font-semibold text-zinc-100">
                  Team Roster{" "}
                  <span className="text-xs font-normal text-zinc-400">
                    ({roster.length} player{roster.length === 1 ? "" : "s"})
                  </span>
                </h3>
                <p className="text-xs text-zinc-500">
                  Click a name to open Discord DMs (if linked).
                </p>
              </div>

              <div className="space-y-2">
                {roster.map((p) => {
                  const factionIcon = factionIconSrc(p.faction);
                  const isCaptain = p.isCaptain === true;

                  const tooltip =
                    p.discordTag || (isCaptain ? "Team Captain" : "Open DM");

                  return (
                    <div
                      key={p.ncxid}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 border border-zinc-800 bg-zinc-950/60"
                    >
                      {/* Faction icon */}
                      {factionIcon ? (
                        <div className="relative h-10 w-10 shrink-0 flex items-center justify-center">
                          <span className="absolute inset-0 rounded-full bg-white/10 blur-sm" />
                          <Image
                            src={factionIcon}
                            alt={`${p.faction ?? "Faction"} icon`}
                            width={40}
                            height={40}
                            className="relative object-contain"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-xs text-zinc-500">
                          —
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <PlayerDMLink
                            name={p.name}
                            discordId={p.discordId}
                            titleSuffix={tooltip}
                            className="font-semibold text-cyan-200 hover:text-cyan-100"
                          />
                          {isCaptain && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/60 bg-yellow-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-yellow-100">
                              ★ Captain
                            </span>
                          )}
                        </div>

                        <div className="mt-1 text-xs text-zinc-400 flex flex-wrap gap-x-3 gap-y-1">
                          {p.faction && (
                            <span>
                              Faction: <span className="text-zinc-200">{p.faction}</span>
                            </span>
                          )}
                          {p.wins && p.losses && (
                            <span>
                              Record:{" "}
                              <span className="text-zinc-200">
                                {p.wins}-{p.losses}
                              </span>
                            </span>
                          )}
                          {p.points && (
                            <span>
                              Pts: <span className="text-zinc-200">{p.points}</span>
                            </span>
                          )}
                          {p.plms && (
                            <span>
                              PL/MS: <span className="text-zinc-200">{p.plms}</span>
                            </span>
                          )}
                          {p.efficiency && (
                            <span>
                              Eff: <span className="text-zinc-200">{p.efficiency}</span>
                            </span>
                          )}
                          {p.potato && (
                            <span>
                              Potato: <span className="text-zinc-200">{p.potato}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className="rounded-full bg-zinc-900/90 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200 font-mono">
                          {p.ncxid}
                        </span>
                      </div>
                    </div>
                  );
                })}

              </div>
            </section>
          )}

          {/* SCHEDULE TABLE */}
          <TeamTable rows={rows} teamName={teamName} mode={mode} />
        </>
      )}
    </div>
  );
}

/* ----------------------------- SCHEDULE TABLE ----------------------------- */

async function TeamTable({
  rows,
  teamName,
  mode,
}: {
  rows: TeamScheduleRow[];
  teamName: string;
  mode: PanelMode;
}) {
  const enriched = await Promise.all(rows.map(enrichRowWithScore));

  return (
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
          {enriched.map((r, i) => {
            const weekLabel = normalizeWeekLabel(r.week);

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
              <tr
                key={`${weekLabel}-${i}`}
                className={`border-t border-zinc-800 ${rowTone}`}
              >
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
                      src={`/logos/${teamSlug(r.away)}.webp`}
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
                      src={`/logos/${teamSlug(r.home)}.webp`}
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
  );
}
