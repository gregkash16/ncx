// src/app/m/team/[team]/page.tsx
import Link from "next/link";
import Image from "next/image";
import {
  fetchScheduleForTeam,
  TeamScheduleRow,
  getSheets,
  fetchIndStatsDataCached,
  fetchFactionMapCached,
  getDiscordMapCached,
  fetchAdvStatsCached,
  type IndRow,
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

/** Roster / per-player info for mobile view */
type TeamRosterPlayer = {
  ncxid: string;
  name: string;
  faction?: string | null;
  discordId?: string | null;
  discordTag?: string | null;

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

/** Team advanced stats (AdvStats Table1 row) */
type TeamAdvStats = {
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
 * Same idea as desktop: derive series W/L from the week sheet grid.
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

function StatusCell({
  row,
  teamName,
}: {
  row: EnrichedRow;
  teamName: string;
}) {
  if (row.status === "SCHEDULED") {
    return <span className="text-neutral-500 text-xs">Scheduled</span>;
  }
  if (row.status === "IN PROGRESS") {
    return (
      <span className="text-xs font-semibold text-yellow-300">
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
      <div className="flex items-center justify-end gap-1 text-[11px] text-green-400 font-semibold">
        <span>Winner</span>
        <Image
          src={`/logos/${teamSlug(teamName)}.png`}
          alt={`${teamName} logo`}
          width={20}
          height={20}
          className="object-contain rounded"
          unoptimized
        />
      </div>
    );
  }
  if (viewingLost) {
    return (
      <div className="flex items-center justify-end gap-1 text-[11px] text-red-400 font-semibold">
        <span>Loser</span>
        <Image
          src={`/logos/${teamSlug(teamName)}.png`}
          alt={`${teamName} logo`}
          width={20}
          height={20}
          className="object-contain rounded"
          unoptimized
        />
      </div>
    );
  }
  return <span className="text-xs text-neutral-400">Final</span>;
}

/* ---- faction icon helpers (match desktop Team Hub look) ---- */
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

/* ---------- helpers to build roster / adv stats from Sheets ---------- */

function resolveTeamNameFromParam(
  teamParam: string | undefined,
  indStats: IndRow[] | null | undefined
): string | undefined {
  if (!teamParam || !indStats || indStats.length === 0) return undefined;

  const target = teamParam.toLowerCase();
  const teams = Array.from(
    new Set(indStats.map((r) => String(r.team ?? "").trim()).filter(Boolean))
  );

  for (const name of teams) {
    if (teamSlug(name).toLowerCase() === target) {
      return name;
    }
  }
  return undefined;
}

function buildTeamRoster(
  teamName: string | undefined,
  indStats: IndRow[] | null | undefined,
  ncxToDiscord: Record<string, string>
): TeamRosterPlayer[] | undefined {
  if (!teamName || !indStats || indStats.length === 0) return undefined;

  const rowsForTeam = indStats.filter(
    (r) => String(r.team ?? "").trim() === teamName
  );
  if (rowsForTeam.length === 0) return undefined;

  return rowsForTeam.map((row) => {
    const ncxid = String(row.ncxid ?? "").trim();
    const first = String(row.first ?? "").trim();
    const last = String(row.last ?? "").trim();
    const nameFromStats = `${first} ${last}`.trim();

    const pickedName =
      nameFromStats || (ncxid ? `NCX ${ncxid}` : "Unknown Pilot");

    const discordId = ncxid ? ncxToDiscord[ncxid] ?? null : null;
    const faction = String(row.faction ?? "").trim() || null;

    const p: TeamRosterPlayer = {
      ncxid,
      name: pickedName,
      faction,
      discordId,
      discordTag: null,
      wins: row.wins != null ? String(row.wins) : undefined,
      losses: row.losses != null ? String(row.losses) : undefined,
      points: row.points != null ? String(row.points) : undefined,
      plms: row.plms != null ? String(row.plms) : undefined,
      games: row.games != null ? String(row.games) : undefined,
      winPct: row.winPct != null ? String(row.winPct) : undefined,
      ppg: row.ppg != null ? String(row.ppg) : undefined,
      efficiency: row.efficiency != null ? String(row.efficiency) : undefined,
      war: row.war != null ? String(row.war) : undefined,
      h2h: row.h2h != null ? String(row.h2h) : undefined,
      potato: row.potato != null ? String(row.potato) : undefined,
      sos: row.sos != null ? String(row.sos) : undefined,
    };

    return p;
  });
}

function mapAdvTable1Row(raw: any[]): TeamAdvStats {
  const s = (v: unknown) => (v ?? "").toString().trim();
  return {
    team: s(raw[0]),
    totalGames: s(raw[1]),
    avgWins: s(raw[2]),
    avgLoss: s(raw[3]),
    avgPoints: s(raw[4]),
    avgPlms: s(raw[5]),
    avgGames: s(raw[6]),
    avgWinPct: s(raw[7]),
    avgPpg: s(raw[8]),
    avgEfficiency: s(raw[9]),
    avgWar: s(raw[10]),
    avgH2h: s(raw[11]),
    avgPotato: s(raw[12]),
    avgSos: s(raw[13]),
  };
}

/* ----------------------------- PAGE ----------------------------- */

export default async function MobileTeamSchedulePage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team } = await params;

  const [{ teamName, rows }, indStats, advStatsRaw, discordMap] =
    await Promise.all([
      fetchScheduleForTeam(team),
      fetchIndStatsDataCached(),
      fetchAdvStatsCached(),
      getDiscordMapCached(),
    ]);

  // Map ncx → discord
  const ncxToDiscord: Record<string, string> = {};
  for (const [discordId, payload] of Object.entries(discordMap ?? {})) {
    const ncxid = (payload as any)?.ncxid?.trim?.() ?? "";
    if (ncxid && /^\d{5,}$/.test(discordId)) {
      ncxToDiscord[ncxid] = discordId;
    }
  }

  const teamNameFromStats = resolveTeamNameFromParam(team, indStats ?? []);
  const canonicalTeamName = teamNameFromStats || teamName;

  const roster = buildTeamRoster(
    canonicalTeamName,
    indStats ?? [],
    ncxToDiscord
  );

  // Adv stats row for this team (Table1)
  let teamAdvStats: TeamAdvStats | undefined;
  if (canonicalTeamName && advStatsRaw?.t1) {
    const t1 = advStatsRaw.t1 as any[];
    const rawRow = t1.find(
      (r) => (r?.[0] ?? "").toString().trim() === canonicalTeamName
    );
    if (rawRow) teamAdvStats = mapAdvTable1Row(rawRow as any[]);
  }

  if (!rows.length) {
    return (
      <div className="p-3">
        <h2 className="text-lg font-bold text-neutral-100">
          Team Schedule
        </h2>
        <p className="mt-2 text-sm text-neutral-400">
          Couldn&apos;t find a schedule for “{team}”.
        </p>
      </div>
    );
  }

  // Enrich rows and compute simple series summary for header
  const enriched = await Promise.all(rows.map(enrichRowWithScore));

  let seriesWins = 0;
  let seriesLosses = 0;
  let seriesInProgress = 0;
  let totalMapsWon = 0;
  let totalMapsLost = 0;

  for (const r of enriched) {
    const viewingIsAway = r.away === canonicalTeamName;
    const viewingIsHome = r.home === canonicalTeamName;
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
    <div className="p-3 space-y-4">
      {/* Header / hero */}
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-neutral-700 bg-neutral-900">
          {/* No glow on logo, matches desktop */}
          <Image
            src={`/logos/${teamSlug(canonicalTeamName)}.png`}
            alt={`${canonicalTeamName} logo`}
            width={36}
            height={36}
            className="object-contain"
            unoptimized
          />
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-extrabold tracking-wide">
            <span className="text-cyan-400">{canonicalTeamName}</span>{" "}
            <span className="text-neutral-200">Team Hub</span>
          </h2>
          <p className="text-[11px] text-neutral-500">
            Roster, advanced metrics, and schedule for this team.
          </p>
        </div>
      </header>

      {/* Small stat cards */}
      <div className="grid grid-cols-1 gap-3">
        {/* Series record card */}
        <div className="rounded-xl bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-xs">
          <div className="uppercase text-neutral-400 mb-0.5">
            Series Record
          </div>
          <div className="font-mono text-base text-neutral-100">
            {seriesWins}-{seriesLosses}
            {totalSeries ? (
              <span className="text-neutral-400 text-[10px] ml-1.5">
                ({totalSeries} series, {seriesInProgress} in progress)
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 text-[11px] text-neutral-400">
            Games:{" "}
            <span className="font-mono text-neutral-100">
              {totalMapsWon}-{totalMapsLost}
            </span>
          </div>
        </div>

        {/* Team advanced stats card */}
        {teamAdvStats && (
          <div className="rounded-xl bg-neutral-900/80 border border-cyan-500/40 px-3 py-2 text-xs text-neutral-200">
            <div className="uppercase text-cyan-300 mb-1">
              Team Advanced Averages
            </div>
            <div className="grid grid-cols-2 gap-y-1">
              <div>
                Win%:{" "}
                <span className="font-mono text-neutral-100">
                  {teamAdvStats.avgWinPct || "—"}
                </span>
              </div>
              <div>
                PPG:{" "}
                <span className="font-mono text-neutral-100">
                  {teamAdvStats.avgPpg || "—"}
                </span>
              </div>
              <div>
                Eff:{" "}
                <span className="font-mono text-neutral-100">
                  {teamAdvStats.avgEfficiency || "—"}
                </span>
              </div>
              <div>
                PL/MS:{" "}
                <span className="font-mono text-neutral-100">
                  {teamAdvStats.avgPlms || "—"}
                </span>
              </div>
              <div>
                Potato:{" "}
                <span className="font-mono text-neutral-100">
                  {teamAdvStats.avgPotato || "—"}
                </span>
              </div>
              <div>
                SOS:{" "}
                <span className="font-mono text-neutral-100">
                  {teamAdvStats.avgSos || "—"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Roster */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-3">
        <h3 className="text-sm font-semibold text-cyan-300 mb-2">
          Roster / Players
        </h3>
        {!roster || roster.length === 0 ? (
          <p className="text-xs text-neutral-400">
            Roster data isn&apos;t wired up yet for this team.
          </p>
        ) : (
          <ul className="space-y-2">
            {roster.map((p) => {
              const icon = factionIconSrc(p.faction);
              const tooltip = p.discordTag
                ? `@${p.discordTag}`
                : "Open DM";

              const record =
                p.wins || p.losses
                  ? `${p.wins ?? "0"}-${p.losses ?? "0"}`
                  : "—";

              return (
                <li
                  key={p.ncxid}
                  className="flex items-start gap-2 rounded-xl bg-neutral-950/80 border border-neutral-800 px-2.5 py-2"
                >
                  {/* Faction icon with subtle glow */}
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
                    {/* Name + NCX pill */}
                    <div className="flex items-center gap-2">
                      <PlayerDMLink
                        name={p.name}
                        discordId={p.discordId}
                        titleSuffix={tooltip}
                        className="text-[13px] font-semibold text-cyan-200 hover:text-cyan-100"
                      />
                      <span className="rounded-full bg-neutral-800/80 border border-neutral-700 px-2 py-px text-[10px] text-neutral-200 font-mono whitespace-nowrap">
                        {p.ncxid}
                      </span>
                    </div>

                    {/* Stats rows */}
                    <div className="mt-0.5 text-[11px] text-neutral-400 space-y-0.5">
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {p.faction && (
                          <span className="uppercase tracking-wide">
                            {p.faction}
                          </span>
                        )}
                        <span>
                          Record:{" "}
                          <span className="font-mono text-neutral-100">
                            {record}
                          </span>
                        </span>
                        {p.points && (
                          <span>
                            Pts:{" "}
                            <span className="font-mono text-neutral-100">
                              {p.points}
                            </span>
                          </span>
                        )}
                        {p.plms && (
                          <span>
                            PL/MS:{" "}
                            <span className="font-mono text-neutral-100">
                              {p.plms}
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {p.efficiency && (
                          <span>
                            Eff:{" "}
                            <span className="font-mono text-neutral-100">
                              {p.efficiency}
                            </span>
                          </span>
                        )}
                        {p.potato && (
                          <span>
                            Potato:{" "}
                            <span className="font-mono text-neutral-100">
                              {p.potato}
                            </span>
                          </span>
                        )}
                        {p.sos && (
                          <span>
                            SOS:{" "}
                            <span className="font-mono text-neutral-100">
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
        )}
      </section>

            {/* Schedule table */}
      <section>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 overflow-hidden">
          <div className="px-3 pt-2 pb-1 text-[11px] text-neutral-500">
            Tap a week to jump to that week on the Current tab.
          </div>

          <table className="w-full table-fixed text-left text-[13px] text-neutral-200">
            {/* Control column widths so Week fits neatly */}
            <colgroup><col className="w-16" /><col /><col /><col className="w-24" /></colgroup>


            <thead className="text-[11px] uppercase text-neutral-400 bg-neutral-900/80">
              <tr>
                <th className="px-2 py-1.5 text-center">Wk</th>
                <th className="px-2 py-1.5">Away</th>
                <th className="px-2 py-1.5">Home</th>
                <th className="px-2 py-1.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {enriched.map((r, i) => {
                const weekLabel = normalizeWeekLabel(r.week);
                const weekHref = `/m/current?w=${encodeURIComponent(weekLabel)}`;

                let rowTone = "";
                if (r.status === "FINAL") {
                  const viewingIsAway = r.away === canonicalTeamName;
                  const viewingIsHome = r.home === canonicalTeamName;
                  const viewingWon =
                    (viewingIsAway && r.awayWins > r.homeWins) ||
                    (viewingIsHome && r.homeWins > r.awayWins);
                  const viewingLost =
                    (viewingIsAway && r.awayWins < r.homeWins) ||
                    (viewingIsHome && r.homeWins < r.awayWins);

                  if (viewingWon)
                    rowTone = "bg-green-900/20 border-green-700/50";
                  else if (viewingLost)
                    rowTone = "bg-red-900/20 border-red-700/50";
                } else if (r.status === "IN PROGRESS") {
                  rowTone = "bg-yellow-900/15 border-yellow-700/40";
                }

                return (
                  <tr
                    key={`${weekLabel}-${i}`}
                    className={`border-t border-neutral-800 ${rowTone}`}
                  >
                    {/* WEEK – narrow, centered, fits inside box */}
                    <td className="py-1.5 px-2 align-top text-center whitespace-nowrap">
                      <Link
                        href={weekHref}
                        prefetch={false}
                        className="text-xs text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
                      >
                        {weekLabel.replace("WEEK ", "")}
                      </Link>
                    </td>

                    {/* AWAY */}
                    <td className="py-1.5 px-2 align-top">
                      <div className="flex items-center gap-1 min-w-0">
                        <Image
                          src={`/logos/${teamSlug(r.away)}.png`}
                          alt={`${r.away} logo`}
                          width={20}
                          height={20}
                          className="object-contain rounded"
                          unoptimized
                        />
                        <span className="truncate text-xs">{r.away}</span>
                      </div>
                    </td>

                    {/* HOME */}
                    <td className="py-1.5 px-2 align-top">
                      <div className="flex items-center gap-1 min-w-0">
                        <Image
                          src={`/logos/${teamSlug(r.home)}.png`}
                          alt={`${r.home} logo`}
                          width={20}
                          height={20}
                          className="object-contain rounded"
                          unoptimized
                        />
                        <span className="truncate text-xs">{r.home}</span>
                      </div>
                    </td>

                    {/* STATUS */}
                    <td className="py-1.5 px-2 text-right align-top">
                      <StatusCell row={r} teamName={canonicalTeamName} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>


    </div>
  );
}
