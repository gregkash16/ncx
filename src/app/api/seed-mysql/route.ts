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

const SUBS_GID = 1218415702;

async function loadSubs(sheets: any, conn: mysql.Connection) {
  const tabName = await getSheetTitleByGid(sheets, NCX_LEAGUE_SHEET_ID, SUBS_GID);

  // A2:A (variable length)
  const rows = await getSheetValues(sheets, NCX_LEAGUE_SHEET_ID, `${tabName}!A2:A`);

  // wipe + insert
  await conn.execute("DELETE FROM `Subs`");

  const sql = "INSERT INTO `Subs` (`NCXID`) VALUES (?)";

  let inserted = 0;
  for (const r0 of rows) {
    const ncxid = norm(r0?.[0]);
    if (!ncxid) continue;
    await conn.execute(sql, [ncxid]);
    inserted++;
  }

  return { tabName, inserted };
}

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

  // IMPORTANT: dedupe as STRING, not number
  const seen = new Set<string>();

  for (const r0 of rows) {
    const r = [...r0, "", "", "", ""].slice(0, 4);
    const ncxid = norm(r[0]);
    const first = norm(r[1]);
    const last = norm(r[2]);
    const raw = norm(r[3]);

    // Extract digits only, keep as string
    const discIdStr = raw.replace(/[^\d]/g, "");
    if (!discIdStr) continue;

    // basic sanity: Discord IDs are usually 17–20 digits
    if (discIdStr.length < 15) continue;

    if (seen.has(discIdStr)) continue;
    seen.add(discIdStr);

    // Write as string (MySQL can store as VARCHAR or BIGINT, but pass string)
    await conn.execute(sql, [discIdStr, ncxid, first, last, raw]);
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
  const rows = await getSheetValues(sheets, sheetId, "ALL TIME STATS!A2:V500");

  await conn.execute("DELETE FROM all_time_stats");

  // FIX: you are missing ONE placeholder in VALUES (need 22)

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
      s9,
      championships
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `;


  for (const r0 of rows) {
    const r = [...r0, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""].slice(
      0,
      22
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
      s9,
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
      s9,
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

async function syncListsIncremental(sheets: any, conn: mysql.Connection) {
  // 0) preload xws->init once
  const [idRows] = await conn.query<any[]>(
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

  for (const r0 of rows) {
    const r = [...r0, "", "", "", ""].slice(0, 4);
    const weekRaw = norm(r[0]);
    const game = norm(r[1]);
    const awayList = norm(r[2]) || null;
    const homeList = norm(r[3]) || null;
    if (!weekRaw || !game) continue;

    const weekLabel = normalizeWeekLabel(weekRaw);
    await conn.execute(upsertSql, [weekLabel, game, awayList, homeList]);
  }

  // 3) Refresh only dirty sides
  // (treat "dirty" as missing xws/letters/count/avg for a side)
  const [dirtyRows] = await conn.query<any[]>(
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

        await conn.execute(
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

        await conn.execute(
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


async function loadS9Signups(sheets: any, conn: mysql.Connection) {
  // Read from the S9 signup sheet (first tab), starting at row 2 to skip headers.
  // We only care about columns:
  // NCXID = F (index 5)
  // first_name = C (index 2)
  // last_name = D (index 3)
  // pref_one = J (index 9)
  // pref_two = K (index 10)
  // pref_three = L (index 11)

  const tabName = await getFirstSheetTitle(sheets, S9_SIGN_UP_SHEET_ID);

  // Pull enough columns to reach L; A2:L is perfect.
  const rows = await getSheetValues(sheets, S9_SIGN_UP_SHEET_ID, `${tabName}!A2:L`);

  // Wipe + insert into fully-qualified schema/table
  await conn.execute("DELETE FROM S9.signups");

  const sql = `
    INSERT INTO S9.signups
      (NCXID, first_name, last_name, pref_one, pref_two, pref_three)
    VALUES (?,?,?,?,?,?)
  `;

  let inserted = 0;

  for (const r0 of rows) {
    // pad to length 12
    const r = [...(r0 ?? []), "", "", "", "", "", "", "", "", "", "", "", ""].slice(0, 12);

    const ncxid = norm(r[5]);      // F
    const first = norm(r[2]);      // C
    const last = norm(r[3]);       // D
    const pref1 = norm(r[9]);      // J
    const pref2 = norm(r[10]);     // K
    const pref3 = norm(r[11]);     // L

    // Skip empty rows
    if (!ncxid && !first && !last && !pref1 && !pref2 && !pref3) continue;

    await conn.execute(sql, [ncxid, first, last, pref1, pref2, pref3]);
    inserted++;
  }

  return { tabName, inserted };
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
      results.subs = await loadSubs(sheets, conn);

      if (PRE_SEASON) {
        results.s9_signups = await loadS9Signups(sheets, conn);
      }

      await loadWeeklyMatchups(sheets, conn);
      await loadIndividualStats(sheets, conn);
      await loadStreamSchedule(sheets, conn);
      await loadDiscordMap(sheets, conn);
      await loadNcxid(sheets, conn);
      await loadAdvStats(sheets, conn);
      await loadAllTimeStats(sheets, conn);
      await loadTeamSchedule(sheets, conn);
      await loadOverallStandings(sheets, conn);

      // ✅ incremental + cache-friendly list sync
      await syncListsIncremental(sheets, conn);

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
