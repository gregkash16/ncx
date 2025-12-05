// src/lib/googleSheets.ts
// Transitional layer: Same function names as before, but everything now reads
// directly from MySQL. No caching. No Google Sheets except for legacy use.

import { google, sheets_v4 } from "googleapis";
import { pool } from "@/lib/db";
import { getMysqlPool } from "@/lib/mysql";

/* ===========================================================================
   Legacy Google Sheets Auth (kept only so older code doesn’t break)
   =========================================================================== */

export function getSheets(): sheets_v4.Sheets {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!email || !key) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_KEY");
  }
  key = key.replace(/\\n/g, "\n");

  const jwt = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth: jwt });
}

/* ===========================================================================
   Utility helpers
   =========================================================================== */

const norm = (v: unknown) => String(v ?? "").trim();

async function dbQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

function normalizeWeekLabel(label: string): string {
  const s = String(label ?? "").trim();
  if (!s) return "WEEK 1";
  const m1 = s.match(/week\s*(\d+)/i);
  if (m1) return `WEEK ${parseInt(m1[1], 10)}`;
  const n = parseInt(s, 10);
  if (Number.isFinite(n) && n > 0) return `WEEK ${n}`;
  return s.toUpperCase();
}

async function getCurrentWeekFromDB(): Promise<string> {
  const rows = await dbQuery<{ week_label: string }>(
    "SELECT week_label FROM current_week LIMIT 1"
  );
  return rows[0]?.week_label || "WEEK 1";
}

/* ===========================================================================
   WEEKLY MATCHUPS
   =========================================================================== */

export type MatchRow = {
  game: string;
  awayId: string;
  awayName: string;
  awayTeam: string;
  awayW: string;
  awayL: string;
  awayPts: string;
  awayPLMS: string;
  homeId: string;
  homeName: string;
  homeTeam: string;
  homeW: string;
  homeL: string;
  homePts: string;
  homePLMS: string;
  scenario: string;
  seriesNo: number;
};

export type MatchupsData = { weekTab: string; matches: MatchRow[] };

function mapDbRowToMatchRow(r: any): MatchRow {
  const game = norm(r.game);
  const n = Number(game);
  const seriesNo = Number.isFinite(n) && n > 0 ? Math.ceil(n / 7) : 0;

  return {
    game,
    awayId: norm(r.awayId),
    awayName: norm(r.awayName),
    awayTeam: norm(r.awayTeam),
    awayW: norm(r.awayW),
    awayL: norm(r.awayL),
    awayPts: norm(r.awayPts),
    awayPLMS: norm(r.awayPLMS),
    homeId: norm(r.homeId),
    homeName: norm(r.homeName),
    homeTeam: norm(r.homeTeam),
    homeW: norm(r.homeW),
    homeL: norm(r.homeL),
    homePts: norm(r.homePts),
    homePLMS: norm(r.homePLMS),
    scenario: norm(r.scenario),
    seriesNo,
  };
}

export async function fetchMatchupsData(): Promise<MatchupsData> {
  return fetchMatchupsDataCached();
}

export async function fetchMatchupsDataCached(weekOverride?: string): Promise<MatchupsData> {
  const activeWeek = await getCurrentWeekFromDB();
  const targetWeek = (weekOverride && weekOverride.trim()) || activeWeek;

  const rows = await dbQuery<any>(
    `
    SELECT *
    FROM weekly_matchups
    WHERE week_label = ?
    ORDER BY CAST(game AS UNSIGNED)
    `,
    [targetWeek]
  );

  return {
    weekTab: targetWeek,
    matches: rows.map(mapDbRowToMatchRow),
  };
}

/* ===========================================================================
   INDIVIDUAL STATS
   =========================================================================== */

export type IndRow = {
  rank: string;
  ncxid: string;
  first: string;
  last: string;
  discord: string;
  pick: string;
  team: string;
  faction: string;
  wins: string;
  losses: string;
  points: string;
  plms: string;
  games: string;
  winPct: string;
  ppg: string;
  efficiency: string;
  war: string;
  h2h: string;
  potato: string;
  sos: string;
  predWins: string;
  predLosses: string;
};

export async function fetchIndStatsData(): Promise<IndRow[]> {
  const rows = await dbQuery<any>(`
    SELECT
      \`rank\`,
      ncxid,
      first_name,
      last_name,
      discord,
      pick_no,
      team,
      faction,
      wins,
      losses,
      points,
      plms,
      games,
      winper,
      ppg,
      efficiency,
      war,
      h2h,
      potato,
      sos
    FROM individual_stats
    ORDER BY \`rank\` ASC
  `);

  return rows.map((r: any): IndRow => ({
    rank: norm(r.rank),
    ncxid: norm(r.ncxid),
    first: norm(r.first_name),
    last: norm(r.last_name),
    discord: norm(r.discord),
    pick: norm(r.pick_no),
    team: norm(r.team),
    faction: norm(r.faction),
    wins: norm(r.wins),
    losses: norm(r.losses),
    points: norm(r.points),
    plms: norm(r.plms),
    games: norm(r.games),
    winPct: norm(r.winper),
    ppg: norm(r.ppg),
    efficiency: norm(r.efficiency),
    war: norm(r.war),
    h2h: norm(r.h2h),
    potato: norm(r.potato),
    sos: norm(r.sos),
    predWins: "",
    predLosses: "",
  }));
}

export async function fetchIndStatsDataCached() {
  return fetchIndStatsData();
}

/* ===========================================================================
   STREAM SCHEDULE
   =========================================================================== */

export type StreamSchedule = {
  scheduleWeek: string;
  scheduleMap: Record<string, { day: string; slot: string }>;
};

export async function fetchStreamSchedule(): Promise<StreamSchedule> {
  const rows = await dbQuery<any>(`
    SELECT schedule_week, game, day, slot
    FROM stream_schedule
    ORDER BY CAST(game AS UNSIGNED)
  `);

  const scheduleWeek = rows[0]?.schedule_week
    ? normalizeWeekLabel(rows[0].schedule_week)
    : "SCHEDULE";

  const map: StreamSchedule["scheduleMap"] = {};

  for (const r of rows) {
    const game = norm(r.game);
    if (!game) continue;
    map[game] = {
      day: norm(r.day).toUpperCase(),
      slot: norm(r.slot).toUpperCase(),
    };
  }

  return { scheduleWeek, scheduleMap: map };
}

export async function fetchStreamScheduleCached() {
  return fetchStreamSchedule();
}

/* ===========================================================================
   DISCORD MAP
   =========================================================================== */

export async function getDiscordMapCached(): Promise<
  Record<string, { ncxid: string; first: string; last: string }>
> {
  const rows = await dbQuery<any>(`
    SELECT discord_id, ncxid, first_name, last_name
    FROM discord_map
  `);

  const result: Record<
    string,
    { ncxid: string; first: string; last: string }
  > = {};

  for (const r of rows) {
    const id = norm(r.discord_id);
    if (!id) continue;
    result[id] = {
      ncxid: norm(r.ncxid),
      first: norm(r.first_name),
      last: norm(r.last_name),
    };
  }

  return result;
}

/* ===========================================================================
   FACTION MAP
   =========================================================================== */

export type FactionMap = Record<string, string>;

export async function fetchFactionMapCached(): Promise<FactionMap> {
  const rows = await dbQuery<any>(`
    SELECT ncxid, faction_h, faction_i
    FROM ncxid
  `);

  const map: FactionMap = {};

  for (const r of rows) {
    const id = norm(r.ncxid);
    if (!id) continue;

    const fh = norm(r.faction_h);
    const fi = norm(r.faction_i);
    const chosen = fi || fh;

    if (chosen) map[id] = chosen.toUpperCase();
  }

  return map;
}

/* ===========================================================================
   ADVANCED STATS (t1–t5)
   =========================================================================== */

export async function fetchAdvStatsCached() {
  const t1Rows = await dbQuery<any>(`
    SELECT * FROM adv_stats_t1
  `);

  const t2Rows = await dbQuery<any>(`
    SELECT * FROM adv_stats_t2
  `);

  const t3Rows = await dbQuery<any>(`
    SELECT * FROM adv_stats_t3
  `);

  const t4Rows = await dbQuery<any>(`
    SELECT * FROM adv_stats_t4
  `);

  const t5Rows = await dbQuery<any>(`
    SELECT * FROM adv_stats_t5
  `);

  return {
    t1: t1Rows.map((r) => Object.values(r).map(norm)),
    t2: t2Rows.map((r) => Object.values(r).map(norm)),
    t3: t3Rows.map((r) => Object.values(r).map(norm)),
    t4: t4Rows.map((r) => Object.values(r).map(norm)),
    t5: t5Rows.map((r) => Object.values(r).map(norm)),
  };
}

/* ===========================================================================
   ALL-TIME PLAYER STATS
   =========================================================================== */

export async function fetchAllTimeStatsCached() {
  const rows = await dbQuery<any>(`
    SELECT *
    FROM all_time_stats
  `);

  return rows.map((r) => Object.values(r).map(norm));
}

/* ===========================================================================
   TEAM SCHEDULE
   =========================================================================== */

export type TeamScheduleRow = {
  week: string;
  away: string;
  home: string;
};

export async function fetchTeamScheduleAll(): Promise<TeamScheduleRow[]> {
  const rows = await dbQuery<any>(`
    SELECT week_label, away_team, home_team
    FROM team_schedule
  `);

  return rows
    .map((r) => ({
      week: normalizeWeekLabel(norm(r.week_label)),
      away: norm(r.away_team),
      home: norm(r.home_team),
    }))
    .filter((r) => r.week !== "" && (r.away !== "" || r.home !== ""));
}

export async function fetchTeamScheduleAllCached() {
  return fetchTeamScheduleAll();
}

export async function fetchScheduleForTeam(teamKey: string) {
  const all = await fetchTeamScheduleAll();
  const key = teamKey.trim();

  const toSlug = (s: string) =>
    s
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

  const candidate = all.find(
    (r) =>
      r.away.toLowerCase() === key.toLowerCase() ||
      r.home.toLowerCase() === key.toLowerCase() ||
      toSlug(r.away) === key ||
      toSlug(r.home) === key
  );

  if (!candidate) return { teamName: key, rows: [] };

  const canonical =
    candidate.away.toLowerCase() === key.toLowerCase() ||
    toSlug(candidate.away) === key
      ? candidate.away
      : candidate.home;

  const rows = all
    .filter((r) => r.away === canonical || r.home === canonical)
    .sort((a, b) => {
      const aw = parseInt(a.week.replace(/[^0-9]/g, ""), 10) || 0;
      const bw = parseInt(b.week.replace(/[^0-9]/g, ""), 10) || 0;
      return aw - bw;
    });

  return { teamName: canonical, rows };
}

/* ===========================================================================
   OVERALL STANDINGS
   =========================================================================== */

export type OverallRow = {
  rank: number;
  team: string;
  wins: number;
  losses: number;
  gameWins: number;
  points: number;
};

export async function fetchOverallStandingsCached(): Promise<OverallRow[]> {
  const pool = getMysqlPool();

  const result = await pool.query<any[]>(
    `
    SELECT 
      rank,
      team,
      wins,
      losses,
      gameWins,
      points
    FROM S8_overall_standings
    ORDER BY rank ASC
    `
  );

  const rows = Array.isArray(result[0]) ? result[0] : [];

  return rows.map((r) => ({
    rank: Number(r.rank),
    team: String(r.team),
    wins: Number(r.wins),
    losses: Number(r.losses),
    gameWins: Number(r.gameWins),
    points: Number(r.points),
  }));
}

/* ===========================================================================
   LISTS (YASB Links)
   =========================================================================== */

export type ListRow = {
  week: string;
  game: string;
  awayList: string;
  homeList: string;
};

export type ListsMapForWeek = Record<
  string,
  { awayList?: string; homeList?: string }
>;

export async function fetchListsForWeek(weekOverride?: string) {
  const activeWeek = await getCurrentWeekFromDB();
  const targetWeek = normalizeWeekLabel(
    (weekOverride && weekOverride.trim()) || activeWeek
  );

  const rows = await dbQuery<any>(
    `
    SELECT week_label, game, away_list, home_list
    FROM lists
    WHERE week_label = ?
    `,
    [targetWeek]
  );

  const map: ListsMapForWeek = {};

  for (const r of rows) {
    const game = norm(r.game);
    if (!game) continue;

    const awayList = norm(r.away_list);
    const homeList = norm(r.home_list);

    map[game] = {
      awayList: awayList || undefined,
      homeList: homeList || undefined,
    };
  }

  return { weekTab: targetWeek, listsMap: map };
}

export async function fetchListsForWeekCached(weekOverride?: string) {
  return fetchListsForWeek(weekOverride);
}
