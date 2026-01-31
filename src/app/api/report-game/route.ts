import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSheets } from "@/lib/googleSheets";
import { sql } from "@vercel/postgres";
import webpush from "web-push";
import mysql from "mysql2/promise";

/* ------------------------- Shared helpers ------------------------- */

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "").trim().replace(/[<@!>]/g, "").replace(/\D/g, "");
}
function norm(v: unknown) {
  return String(v ?? "").trim();
}

function isValidListLink(url: string): boolean {
  const s = String(url ?? "").trim().toLowerCase();
  if (!s) return true; // empty is allowed
  const isUrlLike = /^https?:\/\//.test(s);
  if (!isUrlLike) return false;
  const isYasb = s.includes("yasb.app") || s.includes("raithos.github.io");
  const isLbn = s.includes("launchbaynext.app");
  return isYasb || isLbn;
}

// extra helpers for MySQL sync
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
  if (Number.isInteger(num) && num > 0) return `WEEK ${num}`;
  return s.toUpperCase();
}

/* ------------------------- Types / constants ------------------------- */

const ADMIN_DISCORD_ID = "349349801076195329" as const;

type Role = "player" | "captain" | "admin";

type GameRow = {
  rowIndex: number;
  game: string;
  away: {
    id: string;
    name: string;
    team: string;
    wins: string;
    losses: string;
    pts: string;
    plms: string;
  };
  home: {
    id: string;
    name: string;
    team: string;
    wins: string;
    losses: string;
    pts: string;
    plms: string;
  };
  scenario: string;
  alreadyFilled: boolean;
  isMyGame: boolean;
  canEditAwayId: boolean;
  canEditHomeId: boolean;
  /** New: list URLs from Lists sheet */
  awayList?: string;
  homeList?: string;
};

type LookupResult =
  | {
      ok: true;
      weekTab: string;
      role: Role;
      games: GameRow[];
    }
  | { ok: false; reason: string };

type SheetsClient = ReturnType<typeof getSheets>;

/* ------------------------- Push helpers ------------------------- */
let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  const subject = process.env.VAPID_MAILTO || "mailto:noreply@nickelcityxwing.com";
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error("Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars.");
  webpush.setVapidDetails(subject, pub, priv);
  vapidReady = true;
}

async function sendPushToAll(payload: { title: string; body: string; url: string }) {
  ensureVapid();
  const { rows } = await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions`;
  const subs = rows.map((r) => ({
    endpoint: r.endpoint,
    keys: { p256dh: r.p256dh, auth: r.auth },
  }));
  const msg = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s as any, msg);
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
        }
      }
    })
  );

  return subs.length;
}

// Filtered push sender — only notifies users who selected these teams
async function sendPushForTeams(
  teams: string[],
  payload: { title: string; body: string; url: string }
) {
  ensureVapid();

  const teamsJson = JSON.stringify(
    teams.map((t) => (t ?? "").trim()).filter(Boolean)
  );

  const { rows } = await sql`
    SELECT endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE
      all_teams = TRUE
      OR EXISTS (
        SELECT 1
        FROM json_array_elements_text(${teamsJson}::json) j
        WHERE j = ANY(push_subscriptions.teams)
      )
  `;

  const subs = rows.map((r) => ({
    endpoint: r.endpoint,
    keys: { p256dh: r.p256dh, auth: r.auth },
  }));

  const msg = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s as any, msg);
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
        }
      }
    })
  );

  return subs.length;
}

/* ------------------------- Role helpers ------------------------- */

async function getNcxIdForDiscord(
  sheets: SheetsClient,
  spreadsheetId: string,
  discordId: string
) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Discord_ID!A:D",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = res.data.values ?? [];
  const hit = rows.find((r) => normalizeDiscordId(r?.[3]) === discordId);
  if (!hit) return null;

  return { ncxid: hit[0] ?? "", first: hit[1] ?? "", last: hit[2] ?? "" };
}

/**
 * Captain lookup from NCXID!K2:O25
 * K = team name, O = captain Discord ID
 */
async function getCaptainTeamsForDiscord(
  sheets: SheetsClient,
  spreadsheetId: string,
  discordId: string
): Promise<string[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "NCXID!K2:O25",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = res.data.values ?? [];
  const teams: string[] = [];

  for (const r of rows) {
    const team = norm(r?.[0]); // K
    const disc = normalizeDiscordId(r?.[4]); // O (K..O => index 4)
    if (team && disc === discordId) {
      teams.push(team);
    }
  }
  return teams;
}

function teamKey(s: string): string {
  return String(s ?? "").trim().toUpperCase();
}

/**
 * Decide role for this Discord ID.
 * - Admin: hard-coded
 * - Captain: appears in NCXID!K2:O25
 * - Player: has an NCXID mapping
 */
function resolveRole(
  discordId: string,
  who: { ncxid: string; first: string; last: string } | null,
  captainTeams: string[]
): Role | null {
  if (discordId === ADMIN_DISCORD_ID) return "admin";
  if (captainTeams.length > 0) return "captain";
  if (who?.ncxid) return "player";
  return null;
}

/* --------------------------- XWS / glyph helpers ------------------------- */

type XwsPilot = {
  ship: string;
  id?: string; // xws id, e.g. "anakinskywalker-delta7baethersprite"
};

type XwsResponse = {
  pilots?: XwsPilot[];
  [key: string]: any;
};

type InitLookup = Map<string, number>;

function computeCountAndAverageInitFromXws(
  xws: XwsResponse | null,
  initByXws: InitLookup
): { count: number | null; avgInit: number | null } {
  if (!xws || !Array.isArray(xws.pilots)) {
    return { count: null, avgInit: null };
  }

  const pilots = xws.pilots;
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

function shipsToGlyphs(pilots?: XwsPilot[] | null): string | null {
  if (!pilots || !pilots.length) return null;
  const s = pilots.map((p) => SHIP_ICON_MAP[p.ship] ?? "·").join("");
  return s || null;
}

async function fetchXwsFromListUrlServer(listUrl: string): Promise<XwsResponse | null> {
  try {
    let upstreamUrl: string | null = null;

    // YASB: proxy via pattern-analyzer
    if (listUrl.startsWith("https://yasb.app")) {
      const parts = listUrl.split("yasb.app/");
      if (parts.length >= 2) {
        const dataLink = parts[1]; // "?f=...&d=..."
        upstreamUrl = `https://www.pattern-analyzer.app/api/yasb/xws${dataLink}`;
      }
    } else if (listUrl.startsWith("https://launchbaynext.app")) {
      // LaunchBayNext: pull lbx=... piece
      const idx = listUrl.indexOf("lbx=");
      if (idx !== -1) {
        let value = listUrl.slice(idx + "lbx=".length);
        const ampIdx = value.indexOf("&");
        if (ampIdx !== -1) {
          value = value.slice(0, ampIdx);
        }
        upstreamUrl = `https://launchbaynext.app/api/xws?lbx=${value}`;
      }
    }

    if (!upstreamUrl) return null;

    const res = await fetch(upstreamUrl, { cache: "no-store" });
    if (!res.ok) return null;

    const data = (await res.json()) as XwsResponse;
    return data;
  } catch (err) {
    console.warn("fetchXwsFromListUrlServer error:", err);
    return null;
  }
}

async function syncSingleListXwsAndLetters(
  conn: mysql.Connection,
  weekLabel: string,
  game: string
) {
  // Read current row from lists table
  const [rows] = (await conn.execute(
    "SELECT away_list, home_list FROM lists WHERE week_label = ? AND game = ?",
    [weekLabel, game]
  )) as any;

  if (!rows || rows.length === 0) return;

  const row = rows[0];
  const awayListUrl = String(row.away_list ?? "").trim();
  const homeListUrl = String(row.home_list ?? "").trim();

  // Build xws -> init map from railway.IDs (0001–0726)
  const [idRows] = (await conn.execute(
    "SELECT xws, init FROM railway.IDs WHERE id >= '0001' AND id <= '0726'"
  )) as any;

  const initByXws: InitLookup = new Map();
  for (const r of idRows) {
    const key = r.xws as string | null;
    const initVal = r.init;
    if (!key || initVal == null) continue;
    initByXws.set(String(key), Number(initVal));
  }

  let awayXwsJson: string | null = null;
  let awayLetters: string | null = null;
  let homeXwsJson: string | null = null;
  let homeLetters: string | null = null;

  let awayCount: number | null = null;
  let awayAvgInit: number | null = null;
  let homeCount: number | null = null;
  let homeAvgInit: number | null = null;

  if (awayListUrl && isValidListLink(awayListUrl)) {
    const xws = await fetchXwsFromListUrlServer(awayListUrl);
    if (xws) {
      awayXwsJson = JSON.stringify(xws);
      awayLetters = shipsToGlyphs(xws.pilots ?? []) ?? null;

      const res = computeCountAndAverageInitFromXws(xws, initByXws);
      awayCount = res.count;
      awayAvgInit = res.avgInit;
    }
  }

  if (homeListUrl && isValidListLink(homeListUrl)) {
    const xws = await fetchXwsFromListUrlServer(homeListUrl);
    if (xws) {
      homeXwsJson = JSON.stringify(xws);
      homeLetters = shipsToGlyphs(xws.pilots ?? []) ?? null;

      const res = computeCountAndAverageInitFromXws(xws, initByXws);
      homeCount = res.count;
      homeAvgInit = res.avgInit;
    }
  }

  // If no valid list/XWS, leave count/avg as null (your requirement)
  await conn.execute(
    `
    UPDATE lists
    SET
      away_xws = ?,
      away_letters = ?,
      home_xws = ?,
      home_letters = ?,
      away_count = ?,
      home_count = ?,
      away_average_init = ?,
      home_average_init = ?
    WHERE week_label = ? AND game = ?
  `,
    [
      awayXwsJson,
      awayLetters,
      homeXwsJson,
      homeLetters,
      awayCount,
      homeCount,
      awayAvgInit,
      homeAvgInit,
      weekLabel,
      game,
    ]
  );
}

/* --------------------------- MySQL sync helpers ------------------------- */

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

async function syncCurrentWeek(
  sheets: SheetsClient,
  spreadsheetId: string,
  conn: mysql.Connection
) {
  const weekRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "SCHEDULE!U2",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const raw = weekRes.data.values?.[0]?.[0] ?? "WEEK 1";
  const weekLabel = normalizeWeekLabel(String(raw));

  await conn.execute("DELETE FROM current_week");
  await conn.execute("INSERT INTO current_week (week_label) VALUES (?)", [
    weekLabel,
  ]);

  return weekLabel;
}

// Only update one row in weekly_matchups for this week/game
async function syncSingleWeeklyMatchup(
  sheets: SheetsClient,
  spreadsheetId: string,
  weekTab: string,
  rowNum: number,
  conn: mysql.Connection
) {
  const range = `${weekTab}!A${rowNum}:Q${rowNum}`;
  const rowRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const r0 = rowRes.data.values?.[0];
  if (!r0) return;

  const r = [
    ...r0,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ].slice(0, 17);

  const gameRaw = norm(r[0]);
  const gameNum = parseInt(gameRaw, 10);
  if (!Number.isFinite(gameNum) || gameNum <= 0) return;
  const game = String(gameNum);
  const weekLabel = normalizeWeekLabel(weekTab);

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

  if (!awayTeam && !homeTeam) return;

  await conn.execute(
    "DELETE FROM weekly_matchups WHERE week_label = ? AND game = ?",
    [weekLabel, game]
  );

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

async function syncIndividualStats(
  sheets: SheetsClient,
  spreadsheetId: string,
  conn: mysql.Connection
) {
  const rowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "INDIVIDUAL!A2:V",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = (rowsRes.data.values ?? []) as string[][];

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
    const r = [
      ...r0,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ].slice(0, 22);

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

async function syncAdvStats(
  sheets: SheetsClient,
  spreadsheetId: string,
  conn: mysql.Connection
) {
  // t1
  await conn.execute("DELETE FROM adv_stats_t1");
  {
    const rowsRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "ADV STATS!A2:N25",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = (rowsRes.data.values ?? []) as string[][];
    const sql = `
      INSERT INTO adv_stats_t1 (
        team, total_games, avg_wins, avg_loss, avg_points,
        avg_plms, avg_games, avg_win_pct, avg_ppg,
        avg_efficiency, avg_war, avg_h2h, avg_potato, avg_sos
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;
    for (const r0 of rows) {
      const r = [
        ...r0,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ].slice(0, 14);
      const team = norm(r[0]);
      if (!team) continue;
      await conn.execute(sql, r.map(norm));
    }
  }
  // t2
  await conn.execute("DELETE FROM adv_stats_t2");
  {
    const rowsRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "ADV STATS!A28:I32",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = (rowsRes.data.values ?? []) as string[][];
    const sql = `
      INSERT INTO adv_stats_t2 (
        scenario, avg_home_pts, avg_away_pts, avg_total_pts,
        avg_wpts, avg_lpts, lt20, gte20, total_games
      ) VALUES (?,?,?,?,?,?,?,?,?)
    `;
    for (const r0 of rows) {
      const r = [
        ...r0,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ].slice(0, 9);
      const scenario = norm(r[0]);
      if (!scenario) continue;
      await conn.execute(sql, r.map(norm));
    }
  }
  // t3
  await conn.execute("DELETE FROM adv_stats_t3");
  {
    const rowsRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "ADV STATS!A36:H40",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = (rowsRes.data.values ?? []) as string[][];
    const sql = `
      INSERT INTO adv_stats_t3 (
        scenario, republic, cis, rebels, empire,
        resistance, first_order, scum
      ) VALUES (?,?,?,?,?,?,?,?)
    `;
    for (const r0 of rows) {
      const r = [
        ...r0,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ].slice(0, 8);
      const scenario = norm(r[0]);
      if (!scenario) continue;
      await conn.execute(sql, r.map(norm));
    }
  }
  // t4
  await conn.execute("DELETE FROM adv_stats_t4");
  {
    const rowsRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "ADV STATS!A43:H49",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = (rowsRes.data.values ?? []) as string[][];
    const sql = `
      INSERT INTO adv_stats_t4 (
        faction_vs, republic, cis, rebels, empire,
        resistance, first_order, scum
      ) VALUES (?,?,?,?,?,?,?,?)
    `;
    for (const r0 of rows) {
      const r = [
        ...r0,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ].slice(0, 8);
      const factionVs = norm(r[0]);
      if (!factionVs) continue;
      await conn.execute(sql, r.map(norm));
    }
  }
  // t5
  await conn.execute("DELETE FROM adv_stats_t5");
  {
    const rowsRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "ADV STATS!J36:P42",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = (rowsRes.data.values ?? []) as string[][];
    const sql = `
      INSERT INTO adv_stats_t5 (
        faction, wins, losses, win_pct,
        avg_draft, expected_win_pct, perf_plus_minus
      ) VALUES (?,?,?,?,?,?,?)
    `;
    for (const r0 of rows) {
      const r = [
        ...r0,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ].slice(0, 7);
      const faction = norm(r[0]);
      if (!faction) continue;
      await conn.execute(sql, r.map(norm));
    }
  }
}

async function syncAllTimeStats(
  sheets: SheetsClient,
  statsSheetId: string,
  conn: mysql.Connection
) {
  const rowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: statsSheetId,
    range: "ALL TIME STATS!A2:V500",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = (rowsRes.data.values ?? []) as string[][];

  await conn.execute("DELETE FROM all_time_stats");

  const sql =
    "INSERT INTO all_time_stats (" +
    "ncxid, first_name, last_name, discord, wins, losses, points, plms, games, " +
    "win_pct, ppg, extra, s1, s2, s3, s4, s5, s6, s7, s8, s9, championships" +
    ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

  for (const r0 of rows) {
    const r = [
      ...r0,
      "", "", "", "", "", "", "", "", "", "",
      "", "", "", "", "", "", "", "", "", "", ""
    ].slice(0, 22);

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

async function syncTeamSchedule(
  sheets: SheetsClient,
  spreadsheetId: string,
  conn: mysql.Connection
) {
  const rowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "SCHEDULE!A2:D121",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = (rowsRes.data.values ?? []) as string[][];

  await conn.execute("DELETE FROM team_schedule");

  const sql =
  "INSERT INTO team_schedule (week_label, away_team, home_team) VALUES (?,?,?)";

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

async function syncOverallStandings(
  sheets: SheetsClient,
  spreadsheetId: string,
  conn: mysql.Connection
) {
  const rowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "OVERALL RECORD!A2:F25",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = (rowsRes.data.values ?? []) as string[][];

  await conn.execute("DELETE FROM overall_standings");

  const sql =
  "INSERT INTO overall_standings (team, `rank`, wins, losses, game_wins, points) VALUES (?,?,?,?,?,?)";

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

async function syncLists(
  sheets: SheetsClient,
  spreadsheetId: string,
  conn: mysql.Connection
) {
  const rowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Lists!A2:D",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = (rowsRes.data.values ?? []) as string[][];

  // ⛔️ NO MORE: await conn.execute("DELETE FROM lists");

  const sql = `
    INSERT INTO lists (
      week_label,
      game,
      away_list,
      home_list
    ) VALUES (?,?,?,?)
    ON DUPLICATE KEY UPDATE
      away_list = VALUES(away_list),
      home_list = VALUES(home_list)
  `;

  for (const r0 of rows) {
    const r = [...r0, "", "", "", ""].slice(0, 4);
    const weekRaw = norm(r[0]);
    const game = norm(r[1]);
    const awayList = norm(r[2]) || null;
    const homeList = norm(r[3]) || null;

    if (!weekRaw || !game) continue;

    const weekLabel = normalizeWeekLabel(weekRaw);

    await conn.execute(sql, [weekLabel, game, awayList, homeList]);
  }
}


/* --------------------------- GET /report-game ------------------------- */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json<LookupResult>({ ok: false, reason: "NOT_AUTH" }, { status: 401 });
    }

    const raw = (session.user as any).discordId ?? (session.user as any).id;
    const discordId = normalizeDiscordId(raw);
    if (!discordId) {
      return NextResponse.json<LookupResult>(
        { ok: false, reason: "NO_DISCORD_ID" },
        { status: 400 }
      );
    }

    const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
    const sheets = getSheets();

    const [who, captainTeams] = await Promise.all([
      getNcxIdForDiscord(sheets, spreadsheetId, discordId),
      getCaptainTeamsForDiscord(sheets, spreadsheetId, discordId),
    ]);

    const role = resolveRole(discordId, who, captainTeams);
    if (!role) {
      // No admin, no captain entry, no NCXID map
      return NextResponse.json<LookupResult>(
        { ok: false, reason: "NO_NCXID" },
        { status: 404 }
      );
    }

    const myNcxid = (who?.ncxid ?? "").toUpperCase();
    const captainTeamKeys = captainTeams.map(teamKey);

    // 1) Active week
    const weekRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "SCHEDULE!U2",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const weekTab = norm(weekRes.data.values?.[0]?.[0]) || "WEEK 1";

    // 2) Week rows
    const dataRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${weekTab}!A2:Q120`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = dataRes.data.values ?? [];

    // 3) Lists sheet: WEEK, GAME, AWAY LIST, HOME LIST (fail-soft)
    const listMap = new Map<string, { awayList: string; homeList: string }>();
    try {
      const listsRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Lists!A2:D",
        valueRenderOption: "FORMATTED_VALUE",
      });
      const listRows = listsRes.data.values ?? [];
      for (const r of listRows) {
        const wk = norm(r?.[0]); // WEEK
        const gm = norm(r?.[1]); // GAME
        const awayList = norm(r?.[2]); // AWAY LIST
        const homeList = norm(r?.[3]); // HOME LIST
        if (!wk || !gm) continue;
        listMap.set(`${wk}#${gm}`, { awayList, homeList });
      }
    } catch (e) {
      console.warn("Lists sheet missing or unreadable; continuing without lists:", e);
    }

    const games: GameRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowIndex = i + 2; // header consumed

      const gameCell = norm(r?.[0]); // A
      const awayId = norm(r?.[1]); // B
      const awayName = norm(r?.[2]); // C
      const awayTeam = norm(r?.[3]); // D
      const awayW = norm(r?.[4]); // E
      const awayL = norm(r?.[5]); // F
      const awayPts = norm(r?.[6]); // G
      const awayPlms = norm(r?.[7]); // H
      const homeId = norm(r?.[9]); // J
      const homeName = norm(r?.[10]); // K
      const homeTeam = norm(r?.[11]); // L
      const homeW = norm(r?.[12]); // M
      const homeL = norm(r?.[13]); // N
      const homePts = norm(r?.[14]); // O
      const homePlms = norm(r?.[15]); // P
      const scenario = norm(r?.[16]); // Q

      // Only keep rows where Game is a real number
      const gameNumber = parseInt(gameCell, 10);
      const hasNumericGame =
        Number.isFinite(gameNumber) && gameCell.trim() !== "";

      if (!hasNumericGame || (!awayTeam && !homeTeam)) continue;

      const game = String(gameNumber);

      if (!game || (!awayTeam && !homeTeam)) continue;

      const alreadyFilled = !(awayPts === "" && homePts === "" && scenario === "");

      const awayIdU = awayId.toUpperCase();
      const homeIdU = homeId.toUpperCase();
      const isMyGame =
        !!myNcxid && (awayIdU === myNcxid || homeIdU === myNcxid);

      const awayTeamKey = teamKey(awayTeam);
      const homeTeamKey = teamKey(homeTeam);

      const canEditAwayId =
        role === "admin" ||
        (role === "captain" && captainTeamKeys.includes(awayTeamKey));
      const canEditHomeId =
        role === "admin" ||
        (role === "captain" && captainTeamKeys.includes(homeTeamKey));

      // Determine if THIS row is manageable for this role
      let canManage = false;
      if (role === "admin") {
        canManage = true;
      } else if (role === "captain") {
        const onMyTeam =
          captainTeamKeys.includes(awayTeamKey) ||
          captainTeamKeys.includes(homeTeamKey);
        canManage = onMyTeam || isMyGame;
      } else {
        // player
        canManage = isMyGame;
      }

      if (!canManage) continue;

      const listKey = `${weekTab}#${game}`;
      const lists = listMap.get(listKey);

      games.push({
        rowIndex,
        game,
        away: {
          id: awayId,
          name: awayName,
          team: awayTeam,
          wins: awayW,
          losses: awayL,
          pts: awayPts,
          plms: awayPlms,
        },
        home: {
          id: homeId,
          name: homeName,
          team: homeTeam,
          wins: homeW,
          losses: homeL,
          pts: homePts,
          plms: homePlms,
        },
        scenario,
        alreadyFilled,
        isMyGame,
        canEditAwayId,
        canEditHomeId,
        awayList: lists?.awayList,
        homeList: lists?.homeList,
      });
    }

    if (games.length === 0) {
      return NextResponse.json<LookupResult>(
        { ok: false, reason: "NO_GAME_FOUND" },
        { status: 404 }
      );
    }

    // Sort: my own game(s) first, then by game number
    const sortedGames = [...games].sort((a, b) => {
      const myDiff = (b.isMyGame ? 1 : 0) - (a.isMyGame ? 1 : 0);
      if (myDiff !== 0) return myDiff;
      const ga = parseInt(a.game, 10);
      const gb = parseInt(b.game, 10);
      if (Number.isFinite(ga) && Number.isFinite(gb)) return ga - gb;
      return a.game.localeCompare(b.game);
    });

    const payload: LookupResult = {
      ok: true,
      weekTab,
      role,
      games: sortedGames,
    };

    return NextResponse.json(payload);
  } catch (e) {
    console.error("💥 Lookup error:", e);
    return NextResponse.json<LookupResult>(
      { ok: false, reason: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

/* --------------------------- POST /report-game ------------------------ */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, reason: "NOT_AUTH" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      rowIndex,
      awayPts,
      homePts,
      scenario,
      force,
      newAwayId,
      newHomeId,
      // New: list URLs
      awayList,
      homeList,
    } = body ?? {};

    const cleanScenario = String(scenario ?? "").toUpperCase();
    const hasScoreInputs =
      awayPts !== undefined &&
      homePts !== undefined &&
      cleanScenario.trim() !== "";

    // If scores are being provided, validate them + scenario
    let a: number | undefined;
    let h: number | undefined;
    if (hasScoreInputs) {
      const validScenarios = ["ANCIENT", "CHANCE", "ASSAULT", "SCRAMBLE", "SALVAGE"];
      if (!validScenarios.includes(cleanScenario)) {
        return NextResponse.json(
          { ok: false, reason: "BAD_SCENARIO" },
          { status: 400 }
        );
      }

      a = Number(awayPts);
      h = Number(homePts);
      if (!Number.isFinite(a) || !Number.isFinite(h)) {
        return NextResponse.json(
          { ok: false, reason: "BAD_SCORES" },
          { status: 400 }
        );
      }
    }

    const awayListStr =
      typeof awayList === "string" ? awayList.trim() : "";
    const homeListStr =
      typeof homeList === "string" ? homeList.trim() : "";

    // Validate list URLs if provided
    if (
      (awayListStr && !isValidListLink(awayListStr)) ||
      (homeListStr && !isValidListLink(homeListStr))
    ) {
      return NextResponse.json(
        {
          ok: false,
          reason: "BAD_LIST_LINK",
          message: "Should be a YASB or LBN Link",
        },
        { status: 400 }
      );
    }

    const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
    const statsSheetId = process.env.NCX_STATS_SHEET_ID || spreadsheetId;
    const sheets = getSheets();

    const raw = (session.user as any).discordId ?? (session.user as any).id;
    const discordId = normalizeDiscordId(raw);

    const [who, captainTeams] = await Promise.all([
      getNcxIdForDiscord(sheets, spreadsheetId, discordId),
      getCaptainTeamsForDiscord(sheets, spreadsheetId, discordId),
    ]);

    const role = resolveRole(discordId, who, captainTeams);
    if (!role) {
      return NextResponse.json(
        { ok: false, reason: "NO_NCXID" },
        { status: 404 }
      );
    }
    const myNcxid = (who?.ncxid ?? "").toUpperCase();
    const captainTeamKeys = captainTeams.map(teamKey);

    // Active week
    const weekRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "SCHEDULE!U2",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const weekTab = norm(weekRes.data.values?.[0]?.[0]) || "WEEK 1";
    const canonicalWeekLabel = normalizeWeekLabel(weekTab);

    // Confirm the row exists
    const rowNum = Number(rowIndex);
    const rowRange = `${weekTab}!A${rowNum}:Q${rowNum}`;
    const rowRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rowRange,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const row = rowRes.data.values?.[0] ?? [];

    const gameNo = norm(row?.[0]); // A
    const awayId = norm(row?.[1]); // B
    const awayName = norm(row?.[2]); // C
    const awayTeam = norm(row?.[3]); // D
    const homeId = norm(row?.[9]); // J
    const homeName = norm(row?.[10]); // K
    const homeTeam = norm(row?.[11]); // L

    const awayTeamKey = teamKey(awayTeam);
    const homeTeamKey = teamKey(homeTeam);

    // Permission: who is allowed to report this row?
    let canReport = false;
    if (role === "admin") {
      canReport = true;
    } else if (role === "captain") {
      const onMyTeam =
        captainTeamKeys.includes(awayTeamKey) ||
        captainTeamKeys.includes(homeTeamKey);
      const awayIdU = awayId.toUpperCase();
      const homeIdU = homeId.toUpperCase();
      const isMyGame =
        !!myNcxid && (awayIdU === myNcxid || homeIdU === myNcxid);
      canReport = onMyTeam || isMyGame;
    } else {
      // player
      const awayIdU = awayId.toUpperCase();
      const homeIdU = homeId.toUpperCase();
      canReport =
        !!myNcxid && (awayIdU === myNcxid || homeIdU === myNcxid);
    }

    if (!canReport) {
      return NextResponse.json(
        { ok: false, reason: "ROW_NOT_YOURS" },
        { status: 403 }
      );
    }

    const curAway = norm(row?.[6]);
    const curHome = norm(row?.[14]);
    const curScen = norm(row?.[16]);
    const alreadyFilled = !(curAway === "" && curHome === "" && curScen === "");

    // Only require overwrite confirmation if we are actually changing scores.
    if (hasScoreInputs && alreadyFilled && !force) {
      return NextResponse.json(
        {
          ok: false,
          reason: "ALREADY_FILLED",
          current: { awayPts: curAway, homePts: curHome, scenario: curScen },
        },
        { status: 409 }
      );
    }

    // Build batch updates for main week tab
    const batchData: { range: string; values: any[][] }[] = [];

    // Scores + scenario (if provided)
    if (hasScoreInputs && a !== undefined && h !== undefined) {
      batchData.push(
        { range: `${weekTab}!G${rowNum}`, values: [[a]] }, // Away score
        { range: `${weekTab}!O${rowNum}`, values: [[h]] }, // Home score
        { range: `${weekTab}!Q${rowNum}`, values: [[cleanScenario]] } // Scenario
      );
    }

    // NCXID updates (captain/admin only, depending on side)
    const newAwayIdStr =
      typeof newAwayId === "string" ? newAwayId.trim() : undefined;
    const newHomeIdStr =
      typeof newHomeId === "string" ? newHomeId.trim() : undefined;

    const canEditAwayId =
      role === "admin" ||
      (role === "captain" && captainTeamKeys.includes(awayTeamKey));
    const canEditHomeId =
      role === "admin" ||
      (role === "captain" && captainTeamKeys.includes(homeTeamKey));

    if (newAwayIdStr !== undefined && canEditAwayId && newAwayIdStr !== awayId) {
      batchData.push({
        range: `${weekTab}!B${rowNum}`,
        values: [[newAwayIdStr]],
      });
    }

    if (newHomeIdStr !== undefined && canEditHomeId && newHomeIdStr !== homeId) {
      batchData.push({
        range: `${weekTab}!J${rowNum}`,
        values: [[newHomeIdStr]],
      });
    }

    let didMainUpdate = false;

    // Write main week-tab changes if any
    if (batchData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: batchData,
        },
      });
      didMainUpdate = true;

      // Optional: enforce number formatting for scores (if we touched them)
      if (hasScoreInputs) {
        try {
          const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
          const weekSheet = spreadsheet.data.sheets?.find(
            (s) => s.properties?.title === weekTab
          );
          const sheetId = weekSheet?.properties?.sheetId;

          if (sheetId != null) {
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    repeatCell: {
                      range: {
                        sheetId,
                        startRowIndex: rowNum - 1,
                        endRowIndex: rowNum,
                        startColumnIndex: 6,
                        endColumnIndex: 7,
                      },
                      cell: {
                        userEnteredFormat: {
                          numberFormat: { type: "NUMBER", pattern: "0" },
                        },
                      },
                      fields: "userEnteredFormat.numberFormat",
                    },
                  },
                  {
                    repeatCell: {
                      range: {
                        sheetId,
                        startRowIndex: rowNum - 1,
                        endRowIndex: rowNum,
                        startColumnIndex: 14,
                        endColumnIndex: 15,
                      },
                      cell: {
                        userEnteredFormat: {
                          numberFormat: { type: "NUMBER", pattern: "0" },
                        },
                      },
                      fields: "userEnteredFormat.numberFormat",
                    },
                  },
                ],
              },
            });
          }
        } catch (fmtErr) {
          console.warn("⚠️ Formatting skipped/failed:", fmtErr);
        }
      }
    }

    // ---- Lists sheet upsert (optional) ----
    let didListsUpdate = false;
    if (awayListStr || homeListStr) {
      try {
        const listsRange = "Lists!A2:D";
        const listsRes = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: listsRange,
          valueRenderOption: "FORMATTED_VALUE",
        });
        const listsRows = listsRes.data.values ?? [];

        let matchIndex = -1;
        for (let i = 0; i < listsRows.length; i++) {
          const wk = norm(listsRows[i]?.[0]);
          const gm = norm(listsRows[i]?.[1]);
          if (wk === weekTab && gm === gameNo) {
            matchIndex = i;
            break;
          }
        }

        const listsTitle = "Lists";

        if (matchIndex >= 0) {
          // Update existing row
          const listRowNum = matchIndex + 2;
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${listsTitle}!A${listRowNum}:D${listRowNum}`,
            valueInputOption: "RAW",
            requestBody: {
              values: [
                [
                  weekTab,
                  gameNo,
                  awayListStr || "",
                  homeListStr || "",
                ],
              ],
            },
          });
        } else {
          // Append new row
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${listsTitle}!A2:D2`,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: {
              values: [
                [
                  weekTab,
                  gameNo,
                  awayListStr || "",
                  homeListStr || "",
                ],
              ],
            },
          });
        }

        didListsUpdate = true;
      } catch (e) {
        console.warn("⚠️ Lists sheet update/append failed:", e);
      }
    }

    // If literally nothing changed anywhere, just say OK
    if (!didMainUpdate && !didListsUpdate) {
      return NextResponse.json({ ok: true, pushed: 0 });
    }

    // ---- Streamer.bot overlay + Discord + push only if scores were updated ----
    let pushed = 0;

    if (hasScoreInputs && a !== undefined && h !== undefined) {
      // Streamer.bot overlay push (mirrors Discord bot)
      try {
        const sbUrl = process.env.STREAMERBOT_URL;
        const sbActionId = process.env.STREAMERBOT_ACTION_ID;

        if (sbUrl && sbActionId) {
          const payload = {
            action: { id: sbActionId, name: "Score Update" },
            args: {
              away: `${awayName} - ${awayTeam} - ${a}`,
              home: `${homeName} - ${homeTeam} - ${h}`,
            },
          };

          await fetch(sbUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } else {
          console.warn("Streamer.bot env not set; skipping overlay call.");
        }
      } catch (e) {
        console.warn("⚠️ Streamer.bot overlay call failed:", e);
      }

      // Discord webhook
      const webhook = process.env.DISCORD_WEBHOOK_URL;
      if (webhook) {
        const mention = `<@${discordId}>`;
        const content =
          `✅ **Game Reported**\n` +
          `**Week:** ${weekTab}\n` +
          `**Game #:** ${gameNo}\n` +
          `**Away:** ${awayTeam} • ${awayName} — ${a}\n` +
          `**Home:** ${homeTeam} • ${homeName} — ${h}\n` +
          `**Scenario:** ${cleanScenario}\n` +
          `**By:** ${mention} (${who?.ncxid ?? ""} - ${who?.first ?? ""} ${
            who?.last ?? ""
          })`;

        try {
          await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          });
        } catch (e) {
          console.warn("⚠️ Webhook post failed:", e);
        }
      }

      // Push notifications (filtered by teams)
      try {
        const title = `Game ${gameNo}`;
        const bodyText = `${awayName} - ${awayTeam} ${a} — ${h} ${homeTeam} - ${homeName}`;
        const url = "/m/current"

        pushed = await sendPushForTeams([awayTeam, homeTeam], {
          title,
          body: bodyText,
          url,
        });
      } catch (pushErr) {
        console.warn("⚠️ Push send failed:", pushErr);
      }
    }

    // ---- MySQL sync from Sheets (incremental) + XWS glyphs for this game ----
    try {
      const conn = await getMySqlConn();
      try {
        // 1) current_week (single row)
        await syncCurrentWeek(sheets, spreadsheetId, conn);

        // 2) weekly_matchups -> only this one game (weekTab + rowNum)
        await syncSingleWeeklyMatchup(
          sheets,
          spreadsheetId,
          weekTab,
          rowNum,
          conn
        );

        // 3) individual_stats (full refresh)
        await syncIndividualStats(sheets, spreadsheetId, conn);

        // 4) advanced stats (t1..t5, full refresh)
        await syncAdvStats(sheets, spreadsheetId, conn);

        // 5) all_time_stats (full refresh from stats sheet)
        await syncAllTimeStats(sheets, statsSheetId, conn);

        // 6) team_schedule (full refresh)
        await syncTeamSchedule(sheets, spreadsheetId, conn);

        // 7) overall_standings (full refresh)
        await syncOverallStandings(sheets, spreadsheetId, conn);

        // 8) lists (full refresh of URLs)
        await syncLists(sheets, spreadsheetId, conn);

        // 9) For this specific game, resolve XWS + glyph letters into S9.lists
        if (gameNo) {
          await syncSingleListXwsAndLetters(conn, canonicalWeekLabel, gameNo);
        }
      } finally {
        await conn.end();
      }
    } catch (syncErr) {
      console.error("⚠️ MySQL sync after report failed:", syncErr);
      // Don't fail the report if DB sync fails; Sheets is canonical.
    }

    return NextResponse.json({ ok: true, pushed });
  } catch (e) {
    console.error("💥 Report POST error:", e);
    return NextResponse.json(
      { ok: false, reason: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
