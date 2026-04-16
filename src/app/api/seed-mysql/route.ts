// app/api/seed-mysql/route.ts
import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { google } from "googleapis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =============== CONFIG ===============

const NCX_LEAGUE_SHEET_ID =
  process.env.NCX_LEAGUE_SHEET_ID ?? "1x4_rfPq-fPnJ2IT6WbNzBxVmomqU36fU24pnKuPaObw";
const NCX_STATS_SHEET_ID =
  process.env.NCX_STATS_SHEET_ID ?? "1Lg7rEXmizuQHlFQqtREKclSrbIdWnKa8KIfdsLy0FLs";
const STREAM_SCHEDULE_SHEET_ID =
  process.env.STREAM_SCHEDULE_SHEET_ID ??
  "17sgzFPYAfVdWirop6Rf_8tNgFqqHqv3BXDJWc8dUYzQ";

const PRE_SEASON =
  String(process.env.PRE_SEASON ?? "").trim().toLowerCase() === "true";

const S9_SIGN_UP_SHEET_ID =
  process.env.S9_SIGN_UP_SHEET_ID ??
  "1DlS10zpaOkEumIoTJLXWUS4XZfbpFG13crOtwoHr72w";


const WEEK_TABS = Array.from({ length: 14 }, (_, i) => `WEEK ${i + 1}`);

// =============== HELPERS ===============

async function getSheetTitleByGid(
  sheets: any,
  spreadsheetId: string,
  gid: number
): Promise<string> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });

  const match = (meta.data.sheets ?? []).find(
    (s: any) => Number(s?.properties?.sheetId) === Number(gid)
  );

  const title = match?.properties?.title;
  if (!title) {
    throw new Error(`Could not find sheet tab for gid=${gid}`);
  }
  return String(title);
}

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

async function getFirstSheetTitle(sheets: any, spreadsheetId: string): Promise<string> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(title))",
  });

  const title = meta.data.sheets?.[0]?.properties?.title;
  if (!title) throw new Error(`Could not find first sheet tab for spreadsheetId=${spreadsheetId}`);
  return String(title);
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

type XwsPilot = { ship: string; id?: string };
type XwsResponse = { pilots?: XwsPilot[] };

function shipsToGlyphs(pilots: XwsPilot[] = []): string {
  return pilots.map((p) => SHIP_ICON_MAP[p.ship] ?? "·").join("");
}

function buildPatternAnalyzerUrlFromList(listUrl: string): string | null {
  if (!listUrl.startsWith("https://yasb.app")) return null;
  const parts = listUrl.split("yasb.app/");
  if (parts.length < 2) return null;
  const dataLink = parts[1]; // "?f=...&d=..."
  return `http://5.161.202.51:3001/api/yasb/xws${dataLink}`;
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

  if (!upstream) {
    console.log(`[SEED-XWS] No upstream URL for: ${listUrl}`);
    return null;
  }

  try {
    console.log(`[SEED-XWS] Fetching from: ${upstream}`);
    const res = await fetch(upstream, { cache: "no-store" });
    if (!res.ok) {
      console.log(`[SEED-XWS] Fetch failed with status ${res.status}`);
      return null;
    }
    const data = (await res.json()) as XwsResponse;
    console.log(`[SEED-XWS] Fetch successful: ${data.pilots?.length ?? 0} pilots`);
    return data;
  } catch (err) {
    console.error(`[SEED-XWS] Fetch error:`, err);
    return null;
  }
}

type InitLookup = Map<string, number>;

function computeCountAndAverageInit(
  xwsJson: string | null,
  initByXws: InitLookup
): { count: number | null; avgInit: number | null } {
  if (!xwsJson) return { count: null, avgInit: null };

  let parsed: any;
  try {
    parsed = JSON.parse(xwsJson);
  } catch {
    return { count: null, avgInit: null };
  }

  const pilots: XwsPilot[] = Array.isArray(parsed?.pilots)
    ? parsed.pilots
    : [];

  if (pilots.length === 0) {
    return { count: 0, avgInit: null };
  }

  let sum = 0;
  let matched = 0;

  for (const p of pilots) {
    const xwsId = p.id;
    if (!xwsId) continue;
    const init = initByXws.get(xwsId);
    if (init == null) continue;
    sum += Number(init);
    matched++;
  }

  const avg =
    matched > 0 ? Number((sum / matched).toFixed(1)) : null;

  return {
    count: pilots.length,
    avgInit: avg,
  };
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

// Fetch multiple ranges in a single API call.
async function getSheetValuesBatch(
  sheets: any,
  spreadsheetId: string,
  ranges: string[]
): Promise<string[][][]> {
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
  });
  const valueRanges: any[] = res.data.valueRanges ?? [];
  return ranges.map((_, i) => (valueRanges[i]?.values ?? []) as string[][]);
}

// =============== MYSQL CLIENT ===============
//
// Dedicated pool for the seed route — sized larger than the main app pool
// (`@/lib/db`) so parallel load functions don't starve normal traffic.
// Module-scoped singleton; survives across hot reloads via globalThis.

const SEED_POOL_KEY = "__ncxSeedPool";

function getSeedPool(): mysql.Pool {
  const g = globalThis as any;
  if (g[SEED_POOL_KEY]) return g[SEED_POOL_KEY];

  const host = process.env.DB_HOST ?? "localhost";
  const port = Number(process.env.DB_PORT ?? "3306");
  const user = process.env.DB_USER ?? "root";
  const password = process.env.DB_PASSWORD ?? process.env.MYSQLPASSWORD;
  const database = process.env.DB_NAME ?? "S8";

  if (!password) {
    throw new Error("Missing DB_PASSWORD / MYSQLPASSWORD");
  }

  const pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: false,
    waitForConnections: true,
    connectionLimit: Number(process.env.SEED_POOL_LIMIT ?? 5),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  g[SEED_POOL_KEY] = pool;
  return pool;
}

// Bulk insert helper. mysql2's `INSERT ... VALUES ?` placeholder accepts an
// array-of-arrays and emits one statement instead of N. Must use `query`,
// not `execute` (the prepared-statement path doesn't expand the array).
async function bulkInsert(
  pool: mysql.Pool,
  sql: string,
  rows: any[][]
): Promise<number> {
  if (rows.length === 0) return 0;
  await pool.query(sql, [rows]);
  return rows.length;
}

// =============== LOADERS ===============

const SUBS_GID = 1218415702;

async function loadSubs(sheets: any, pool: mysql.Pool) {
  const tabName = await getSheetTitleByGid(sheets, NCX_LEAGUE_SHEET_ID, SUBS_GID);
  const rows = await getSheetValues(sheets, NCX_LEAGUE_SHEET_ID, `${tabName}!A2:A`);

  const values: any[][] = [];
  for (const r0 of rows) {
    const ncxid = norm(r0?.[0]);
    if (!ncxid) continue;
    values.push([ncxid]);
  }

  await pool.query("DELETE FROM `Subs`");
  const inserted = await bulkInsert(
    pool,
    "INSERT INTO `Subs` (`NCXID`) VALUES ?",
    values
  );

  return { tabName, inserted };
}

async function loadCurrentWeek(sheets: any, pool: mysql.Pool) {
  const rows = await getSheetValues(sheets, NCX_LEAGUE_SHEET_ID, "SCHEDULE!U2:U2");
  const value = rows[0]?.[0] ?? "WEEK 1";
  const weekLabel = normalizeWeekLabel(value);

  await pool.query("DELETE FROM current_week");
  await pool.query("INSERT INTO current_week (week_label) VALUES (?)", [weekLabel]);

  return { weekLabel };
}

async function loadWeeklyMatchups(sheets: any, pool: mysql.Pool): Promise<number> {
  // Fetch all 14 week tabs in a single batchGet — one HTTP round-trip
  // instead of 14, and tabs that don't exist come back as empty arrays.
  const ranges = WEEK_TABS.map((w) => `${w}!A2:Q120`);
  let weekRowSets: string[][][];
  try {
    weekRowSets = await getSheetValuesBatch(sheets, NCX_LEAGUE_SHEET_ID, ranges);
  } catch (err) {
    console.warn("loadWeeklyMatchups batchGet failed, falling back per-week", err);
    weekRowSets = await Promise.all(
      ranges.map((r) =>
        getSheetValues(sheets, NCX_LEAGUE_SHEET_ID, r).catch(() => [] as string[][])
      )
    );
  }

  const values: any[][] = [];
  for (let i = 0; i < WEEK_TABS.length; i++) {
    const weekLabel = normalizeWeekLabel(WEEK_TABS[i]);
    const rows = weekRowSets[i] ?? [];
    for (const r0 of rows) {
      const r = [...r0, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""].slice(
        0,
        17
      );

      const gameRaw = norm(r[0]);
      const gameNum = parseInt(gameRaw, 10);
      if (!Number.isFinite(gameNum) || gameNum <= 0) continue;
      const game = String(gameNum);

      const awayTeam = norm(r[3]);
      const homeTeam = norm(r[11]);
      if (!awayTeam && !homeTeam) continue;

      values.push([
        weekLabel,
        game,
        norm(r[1]),
        norm(r[2]),
        awayTeam,
        parseWinCell(r[4]),
        parseLossCell(r[5]),
        toIntOrZero(r[6]),
        toIntOrZero(r[7]),
        norm(r[9]),
        norm(r[10]),
        homeTeam,
        parseWinCell(r[12]),
        parseLossCell(r[13]),
        toIntOrZero(r[14]),
        toIntOrZero(r[15]),
        norm(r[16]),
      ]);
    }
  }

  await pool.query("DELETE FROM weekly_matchups");
  return await bulkInsert(
    pool,
    `INSERT INTO weekly_matchups (
       week_label, game, awayId, awayName, awayTeam, awayW, awayL, awayPts, awayPLMS,
       homeId, homeName, homeTeam, homeW, homeL, homePts, homePLMS, scenario
     ) VALUES ?`,
    values
  );
}

async function loadIndividualStats(sheets: any, pool: mysql.Pool): Promise<number> {
  const rows = await getSheetValues(sheets, NCX_LEAGUE_SHEET_ID, "INDIVIDUAL!A2:V");

  const values: any[][] = [];
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

    const pick = norm(r[5]);
    values.push([
      rank,
      norm(r[1]),
      norm(r[2]),
      norm(r[3]),
      norm(r[4]),
      pick ? parseInt(pick, 10) : null,
      norm(r[6]),
      norm(r[7]),
      toIntOrZero(r[8]),
      toIntOrZero(r[9]),
      toIntOrZero(r[10]),
      toIntOrZero(r[11]),
      toIntOrZero(r[12]),
      norm(r[13]) || null,
      norm(r[14]) || null,
      toIntOrZero(r[15]),
      norm(r[16]) || null,
      norm(r[17]) || null,
      norm(r[18]) || null,
      norm(r[19]) || null,
    ]);
  }

  await pool.query("DELETE FROM individual_stats");
  return await bulkInsert(
    pool,
    `INSERT INTO individual_stats (
      \`rank\`, ncxid, first_name, last_name, discord,
      pick_no, team, faction, wins, losses, points,
      plms, games, winper, ppg, efficiency, war,
      h2h, potato, sos
    ) VALUES ?`,
    values
  );
}

async function loadStreamSchedule(sheets: any, pool: mysql.Pool): Promise<number> {
  // Both ranges live on the same sheet — fetch in one batchGet.
  let batched: string[][][];
  try {
    batched = await getSheetValuesBatch(
      sheets,
      STREAM_SCHEDULE_SHEET_ID,
      ["Sheet1!M3:M3", "Sheet1!A2:C8"]
    );
  } catch {
    batched = [[], []];
  }
  const m3Val = batched[0]?.[0]?.[0] ?? "";
  const scheduleWeek = m3Val.trim() ? normalizeWeekLabel(m3Val) : "SCHEDULE";
  const rows = batched[1] ?? [];

  const values: any[][] = [];
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

    values.push([scheduleWeek, gameNumRaw, dateRaw.toUpperCase(), gameType.toUpperCase()]);
  }

  await pool.query("DELETE FROM stream_schedule");
  return await bulkInsert(
    pool,
    "INSERT INTO stream_schedule (schedule_week, game, day, slot) VALUES ?",
    values
  );
}

async function loadDiscordMap(sheets: any, pool: mysql.Pool): Promise<number> {
  const rows = await getSheetValues(sheets, NCX_LEAGUE_SHEET_ID, "Discord_ID!A:D");

  // dedupe as STRING, not number (Discord IDs overflow JS number)
  const seen = new Set<string>();
  const values: any[][] = [];
  for (const r0 of rows) {
    const r = [...r0, "", "", "", ""].slice(0, 4);
    const ncxid = norm(r[0]);
    const first = norm(r[1]);
    const last = norm(r[2]);
    const raw = norm(r[3]);

    const discIdStr = raw.replace(/[^\d]/g, "");
    if (!discIdStr) continue;
    if (discIdStr.length < 15) continue; // Discord IDs are usually 17–20 digits
    if (seen.has(discIdStr)) continue;
    seen.add(discIdStr);

    values.push([discIdStr, ncxid, first, last, raw]);
  }

  await pool.query("DELETE FROM discord_map");
  return await bulkInsert(
    pool,
    `INSERT INTO discord_map (discord_id, ncxid, first_name, last_name, raw_discord) VALUES ?`,
    values
  );
}

// loadCaptains and loadNcxid both pull from the NCXID tab. The orchestrator
// fetches `NCXID!A2:O215` once via getSheetValuesBatch and passes the rows in.
//
// Captains: cols K-O (indices 10-14), only first 24 rows used.
// Ncxid:    cols A-I (indices 0-8).

async function loadCaptains(pool: mysql.Pool, ncxidRows: string[][]) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS S9.captains (
      team_name VARCHAR(255) NOT NULL,
      discord_id VARCHAR(32) NOT NULL,
      PRIMARY KEY (team_name, discord_id)
    )
  `);

  const values: any[][] = [];
  const seen = new Set<string>();
  // Only the first 24 rows have captain data (K2:O25).
  for (let i = 0; i < Math.min(24, ncxidRows.length); i++) {
    const r0 = ncxidRows[i] ?? [];
    const team = norm(r0[10]);
    const disc = String(r0[14] ?? "")
      .trim()
      .replace(/[<@!>]/g, "")
      .replace(/\D/g, "");
    if (!team || !disc) continue;
    const key = `${team}\u0000${disc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    values.push([team, disc]);
  }

  await pool.query("DELETE FROM S9.captains");
  return await bulkInsert(
    pool,
    "INSERT IGNORE INTO S9.captains (team_name, discord_id) VALUES ?",
    values
  );
}

async function loadNcxid(pool: mysql.Pool, ncxidRows: string[][]): Promise<number> {
  const values: any[][] = [];
  for (const r0 of ncxidRows) {
    const r = [...r0, "", "", "", "", "", "", "", "", ""].slice(0, 9);
    const ncxidVal = norm(r[0]);
    if (!ncxidVal) continue;
    values.push([ncxidVal, norm(r[7]), norm(r[8])]);
  }

  await pool.query("DELETE FROM ncxid");
  return await bulkInsert(
    pool,
    "INSERT INTO ncxid (ncxid, faction_h, faction_i) VALUES ?",
    values
  );
}

async function loadAdvStats(sheets: any, pool: mysql.Pool): Promise<Record<string, number>> {
  // All 5 sub-tables live on the ADV STATS tab — fetch in one batchGet.
  const ranges = [
    "ADV STATS!A2:N25",
    "ADV STATS!A28:I32",
    "ADV STATS!A36:H40",
    "ADV STATS!A43:H49",
    "ADV STATS!J36:P42",
  ];
  const [t1Rows, t2Rows, t3Rows, t4Rows, t5Rows] = await getSheetValuesBatch(
    sheets,
    NCX_LEAGUE_SHEET_ID,
    ranges
  );

  const t1Values: any[][] = [];
  for (const r0 of t1Rows) {
    const r = [...r0, "", "", "", "", "", "", "", "", "", "", "", "", ""].slice(0, 14);
    if (!norm(r[0])) continue;
    t1Values.push(r.map(norm));
  }
  const t2Values: any[][] = [];
  for (const r0 of t2Rows) {
    const r = [...r0, "", "", "", "", "", "", "", ""].slice(0, 9);
    if (!norm(r[0])) continue;
    t2Values.push(r.map(norm));
  }
  const t3Values: any[][] = [];
  for (const r0 of t3Rows) {
    const r = [...r0, "", "", "", "", "", "", ""].slice(0, 8);
    if (!norm(r[0])) continue;
    t3Values.push(r.map(norm));
  }
  const t4Values: any[][] = [];
  for (const r0 of t4Rows) {
    const r = [...r0, "", "", "", "", "", "", ""].slice(0, 8);
    if (!norm(r[0])) continue;
    t4Values.push(r.map(norm));
  }
  const t5Values: any[][] = [];
  for (const r0 of t5Rows) {
    const r = [...r0, "", "", "", "", "", "", ""].slice(0, 7);
    if (!norm(r[0])) continue;
    t5Values.push(r.map(norm));
  }

  // 5 sub-tables are independent — wipe + bulk-insert in parallel.
  const [t1, t2, t3, t4, t5] = await Promise.all([
    (async () => {
      await pool.query("DELETE FROM adv_stats_t1");
      return await bulkInsert(
        pool,
        `INSERT INTO adv_stats_t1 (
          team, total_games, avg_wins, avg_loss, avg_points,
          avg_plms, avg_games, avg_win_pct, avg_ppg,
          avg_efficiency, avg_war, avg_h2h, avg_potato, avg_sos
        ) VALUES ?`,
        t1Values
      );
    })(),
    (async () => {
      await pool.query("DELETE FROM adv_stats_t2");
      return await bulkInsert(
        pool,
        `INSERT INTO adv_stats_t2 (
          scenario, avg_home_pts, avg_away_pts, avg_total_pts,
          avg_wpts, avg_lpts, lt20, gte20, total_games
        ) VALUES ?`,
        t2Values
      );
    })(),
    (async () => {
      await pool.query("DELETE FROM adv_stats_t3");
      return await bulkInsert(
        pool,
        `INSERT INTO adv_stats_t3 (
          scenario, republic, cis, rebels, empire,
          resistance, first_order, scum
        ) VALUES ?`,
        t3Values
      );
    })(),
    (async () => {
      await pool.query("DELETE FROM adv_stats_t4");
      return await bulkInsert(
        pool,
        `INSERT INTO adv_stats_t4 (
          faction_vs, republic, cis, rebels, empire,
          resistance, first_order, scum
        ) VALUES ?`,
        t4Values
      );
    })(),
    (async () => {
      await pool.query("DELETE FROM adv_stats_t5");
      return await bulkInsert(
        pool,
        `INSERT INTO adv_stats_t5 (
          faction, wins, losses, win_pct,
          avg_draft, expected_win_pct, perf_plus_minus
        ) VALUES ?`,
        t5Values
      );
    })(),
  ]);

  return { t1, t2, t3, t4, t5 };
}

async function loadAllTimeStats(sheets: any, pool: mysql.Pool): Promise<number> {
  const sheetId = NCX_STATS_SHEET_ID || NCX_LEAGUE_SHEET_ID;
  const rows = await getSheetValues(sheets, sheetId, "ALL TIME STATS!A2:V500");

  const values: any[][] = [];
  for (const r0 of rows) {
    const r = [...r0, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""].slice(
      0,
      22
    );
    const [
      ncxid, first_name, last_name, discord,
      wins, losses, points, plms, games,
      win_pct, ppg, adj_ppg,
      s1, s2, s3, s4, s5, s6, s7, s8, s9,
      championships,
    ] = r.map(norm);

    if (!ncxid && !first_name && !last_name) continue;

    values.push([
      ncxid, first_name, last_name, discord,
      wins, losses, points, plms, games,
      toDecimalOrNone(win_pct),
      toDecimalOrNone(ppg),
      toDecimalOrNone(adj_ppg),
      s1, s2, s3, s4, s5, s6, s7, s8, s9,
      toIntOrNone(championships),
    ]);
  }

  await pool.query("DELETE FROM all_time_stats");
  return await bulkInsert(
    pool,
    `INSERT INTO all_time_stats (
      ncxid, first_name, last_name, discord,
      wins, losses, points, plms, games,
      win_pct, ppg, adj_ppg,
      s1, s2, s3, s4, s5, s6, s7, s8, s9,
      championships
    ) VALUES ?`,
    values
  );
}

async function loadTeamSchedule(sheets: any, pool: mysql.Pool): Promise<number> {
  const rows = await getSheetValues(
    sheets,
    NCX_LEAGUE_SHEET_ID,
    "SCHEDULE!A2:D121"
  );

  const values: any[][] = [];
  for (const r0 of rows) {
    const r = [...r0, "", "", "", ""].slice(0, 4);
    const weekRaw = norm(r[0]);
    const away = norm(r[1]);
    const home = norm(r[3]);
    if (!weekRaw || (!away && !home)) continue;
    values.push([normalizeWeekLabel(weekRaw), away, home]);
  }

  await pool.query("DELETE FROM team_schedule");
  return await bulkInsert(
    pool,
    "INSERT INTO team_schedule (week_label, away_team, home_team) VALUES ?",
    values
  );
}

async function loadOverallStandings(sheets: any, pool: mysql.Pool): Promise<number> {
  const rows = await getSheetValues(
    sheets,
    NCX_LEAGUE_SHEET_ID,
    "OVERALL RECORD!A2:F25"
  );

  const values: any[][] = [];
  for (const r0 of rows) {
    const r = [...r0, "", "", "", "", "", ""].slice(0, 6);
    const rankStr = norm(r[0]);
    const team = norm(r[1]);
    if (!rankStr || !team) continue;

    values.push([
      team,
      parseInt(rankStr, 10),
      toIntOrZero(r[2]),
      toIntOrZero(r[3]),
      toIntOrZero(r[4]),
      toIntOrZero(r[5]),
    ]);
  }

  await pool.query("DELETE FROM overall_standings");
  return await bulkInsert(
    pool,
    "INSERT INTO overall_standings (team, `rank`, wins, losses, game_wins, points) VALUES ?",
    values
  );
}

async function syncListsIncremental(
  sheets: any,
  pool: mysql.Pool
): Promise<{ upserted: number; refreshed: number }> {
  // 0) preload xws->init once
  const [idRows] = await pool.query<any[]>(
    "SELECT xws, init FROM railway.IDs WHERE id >= '0001' AND id <= '0726'"
  );
  const initByXws: InitLookup = new Map();
  for (const row of idRows) {
    if (!row.xws || row.init == null) continue;
    initByXws.set(String(row.xws), Number(row.init));
  }

  // 1) Pull list URL rows from Sheets
  const rows = await getSheetValues(sheets, NCX_LEAGUE_SHEET_ID, "Lists!A2:D");

  // 2) Upsert URLs; invalidate derived fields if URL changed
  const upsertSql = `
    INSERT INTO lists (week_label, game, away_list, home_list)
    VALUES (?,?,?,?)
    ON DUPLICATE KEY UPDATE
      -- set URLs
      away_list = VALUES(away_list),
      home_list = VALUES(home_list),

      -- invalidate AWAY derived fields if away_list changed
      away_xws = IF(COALESCE(away_list,'') <> COALESCE(VALUES(away_list),''), NULL, away_xws),
      away_letters = IF(COALESCE(away_list,'') <> COALESCE(VALUES(away_list),''), NULL, away_letters),
      away_count = IF(COALESCE(away_list,'') <> COALESCE(VALUES(away_list),''), NULL, away_count),
      away_average_init = IF(COALESCE(away_list,'') <> COALESCE(VALUES(away_list),''), NULL, away_average_init),

      -- invalidate HOME derived fields if home_list changed
      home_xws = IF(COALESCE(home_list,'') <> COALESCE(VALUES(home_list),''), NULL, home_xws),
      home_letters = IF(COALESCE(home_list,'') <> COALESCE(VALUES(home_list),''), NULL, home_letters),
      home_count = IF(COALESCE(home_list,'') <> COALESCE(VALUES(home_list),''), NULL, home_count),
      home_average_init = IF(COALESCE(home_list,'') <> COALESCE(VALUES(home_list),''), NULL, home_average_init)
  `;

  let upserted = 0;
  for (const r0 of rows) {
    const r = [...r0, "", "", "", ""].slice(0, 4);
    const weekRaw = norm(r[0]);
    const game = norm(r[1]);
    const awayList = norm(r[2]) || null;
    const homeList = norm(r[3]) || null;
    if (!weekRaw || !game) continue;

    const weekLabel = normalizeWeekLabel(weekRaw);
    await pool.query(upsertSql, [weekLabel, game, awayList, homeList]);
    upserted++;
  }

  // 3) Refresh only dirty sides
  // (treat "dirty" as missing xws/letters/count/avg for a side)
  const [dirtyRows] = await pool.query<any[]>(
    `
    SELECT
      week_label, game,
      away_list, home_list,
      away_xws, home_xws,
      away_letters, home_letters,
      away_count, home_count,
      away_average_init, home_average_init
    FROM lists
    WHERE
      (
        COALESCE(away_list,'') <> ''
        AND (away_xws IS NULL OR away_letters IS NULL OR away_count IS NULL OR away_average_init IS NULL)
      )
      OR
      (
        COALESCE(home_list,'') <> ''
        AND (home_xws IS NULL OR home_letters IS NULL OR home_count IS NULL OR home_average_init IS NULL)
      )
    `
  );

  console.log(`[SEED-LISTS] Found ${dirtyRows.length} dirty rows to process`);

  // per-run URL->XWS dedupe cache
  const xwsCache = new Map<string, XwsResponse | null>();

  for (const row of dirtyRows) {
    const weekLabel = String(row.week_label);
    const game = String(row.game);

    // AWAY
    {
      const url = String(row.away_list ?? "").trim();
      const needsAway =
        url &&
        (row.away_xws == null ||
          row.away_letters == null ||
          row.away_count == null ||
          row.away_average_init == null);

      if (needsAway) {
        const { xwsJson, letters, count, avgInit } =
          await resolveDerivedForUrl(url, initByXws, xwsCache);

        await pool.query(
          `
          UPDATE lists
          SET
            away_xws = ?,
            away_letters = ?,
            away_count = ?,
            away_average_init = ?
          WHERE week_label = ? AND game = ?
          `,
          [xwsJson, letters, count, avgInit, weekLabel, game]
        );
      }
    }

    // HOME
    {
      const url = String(row.home_list ?? "").trim();
      const needsHome =
        url &&
        (row.home_xws == null ||
          row.home_letters == null ||
          row.home_count == null ||
          row.home_average_init == null);

      if (needsHome) {
        const { xwsJson, letters, count, avgInit } =
          await resolveDerivedForUrl(url, initByXws, xwsCache);

        await pool.query(
          `
          UPDATE lists
          SET
            home_xws = ?,
            home_letters = ?,
            home_count = ?,
            home_average_init = ?
          WHERE week_label = ? AND game = ?
          `,
          [xwsJson, letters, count, avgInit, weekLabel, game]
        );
      }
    }
  }

  return { upserted, refreshed: dirtyRows.length };
}

function isValidListLinkSeed(url: string): boolean {
  const s = String(url ?? "").trim().toLowerCase();
  if (!s) return false;
  const isUrlLike = /^https?:\/\//.test(s);
  if (!isUrlLike) return false;
  return s.startsWith("https://yasb.app") || s.startsWith("https://launchbaynext.app");
}

async function resolveDerivedForUrl(
  url: string,
  initByXws: InitLookup,
  xwsCache: Map<string, XwsResponse | null>
): Promise<{
  xwsJson: string | null;
  letters: string | null;
  count: number | null;
  avgInit: number | null;
}> {
  const trimmed = String(url ?? "").trim();
  if (!trimmed || !isValidListLinkSeed(trimmed)) {
    return { xwsJson: null, letters: null, count: null, avgInit: null };
  }

  // dedupe per run
  let xws = xwsCache.get(trimmed) ?? null;
  if (!xwsCache.has(trimmed)) {
    xws = await fetchXwsFromListUrl(trimmed); // <-- exists in seed-mysql
    xwsCache.set(trimmed, xws);
  }

  if (!xws) {
    return { xwsJson: null, letters: null, count: null, avgInit: null };
  }

  const xwsJson = JSON.stringify(xws);

  // seed's shipsToGlyphs returns string, so convert empty to null
  const glyphStr = shipsToGlyphs(xws.pilots ?? []);
  const letters = glyphStr ? glyphStr : null;

  // seed's computeCountAndAverageInit expects JSON string
  const { count, avgInit } = computeCountAndAverageInit(xwsJson, initByXws);

  return { xwsJson, letters, count, avgInit };
}


async function loadS9Signups(sheets: any, pool: mysql.Pool) {
  // Columns of interest: C=first, D=last, F=ncxid, J/K/L=prefs
  const tabName = await getFirstSheetTitle(sheets, S9_SIGN_UP_SHEET_ID);
  const rows = await getSheetValues(sheets, S9_SIGN_UP_SHEET_ID, `${tabName}!A2:L`);

  const values: any[][] = [];
  for (const r0 of rows) {
    const r = [...(r0 ?? []), "", "", "", "", "", "", "", "", "", "", "", ""].slice(0, 12);
    const ncxid = norm(r[5]);
    const first = norm(r[2]);
    const last = norm(r[3]);
    const pref1 = norm(r[9]);
    const pref2 = norm(r[10]);
    const pref3 = norm(r[11]);
    if (!ncxid && !first && !last && !pref1 && !pref2 && !pref3) continue;
    values.push([ncxid, first, last, pref1, pref2, pref3]);
  }

  await pool.query("DELETE FROM S9.signups");
  const inserted = await bulkInsert(
    pool,
    "INSERT INTO S9.signups (NCXID, first_name, last_name, pref_one, pref_two, pref_three) VALUES ?",
    values
  );

  return { tabName, inserted };
}

// =============== ROUTE HANDLER ===============

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  try {
    // simple auth
    const key = req.nextUrl.searchParams.get("key");
    if (process.env.SEED_API_KEY && key !== process.env.SEED_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sheets = await getSheetsClient();
    const pool = getSeedPool();

    // Read NCXID!A2:O215 once; loadNcxid + loadCaptains both work off these rows.
    const [ncxidRows] = await getSheetValuesBatch(sheets, NCX_LEAGUE_SHEET_ID, [
      "NCXID!A2:O215",
    ]);

    const [
      currentWeek,
      subs,
      signupsResult,
      weeklyMatchups,
      individualStats,
      streamSchedule,
      discordMap,
      ncxid,
      captains,
      advStats,
      allTimeStats,
      teamSchedule,
      overallStandings,
      lists,
    ] = await Promise.all([
      loadCurrentWeek(sheets, pool),
      loadSubs(sheets, pool),
      PRE_SEASON ? loadS9Signups(sheets, pool) : Promise.resolve(null),
      loadWeeklyMatchups(sheets, pool),
      loadIndividualStats(sheets, pool),
      loadStreamSchedule(sheets, pool),
      loadDiscordMap(sheets, pool),
      loadNcxid(pool, ncxidRows),
      loadCaptains(pool, ncxidRows),
      loadAdvStats(sheets, pool),
      loadAllTimeStats(sheets, pool),
      loadTeamSchedule(sheets, pool),
      loadOverallStandings(sheets, pool),
      syncListsIncremental(sheets, pool),
    ]);

    const elapsedMs = Date.now() - startedAt;

    const tables: Record<string, number | Record<string, number>> = {
      Subs: subs.inserted,
      weekly_matchups: weeklyMatchups,
      individual_stats: individualStats,
      stream_schedule: streamSchedule,
      discord_map: discordMap,
      ncxid: ncxid,
      "S9.captains": captains,
      adv_stats: advStats,
      all_time_stats: allTimeStats,
      team_schedule: teamSchedule,
      overall_standings: overallStandings,
      lists,
    };
    if (signupsResult) tables["S9.signups"] = signupsResult.inserted;

    const totalRows =
      Object.values(tables).reduce<number>((acc, v) => {
        if (typeof v === "number") return acc + v;
        if (v && typeof v === "object")
          return acc + Object.values(v).reduce<number>((a, n) => a + (typeof n === "number" ? n : 0), 0);
        return acc;
      }, 0);

    return NextResponse.json({
      ok: true,
      message: "NCX Sheets → MySQL sync complete.",
      elapsed_ms: elapsedMs,
      current_week: currentWeek.weekLabel,
      total_rows_written: totalRows,
      tables,
    });
  } catch (err: any) {
    console.error("Seed error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error", elapsed_ms: Date.now() - startedAt },
      { status: 500 }
    );
  }
}
