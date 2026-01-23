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
    return <span className="text-[var(--ncx-text-muted)]">Scheduled</span>;
  }
  if (row.status === "IN PROGRESS") {
    return (
      <span className="font-semibold text-[rgb(var(--ncx-highlight-rgb))]">
        In Progress
      </span>
    );
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
      <div className="flex items-center justify-end gap-2 text-[rgb(var(--ncx-primary-rgb))] font-semibold">
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
      <div className="flex items-center justify-end gap-2 text-destructive font-semibold">
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
  return <span className="text-[var(--ncx-text-muted)]">Final</span>;
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
    <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] space-y-6">
      {!rows.length ? (
        <>
          <h2 className="text-2xl font-bold text-[var(--ncx-text-primary)]">
            Team Schedule
          </h2>
          <p className="mt-2 text-[var(--ncx-text-muted)]">
            Couldn’t find a schedule for “{team}”.
          </p>
        </>
      ) : (
        <>
          {/* Header */}
          <header className="flex items-center gap-3">
            <span className="shrink-0 rounded-md overflow-hidden bg-[rgb(var(--ncx-primary-rgb)/0.08)] border border-[var(--ncx-border)] w-[40px] h-[40px] flex items-center justify-center">
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
                <span className="text-[rgb(var(--ncx-primary-rgb))]">
                  {teamName}
                </span>{" "}
                <span className="text-[var(--ncx-text-primary)]">Team Hub</span>
              </h2>
              <p className="text-xs text-[var(--ncx-text-muted)]">
                Roster, factions, and series schedule for the {teamName}.
              </p>
            </div>
          </header>

          {/* Optional: team advanced stats summary */}
          {teamAdvStats && (
            <section className="rounded-2xl border border-[var(--ncx-border)] bg-[rgb(var(--ncx-primary-rgb)/0.06)] p-4 grid gap-3 md:grid-cols-2 text-xs text-[var(--ncx-text-primary)]">
              <div>
                <h3 className="text-sm font-semibold text-[var(--ncx-text-primary)] mb-2">
                  Team Performance Snapshot
                </h3>
                <div className="space-y-1 text-[var(--ncx-text-muted)]">
                  <div>
                    Games Played:{" "}
                    <span className="text-[var(--ncx-text-primary)]">
                      {teamAdvStats.totalGames}
                    </span>
                  </div>
                  <div>
                    Avg Wins / Loss:{" "}
                    <span className="text-[var(--ncx-text-primary)]">
                      {teamAdvStats.avgWins} / {teamAdvStats.avgLoss}
                    </span>
                  </div>
                  <div>
                    Avg Points:{" "}
                    <span className="text-[var(--ncx-text-primary)]">
                      {teamAdvStats.avgPoints}
                    </span>{" "}
                    • PL/MS:{" "}
                    <span className="text-[var(--ncx-text-primary)]">
                      {teamAdvStats.avgPlms}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--ncx-text-primary)] mb-2">
                  Efficiency & Difficulty
                </h3>
                <div className="space-y-1 text-[var(--ncx-text-muted)]">
                  <div>
                    Win% / PPG:{" "}
                    <span className="text-[var(--ncx-text-primary)]">
                      {teamAdvStats.avgWinPct} / {teamAdvStats.avgPpg}
                    </span>
                  </div>
                  <div>
                    Eff / WAR:{" "}
                    <span className="text-[var(--ncx-text-primary)]">
                      {teamAdvStats.avgEfficiency} / {teamAdvStats.avgWar}
                    </span>
                  </div>
                  <div>
                    H2H / Potato / SoS:{" "}
                    <span className="text-[var(--ncx-text-primary)]">
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
            <section className="rounded-2xl border border-[var(--ncx-border)] bg-[rgb(var(--ncx-primary-rgb)/0.06)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-lg font-semibold text-[var(--ncx-text-primary)]">
                  Team Roster{" "}
                  <span className="text-xs font-normal text-[var(--ncx-text-muted)]">
                    ({roster.length} player{roster.length === 1 ? "" : "s"})
                  </span>
                </h3>
                <p className="text-xs text-[var(--ncx-text-muted)]">
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
                      className="flex items-center gap-3 rounded-xl px-3 py-2 border border-[var(--ncx-border)] bg-[rgb(var(--ncx-primary-rgb)/0.04)]"
                    >
                      {/* Faction icon */}
                      {factionIcon ? (
                        <div className="relative h-10 w-10 shrink-0 flex items-center justify-center">
                          <span className="absolute inset-0 rounded-full bg-[rgb(var(--ncx-primary-rgb)/0.14)] blur-sm" />
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
                        <div className="h-10 w-10 shrink-0 rounded-full bg-[rgb(var(--ncx-primary-rgb)/0.06)] border border-[var(--ncx-border)] flex items-center justify-center text-xs text-[var(--ncx-text-muted)]">
                          —
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <PlayerDMLink
                            name={p.name}
                            discordId={p.discordId}
                            titleSuffix={tooltip}
                            className="font-semibold text-[rgb(var(--ncx-primary-rgb))] hover:opacity-90"
                          />
                          {isCaptain && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--ncx-highlight-rgb)/0.60)] bg-[rgb(var(--ncx-highlight-rgb)/0.12)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--ncx-highlight-rgb))]">
                              ★ Captain
                            </span>
                          )}
                        </div>

                        <div className="mt-1 text-xs text-[var(--ncx-text-muted)] flex flex-wrap gap-x-3 gap-y-1">
                          {p.faction && (
                            <span>
                              Faction:{" "}
                              <span className="text-[var(--ncx-text-primary)]">
                                {p.faction}
                              </span>
                            </span>
                          )}
                          {p.wins && p.losses && (
                            <span>
                              Record:{" "}
                              <span className="text-[var(--ncx-text-primary)]">
                                {p.wins}-{p.losses}
                              </span>
                            </span>
                          )}
                          {p.points && (
                            <span>
                              Pts:{" "}
                              <span className="text-[var(--ncx-text-primary)]">
                                {p.points}
                              </span>
                            </span>
                          )}
                          {p.plms && (
                            <span>
                              PL/MS:{" "}
                              <span className="text-[var(--ncx-text-primary)]">
                                {p.plms}
                              </span>
                            </span>
                          )}
                          {p.efficiency && (
                            <span>
                              Eff:{" "}
                              <span className="text-[var(--ncx-text-primary)]">
                                {p.efficiency}
                              </span>
                            </span>
                          )}
                          {p.potato && (
                            <span>
                              Potato:{" "}
                              <span className="text-[var(--ncx-text-primary)]">
                                {p.potato}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className="rounded-full bg-[rgb(var(--ncx-primary-rgb)/0.06)] border border-[var(--ncx-border)] px-2 py-0.5 text-[11px] text-[var(--ncx-text-primary)] font-mono">
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
      <table className="w-full text-left text-[var(--ncx-text-primary)]">
        <thead className="text-sm uppercase text-[var(--ncx-text-muted)]">
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

              if (viewingWon) {
                rowTone =
                  "bg-[rgb(var(--ncx-primary-rgb)/0.08)] border-[rgb(var(--ncx-primary-rgb)/0.25)]";
              } else if (viewingLost) {
                rowTone = "bg-destructive/10 border-destructive/25";
              }
            } else if (r.status === "IN PROGRESS") {
              rowTone =
                "bg-[rgb(var(--ncx-highlight-rgb)/0.08)] border-[rgb(var(--ncx-highlight-rgb)/0.25)]";
            }

            return (
              <tr
                key={`${weekLabel}-${i}`}
                className={`border-t border-[var(--ncx-border)] ${rowTone}`}
              >
                {/* Week → link to Current Week (desktop) or Mobile Current (mobile) */}
                <td className="py-2 px-2">
                  <Link
                    href={weekHref}
                    prefetch={false}
                    className="text-[rgb(var(--ncx-primary-rgb))] hover:opacity-90 underline-offset-2 hover:underline"
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

      <div className="mt-6 text-sm text-[var(--ncx-text-muted)]">
        Click any{" "}
        <span className="text-[rgb(var(--ncx-primary-rgb))]">Week</span> to jump
        to the{" "}
        <span className="text-[rgb(var(--ncx-primary-rgb))]">
          {mode === "mobile" ? "Mobile Current Week" : "Current Week"}
        </span>{" "}
        view with that week selected.
      </div>
    </div>
  );
}
