// app/api/seed-mysql/route.ts
import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { google } from "googleapis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =============== CONFIG ===============

const NCX_LEAGUE_SHEET_ID =
  process.env.NCX_LEAGUE_SHEET_ID ?? "19sTVWOsDcq9b2rBh2Duj0LFwIkWY4P7_fA6tTg2bkeA";
const NCX_STATS_SHEET_ID =
  process.env.NCX_STATS_SHEET_ID ?? "1Lg7rEXmizuQHlFQqtREKclSrbIdWnKa8KIfdsLy0FLs";
const STREAM_SCHEDULE_SHEET_ID =
  process.env.STREAM_SCHEDULE_SHEET_ID ??
  "17sgzFPYAfVdWirop6Rf_8tNgFqqHqv3BXDJWc8dUYzQ";

const WEEK_TABS = Array.from({ length: 10 }, (_, i) => `WEEK ${i + 1}`);

// =============== HELPERS ===============

function norm(v: any): string {
  return v != null ? String(v).trim() : "";
}

function toDecimalOrNone(s: string | null | undefined): number | null {
  let raw = (s ?? "").trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (["#DIV/0!", "#VALUE!", "N/A", "NA"].includes(upper)) return null;

  if (raw.endsWith("%")) raw = raw.slice(0, -1).trim();
  const val = Number(raw);
  return Number.isFinite(val) ? val : null;
}

function toIntOrNone(s: string | null | undefined): number | null {
  const raw = (s ?? "").trim();
  if (!raw) return null;
  const val = Number(raw);
  return Number.isInteger(val) ? val : null;
}

function toIntOrZero(v: any): number {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function parseWinCell(v: any): number {
  const s = String(v ?? "").trim().toUpperCase();
  if (["WIN", "W", "1"].includes(s)) return 1;
  if (["LOSS", "L", "", "-", "0"].includes(s)) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? (n > 0 ? 1 : 0) : 0;
}

function parseLossCell(v: any): number {
  const s = String(v ?? "").trim().toUpperCase();
  if (["LOSS", "L", "1"].includes(s)) return 1;
  if (["WIN", "W", "", "-", "0"].includes(s)) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? (n > 0 ? 1 : 0) : 0;
}

function normalizeWeekLabel(label: string): string {
  const s = (label ?? "").trim();
  if (!s) return "WEEK 1";

  const m1 = s.match(/week\s*(\d+)/i);
  if (m1) return `WEEK ${parseInt(m1[1], 10)}`;

  const num = Number(s);
  if (Number.isInteger(num) && num > 0) {
    return `WEEK ${num}`;
  }
  return s.toUpperCase();
}

// ===== XWS + glyph helpers for lists =====

const SHIP_ICON_MAP: Record<string, string> = {
  aggressorassaultfighter: "i",
  alphaclassstarwing: "&",
  arc170starfighter: "c",
  asf01bwing: "b",
  attackshuttle: "g",
  auzituckgunship: "@",
  belbullab22starfighter: "[",
  btanr2ywing: "{",
  btanr2wywing: "{",
  btla4ywing: "y",
  btlbywing: ":",
  btls8kwing: "k",
  clonez95headhunter: "¡",
  cr90corvette: "2",
  croccruiser: "5",
  customizedyt1300lightfreighter: "W",
  droidtrifighter: "+",
  delta7aethersprite: "\\",
  delta7baethersprite: "\\",
  escapecraft: "X",
  eta2actis: "-",
  ewing: "e",
  fangfighter: "M",
  fireball: "0",
  firesprayclasspatrolcraft: "f",
  g1astarfighter: "n",
  gauntletfighter: "|",
  gozanticlasscruiser: "4",
  gr75mediumtransport: "1",
  hmpdroidgunship: ".",
  hwk290lightfreighter: "h",
  hyenaclassdroidbomber: "=",
  jumpmaster5000: "p",
  kihraxzfighter: "r",
  laatigunship: "/",
  lambdaclasst4ashuttle: "l",
  lancerclasspursuitcraft: "L",
  m12lkimogilafighter: "K",
  m3ainterceptor: "s",
  mg100starfortress: "Z",
  modifiedtielnfighter: "C",
  modifiedyt1300lightfreighter: "m",
  nabooroyaln1starfighter: "<",
  nantexclassstarfighter: ";",
  nimbusclassvwing: ",",
  quadrijettransferspacetug: "q",
  raiderclasscorvette: "3",
  resistancetransport: ">",
  resistancetransportpod: "?",
  rogueclassstarfighter: "~",
  rz1awing: "a",
  rz2awing: "E",
  scavengedyt1300: "Y",
  scurrgh6bomber: "H",
  sheathipedeclassshuttle: "%",
  sithinfiltrator: "]",
  st70assaultship: "}",
  starviperclassattackplatform: "v",
  syliureclasshyperspacering: "*",
  t65xwing: "x",
  t70xwing: "w",
  tieadvancedv1: "R",
  tieadvancedx1: "A",
  tieagaggressor: "`",
  tiebainterceptor: "j",
  tiecapunisher: "N",
  tieddefender: "D",
  tiefofighter: "O",
  tieininterceptor: "I",
  tielnfighter: "F",
  tiephphantom: "P",
  tierbheavy: "J",
  tiereaper: "V",
  tiesabomber: "B",
  tiesebomber: "!",
  tiesffighter: "S",
  tieskstriker: "T",
  tievnsilencer: "$",
  tiewiwhispermodifiedinterceptor: "#",
  tridentclassassaultship: "6",
  upsilonclasscommandshuttle: "U",
  ut60duwing: "u",
  v19torrentstarfighter: "^",
  vcx100lightfreighter: "G",
  vt49decimator: "d",
  vultureclassdroidfighter: "_",
  xiclasslightshuttle: "Q",
  yt2400lightfreighter: "o",
  yv666lightfreighter: "t",
  z95af4headhunter: "z",
};

type XwsPilot = { ship: string };
type XwsResponse = { pilots?: XwsPilot[] };

function shipsToGlyphs(pilots: XwsPilot[] = []): string {
  return pilots.map((p) => SHIP_ICON_MAP[p.ship] ?? "·").join("");
}

function buildPatternAnalyzerUrlFromList(listUrl: string): string | null {
  if (!listUrl.startsWith("https://yasb.app")) return null;
  const parts = listUrl.split("yasb.app/");
  if (parts.length < 2) return null;
  const dataLink = parts[1]; // "?f=...&d=..."
  return `https://www.pattern-analyzer.app/api/yasb/xws${dataLink}`;
}

function buildLaunchBayUrlFromList(listUrl: string): string | null {
  if (!listUrl.startsWith("https://launchbaynext.app")) return null;

  const idx = listUrl.indexOf("lbx=");
  if (idx === -1) return null;

  let value = listUrl.slice(idx + "lbx=".length);
  const ampIdx = value.indexOf("&");
  if (ampIdx !== -1) {
    value = value.slice(0, ampIdx);
  }

  return `https://launchbaynext.app/api/xws?lbx=${encodeURIComponent(value)}`;
}

async function fetchXwsFromListUrl(listUrl: string): Promise<XwsResponse | null> {
  let upstream: string | null = null;

  if (listUrl.startsWith("https://yasb.app")) {
    upstream = buildPatternAnalyzerUrlFromList(listUrl);
  } else if (listUrl.startsWith("https://launchbaynext.app")) {
    upstream = buildLaunchBayUrlFromList(listUrl);
  }

  if (!upstream) return null;

  try {
    const res = await fetch(upstream, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as XwsResponse;
    return data;
  } catch {
    return null;
  }
}

// =============== GOOGLE SHEETS CLIENT ===============

async function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!email || !keyRaw) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_KEY");
  }

  const key = keyRaw.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

async function getSheetValues(
  sheets: any,
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return (res.data.values ?? []) as string[][];
}

// =============== MYSQL CLIENT ===============

async function getMySqlConn() {
  const host = process.env.DB_HOST ?? "localhost";
  const port = Number(process.env.DB_PORT ?? "3306");
  const user = process.env.DB_USER ?? "root";
  const password = process.env.DB_PASSWORD ?? process.env.MYSQLPASSWORD;
  const database = process.env.DB_NAME ?? "S8";

  if (!password) {
    throw new Error("Missing DB_PASSWORD / MYSQLPASSWORD");
  }

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: false,
  });

  return conn;
}

// =============== LOADERS ===============

async function loadCurrentWeek(sheets: any, conn: mysql.Connection) {
  const rows = await getSheetValues(sheets, NCX_LEAGUE_SHEET_ID, "SCHEDULE!U2:U2");
  const value = rows[0]?.[0] ?? "WEEK 1";
  const weekLabel = normalizeWeekLabel(value);

  await conn.execute("DELETE FROM current_week");
  await conn.execute("INSERT INTO current_week (week_label) VALUES (?)", [weekLabel]);

  return { weekLabel };
}

async function loadWeeklyMatchups(sheets: any, conn: mysql.Connection) {
  await conn.execute("DELETE FROM weekly_matchups");

  const sql = `
    INSERT INTO weekly_matchups (
      week_label,
      game,
      awayId,
      awayName,
      awayTeam,
      awayW,
      awayL,
      awayPts,
      awayPLMS,
      homeId,
      homeName,
      homeTeam,
      homeW,
      homeL,
      homePts,
      homePLMS,
      scenario
    ) VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    )
  `;

  for (const week of WEEK_TABS) {
    let rows: string[][];
    try {
      rows = await getSheetValues(
        sheets,
        NCX_LEAGUE_SHEET_ID,
        `${week}!A2:Q120`
      );
    } catch (err) {
      console.warn(`Skipping ${week}: worksheet not found or error`, err);
      continue;
    }

    const weekLabel = normalizeWeekLabel(week);

    for (const r0 of rows) {
      const r = [...r0, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""].slice(
        0,
        17
      );

      const gameRaw = norm(r[0]);
      let gameNum: number;
      try {
        gameNum = parseInt(gameRaw, 10);
        if (!Number.isFinite(gameNum) || gameNum <= 0) continue;
      } catch {
        continue;
      }
      const game = String(gameNum);

      const awayId = norm(r[1]);
      const awayName = norm(r[2]);
      const awayTeam = norm(r[3]);
      const awayW = norm(r[4]);
      const awayL = norm(r[5]);
      const awayPts = norm(r[6]);
      const awayPLMS = norm(r[7]);
      const homeId = norm(r[9]);
      const homeName = norm(r[10]);
      const homeTeam = norm(r[11]);
      const homeW = norm(r[12]);
      const homeL = norm(r[13]);
      const homePts = norm(r[14]);
      const homePLMS = norm(r[15]);
      const scenario = norm(r[16]);

      if (!awayTeam && !homeTeam) continue;

      await conn.execute(sql, [
        weekLabel,
        game,
        awayId,
        awayName,
        awayTeam,
        parseWinCell(awayW),
        parseLossCell(awayL),
        toIntOrZero(awayPts),
        toIntOrZero(awayPLMS),
        homeId,
        homeName,
        homeTeam,
        parseWinCell(homeW),
        parseLossCell(homeL),
        toIntOrZero(homePts),
        toIntOrZero(homePLMS),
        scenario,
      ]);
    }
  }
}

async function loadIndividualStats(sheets: any, conn: mysql.Connection) {
  const rows = await getSheetValues(sheets, NCX_LEAGUE_SHEET_ID, "INDIVIDUAL!A2:V");

  await conn.execute("DELETE FROM individual_stats");

  const sql = `
  INSERT INTO individual_stats (
    \`rank\`, ncxid, first_name, last_name, discord,
    pick_no, team, faction, wins, losses, points,
    plms, games, winper, ppg, efficiency, war,
    h2h, potato, sos
  ) VALUES (
    ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
  )
`;


  for (const r0 of rows) {
    if (!r0 || r0.length === 0) continue;

    const r = [...r0, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""].slice(
      0,
      22
    );

    const rankStr = norm(r[0]);
    if (!rankStr) continue;
    const rank = parseInt(rankStr, 10);
    if (!Number.isFinite(rank)) continue;

    const ncxid = norm(r[1]);
    const first = norm(r[2]);
    const last = norm(r[3]);
    const discord = norm(r[4]);
    const pick = norm(r[5]);
    const team = norm(r[6]);
    const faction = norm(r[7]);
    const wins = toIntOrZero(r[8]);
    const losses = toIntOrZero(r[9]);
    const points = toIntOrZero(r[10]);
    const plms = toIntOrZero(r[11]);
    const games = toIntOrZero(r[12]);
    const winper = norm(r[13]) || null;
    const ppg = norm(r[14]) || null;
    const efficiency = toIntOrZero(r[15]);
    const war = norm(r[16]) || null;
    const h2h = norm(r[17]) || null;
    const potato = norm(r[18]) || null;
    const sos = norm(r[19]) || null;

    await conn.execute(sql, [
      rank,
      ncxid,
      first,
      last,
      discord,
      pick ? parseInt(pick, 10) : null,
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
      sos,
    ]);
  }
}

async function loadStreamSchedule(sheets: any, conn: mysql.Connection) {
  const m3 = await getSheetValues(sheets, STREAM_SCHEDULE_SHEET_ID, "Sheet1!M3:M3").catch(
    () => [[]]
  );
  const m3Val = m3[0]?.[0] ?? "";
  const scheduleWeek = m3Val.trim()
    ? normalizeWeekLabel(m3Val)
    : "SCHEDULE";

  const rows = await getSheetValues(
    sheets,
    STREAM_SCHEDULE_SHEET_ID,
    "Sheet1!A2:C8"
  );

  await conn.execute("DELETE FROM stream_schedule");

  const sql = `
    INSERT INTO stream_schedule (
      schedule_week, game, day, slot
    ) VALUES (?,?,?,?)
  `;

  for (const r0 of rows) {
    const r = [...r0, "", "", ""].slice(0, 3);
    const dateRaw = norm(r[0]);
    const gameType = norm(r[1]);
    const gameNumRaw = norm(r[2]);

    if (!gameNumRaw) continue;
    if (
      dateRaw.toUpperCase() === "NOT FOUND" &&
      gameType.toUpperCase() === "NOT FOUND"
    ) {
      continue;
    }

    const day = dateRaw.toUpperCase();
    const slot = gameType.toUpperCase();
    const game = gameNumRaw;

    await conn.execute(sql, [scheduleWeek, game, day, slot]);
  }
}

async function loadDiscordMap(sheets: any, conn: mysql.Connection) {
  const rows = await getSheetValues(sheets, NCX_LEAGUE_SHEET_ID, "Discord_ID!A:D");

  await conn.execute("DELETE FROM discord_map");

  const sql = `
    INSERT INTO discord_map (
      discord_id, ncxid, first_name, last_name, raw_discord
    ) VALUES (?,?,?,?,?)
  `;

  const seen = new Set<number>();

  for (const r0 of rows) {
    const r = [...r0, "", "", "", ""].slice(0, 4);
    const ncxid = norm(r[0]);
    const first = norm(r[1]);
    const last = norm(r[2]);
    const raw = norm(r[3]);

    const discIdStr = raw.replace(/[^\d]/g, "");
    if (!discIdStr) continue;

    const discId = Number(discIdStr);
    if (!Number.isFinite(discId)) continue;
    if (seen.has(discId)) continue;
    seen.add(discId);

    await conn.execute(sql, [discId, ncxid, first, last, raw]);
  }
}

async function loadNcxid(sheets: any, conn: mysql.Connection) {
  const rows = await getSheetValues(
    sheets,
    NCX_LEAGUE_SHEET_ID,
    "NCXID!A2:I215"
  );

  await conn.execute("DELETE FROM ncxid");

  const sql = `
    INSERT INTO ncxid (
      ncxid, faction_h, faction_i
    ) VALUES (?,?,?)
  `;

  for (const r0 of rows) {
    const r = [...r0, "", "", "", "", "", "", "", ""].slice(0, 9);
    const ncxidVal = norm(r[0]);
    if (!ncxidVal) continue;
    const factionH = norm(r[7]);
    const factionI = norm(r[8]);

    await conn.execute(sql, [ncxidVal, factionH, factionI]);
  }
}

async function loadAdvStats(sheets: any, conn: mysql.Connection) {
  // ADV STATS!A2:N25 -> adv_stats_t1
  await conn.execute("DELETE FROM adv_stats_t1");
  {
    const rows = await getSheetValues(
      sheets,
      NCX_LEAGUE_SHEET_ID,
      "ADV STATS!A2:N25"
    );
    const sql = `
      INSERT INTO adv_stats_t1 (
        team, total_games, avg_wins, avg_loss, avg_points,
        avg_plms, avg_games, avg_win_pct, avg_ppg,
        avg_efficiency, avg_war, avg_h2h, avg_potato, avg_sos
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;
    for (const r0 of rows) {
      const r = [...r0, "", "", "", "", "", "", "", "", "", "", "", "", ""].slice(0, 14);
      const team = norm(r[0]);
      if (!team) continue;
      await conn.execute(sql, r.map(norm));
    }
  }

  // ADV STATS!A28:I32 -> adv_stats_t2
  await conn.execute("DELETE FROM adv_stats_t2");
  {
    const rows = await getSheetValues(
      sheets,
      NCX_LEAGUE_SHEET_ID,
      "ADV STATS!A28:I32"
    );
    const sql = `
      INSERT INTO adv_stats_t2 (
        scenario, avg_home_pts, avg_away_pts, avg_total_pts,
        avg_wpts, avg_lpts, lt20, gte20, total_games
      ) VALUES (?,?,?,?,?,?,?,?,?)
    `;
    for (const r0 of rows) {
      const r = [...r0, "", "", "", "", "", "", "", ""].slice(0, 9);
      const scenario = norm(r[0]);
      if (!scenario) continue;
      await conn.execute(sql, r.map(norm));
    }
  }

  // ADV STATS!A36:H40 -> adv_stats_t3
  await conn.execute("DELETE FROM adv_stats_t3");
  {
    const rows = await getSheetValues(
      sheets,
      NCX_LEAGUE_SHEET_ID,
      "ADV STATS!A36:H40"
    );
    const sql = `
      INSERT INTO adv_stats_t3 (
        scenario, republic, cis, rebels, empire,
        resistance, first_order, scum
      ) VALUES (?,?,?,?,?,?,?,?)
    `;
    for (const r0 of rows) {
      const r = [...r0, "", "", "", "", "", "", ""].slice(0, 8);
      const scenario = norm(r[0]);
      if (!scenario) continue;
      await conn.execute(sql, r.map(norm));
    }
  }

  // ADV STATS!A43:H49 -> adv_stats_t4
  await conn.execute("DELETE FROM adv_stats_t4");
  {
    const rows = await getSheetValues(
      sheets,
      NCX_LEAGUE_SHEET_ID,
      "ADV STATS!A43:H49"
    );
    const sql = `
      INSERT INTO adv_stats_t4 (
        faction_vs, republic, cis, rebels, empire,
        resistance, first_order, scum
      ) VALUES (?,?,?,?,?,?,?,?)
    `;
    for (const r0 of rows) {
      const r = [...r0, "", "", "", "", "", "", ""].slice(0, 8);
      const factionVs = norm(r[0]);
      if (!factionVs) continue;
      await conn.execute(sql, r.map(norm));
    }
  }

  // ADV STATS!J36:P42 -> adv_stats_t5
  await conn.execute("DELETE FROM adv_stats_t5");
  {
    const rows = await getSheetValues(
      sheets,
      NCX_LEAGUE_SHEET_ID,
      "ADV STATS!J36:P42"
    );
    const sql = `
      INSERT INTO adv_stats_t5 (
        faction, wins, losses, win_pct,
        avg_draft, expected_win_pct, perf_plus_minus
      ) VALUES (?,?,?,?,?,?,?)
    `;
    for (const r0 of rows) {
      const r = [...r0, "", "", "", "", "", "", ""].slice(0, 7);
      const faction = norm(r[0]);
      if (!faction) continue;
      await conn.execute(sql, r.map(norm));
    }
  }
}

async function loadAllTimeStats(sheets: any, conn: mysql.Connection) {
  const sheetId = NCX_STATS_SHEET_ID || NCX_LEAGUE_SHEET_ID;
  const rows = await getSheetValues(sheets, sheetId, "ALL TIME STATS!A2:U500");

  await conn.execute("DELETE FROM all_time_stats");

  const sql = `
    INSERT INTO all_time_stats (
      ncxid,
      first_name,
      last_name,
      discord,
      wins,
      losses,
      points,
      plms,
      games,
      win_pct,
      ppg,
      extra,
      s1,
      s2,
      s3,
      s4,
      s5,
      s6,
      s7,
      s8,
      championships
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `;

  for (const r0 of rows) {
    const r = [...r0, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""].slice(
      0,
      21
    );

    const [
      ncxid,
      first_name,
      last_name,
      discord,
      wins,
      losses,
      points,
      plms,
      games,
      win_pct,
      ppg,
      extra,
      s1,
      s2,
      s3,
      s4,
      s5,
      s6,
      s7,
      s8,
      championships,
    ] = r.map(norm);

    if (!ncxid && !first_name && !last_name) continue;

    await conn.execute(sql, [
      ncxid,
      first_name,
      last_name,
      discord,
      wins,
      losses,
      points,
      plms,
      games,
      toDecimalOrNone(win_pct),
      toDecimalOrNone(ppg),
      extra,
      s1,
      s2,
      s3,
      s4,
      s5,
      s6,
      s7,
      s8,
      toIntOrNone(championships),
    ]);
  }
}

async function loadTeamSchedule(sheets: any, conn: mysql.Connection) {
  const rows = await getSheetValues(
    sheets,
    NCX_LEAGUE_SHEET_ID,
    "SCHEDULE!A2:D121"
  );

  await conn.execute("DELETE FROM team_schedule");

  const sql = `
    INSERT INTO team_schedule (
      week_label, away_team, home_team
    ) VALUES (?,?,?)
  `;

  for (const r0 of rows) {
    const r = [...r0, "", "", "", ""].slice(0, 4);
    const weekRaw = norm(r[0]);
    const away = norm(r[1]);
    const home = norm(r[3]);
    if (!weekRaw || (!away && !home)) continue;

    const weekLabel = normalizeWeekLabel(weekRaw);
    await conn.execute(sql, [weekLabel, away, home]);
  }
}

async function loadOverallStandings(sheets: any, conn: mysql.Connection) {
  const rows = await getSheetValues(
    sheets,
    NCX_LEAGUE_SHEET_ID,
    "OVERALL RECORD!A2:F25"
  );

  await conn.execute("DELETE FROM overall_standings");

    const sql = `
    INSERT INTO overall_standings (
        team, \`rank\`, wins, losses, game_wins, points
    ) VALUES (?,?,?,?,?,?)
    `;


  for (const r0 of rows) {
    const r = [...r0, "", "", "", "", "", ""].slice(0, 6);
    const rankStr = norm(r[0]);
    const team = norm(r[1]);
    if (!rankStr || !team) continue;

    const rank = parseInt(rankStr, 10);
    const wins = toIntOrZero(r[2]);
    const losses = toIntOrZero(r[3]);
    const gameWins = toIntOrZero(r[4]);
    const points = toIntOrZero(r[5]);

    await conn.execute(sql, [team, rank, wins, losses, gameWins, points]);
  }
}

async function loadLists(sheets: any, conn: mysql.Connection) {
  const rows = await getSheetValues(
    sheets,
    NCX_LEAGUE_SHEET_ID,
    "Lists!A2:D"
  );

  await conn.execute("DELETE FROM lists");

  const sql = `
    INSERT INTO lists (
      week_label,
      game,
      away_list,
      home_list,
      away_xws,
      home_xws,
      away_letters,
      home_letters
    ) VALUES (?,?,?,?,?,?,?,?)
  `;

  for (const r0 of rows) {
    const r = [...r0, "", "", "", ""].slice(0, 4);
    const weekRaw = norm(r[0]);
    const game = norm(r[1]);
    const awayList = norm(r[2]) || null;
    const homeList = norm(r[3]) || null;

    if (!weekRaw || !game) continue;

    const weekLabel = normalizeWeekLabel(weekRaw);

    let awayXwsJson: string | null = null;
    let homeXwsJson: string | null = null;
    let awayLetters: string | null = null;
    let homeLetters: string | null = null;

    if (awayList) {
      const xws = await fetchXwsFromListUrl(awayList);
      if (xws) {
        awayXwsJson = JSON.stringify(xws);
        const glyphs = shipsToGlyphs(xws.pilots ?? []);
        awayLetters = glyphs || null;
      }
    }

    if (homeList) {
      const xws = await fetchXwsFromListUrl(homeList);
      if (xws) {
        homeXwsJson = JSON.stringify(xws);
        const glyphs = shipsToGlyphs(xws.pilots ?? []);
        homeLetters = glyphs || null;
      }
    }

    await conn.execute(sql, [
      weekLabel,
      game,
      awayList,
      homeList,
      awayXwsJson,
      homeXwsJson,
      awayLetters,
      homeLetters,
    ]);
  }
}

// =============== ROUTE HANDLER ===============

export async function GET(req: NextRequest) {
  try {
    // simple auth
    const key = req.nextUrl.searchParams.get("key");
    if (process.env.SEED_API_KEY && key !== process.env.SEED_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sheets = await getSheetsClient();
    const conn = await getMySqlConn();

    const results: any = {};

    try {
      results.current_week = await loadCurrentWeek(sheets, conn);
      await loadWeeklyMatchups(sheets, conn);
      await loadIndividualStats(sheets, conn);
      await loadStreamSchedule(sheets, conn);
      await loadDiscordMap(sheets, conn);
      await loadNcxid(sheets, conn);
      await loadAdvStats(sheets, conn);
      await loadAllTimeStats(sheets, conn);
      await loadTeamSchedule(sheets, conn);
      await loadOverallStandings(sheets, conn);
      await loadLists(sheets, conn);
    } finally {
      await conn.end();
    }

    return NextResponse.json({
      ok: true,
      message: "NCX Sheets → MySQL sync complete.",
      results,
    });
  } catch (err: any) {
    console.error("Seed error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
