import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getSheets,
  fetchMatchupsDataCached,
  fetchListsForWeekCached,
} from "@/lib/googleSheets";
import { getCaptainTeams } from "@/lib/captains";
import { pool } from "@/lib/db";
import { sql } from "@vercel/postgres";
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

const ADMIN_DISCORD_IDS = ["349349801076195329", "986330724212801557"] as const;

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

async function sendPushForTeams(
  category: "game" | "series",
  teams: string[],
  payload: { title: string; body: string; url: string },
  trigger: string
) {
  try {
    const { sendPushToCategory } = await import("@/lib/fcm");
    const result = await sendPushToCategory(category, teams, payload, trigger);
    console.log(
      `[report-game] FCM category=${category} sent=${result.sent}, failed=${result.failed}`
    );
    return result.sent + result.failed;
  } catch (e) {
    console.error("Failed to send FCM notifications:", e);
    return 0;
  }
}

/* ------------------------- Role helpers ------------------------- */

// MySQL-backed lookup. The S9.discord_map table is refreshed every reseed
// and stays consistent with the Discord_ID Sheet tab.
async function getNcxIdForDiscord(discordId: string) {
  if (!discordId) return null;
  const [rows] = await pool.query<any[]>(
    `SELECT ncxid, first_name, last_name FROM S9.discord_map WHERE discord_id = ? LIMIT 1`,
    [discordId]
  );
  const hit = (rows ?? [])[0];
  if (!hit) return null;
  return {
    ncxid: String(hit.ncxid ?? ""),
    first: String(hit.first_name ?? ""),
    last: String(hit.last_name ?? ""),
  };
}

// Captain lookup moved to MySQL — see `src/lib/captains.ts`. The old
// per-call NCXID!K2:O25 Sheets read is gone (S9.captains is refreshed
// by /api/seed-mysql).

// Fire-and-forget seed trigger. Used at the end of a successful report
// to refresh MySQL from the Sheet in the background, so the response
// returns immediately. Replaces the old inline 8-step sync block.
//
// The Railway Node runtime keeps the process alive after the response,
// so the in-flight fetch completes. On serverless platforms this would
// need `waitUntil`, but NCX runs on Railway.
function triggerSeedInBackground(): void {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const key = process.env.SEED_API_KEY;
  if (!key) {
    console.warn("⚠️ Skipping background seed — SEED_API_KEY not set");
    return;
  }

  const url = `${baseUrl}/api/seed-mysql?key=${encodeURIComponent(key)}`;
  void fetch(url, { method: "GET", cache: "no-store" })
    .then(async (res) => {
      if (res.ok) {
        const json = await res.json().catch(() => null);
        console.log(
          `[report-game] background seed ok in ${json?.elapsed_ms ?? "?"}ms (${json?.total_rows_written ?? "?"} rows)`
        );
      } else {
        console.warn(`⚠️ Background seed returned ${res.status}`);
      }
    })
    .catch((e) => {
      console.warn("⚠️ Background seed trigger failed:", e);
    });
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
  captainTeams: string[],
  isAppleAuth?: boolean
): Role | null {
  // Apple auth users get admin access when demo mode is on (for App Store review)
  if (isAppleAuth && process.env.DEMO_MODE === "true") {
    return "admin";
  }
  if (ADMIN_DISCORD_IDS.includes(discordId)) return "admin";
  if (captainTeams.length > 0) return "captain";
  if (who?.ncxid) return "player";
  return null;
}


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



/* --------------------------- GET /report-game ------------------------- */
export async function GET(request: NextRequest) {
  try {
    // Native app auth: accept x-discord-id header as fallback
    const nativeDiscordId = request.headers.get("x-discord-id");
    const session = nativeDiscordId ? null : await getServerSession(authOptions);

    if (!session?.user && !nativeDiscordId) {
      return NextResponse.json<LookupResult>({ ok: false, reason: "NOT_AUTH" }, { status: 401 });
    }

    // Check if this is Apple auth — either from native app (apple- prefix) or web session
    const isNativeAppleAuth = nativeDiscordId?.startsWith("apple-") ?? false;
    const appPlatform = request.headers.get("x-app-platform");
    const isWebAppleAuth = !nativeDiscordId && (session?.user as any)?.provider === "apple" && appPlatform === "ios";
    const isAppleAuth = isNativeAppleAuth || isWebAppleAuth;

    const raw = nativeDiscordId ?? (session?.user as any)?.discordId ?? (session?.user as any)?.id;
    const discordId = isNativeAppleAuth ? "" : normalizeDiscordId(raw);
    if (!discordId && !isAppleAuth) {
      return NextResponse.json<LookupResult>(
        { ok: false, reason: "NO_DISCORD_ID" },
        { status: 400 }
      );
    }

    const [who, captainTeams] = await Promise.all([
      getNcxIdForDiscord(discordId || ""),
      getCaptainTeams(discordId || ""),
    ]);

    const role = resolveRole(discordId || "", who, captainTeams, isAppleAuth);
    if (!role) {
      // No admin, no captain entry, no NCXID map
      return NextResponse.json<LookupResult>(
        { ok: false, reason: "NO_NCXID" },
        { status: 404 }
      );
    }

    const myNcxid = (who?.ncxid ?? "").toUpperCase();
    const captainTeamKeys = captainTeams.map(teamKey);

    // 1) Active week — pulled from MySQL (refreshed every reseed)
    const [cwRows] = await pool.query<any[]>(
      "SELECT week_label FROM S9.current_week LIMIT 1"
    );
    const weekTab = norm(cwRows?.[0]?.week_label) || "WEEK 1";

    // 2) Week rows + Lists both from MySQL (previously two Sheets reads).
    // seed-mysql keeps these in sync with the spreadsheet.
    const [matchupsData, listsData] = await Promise.all([
      fetchMatchupsDataCached(weekTab),
      fetchListsForWeekCached(weekTab),
    ]);

    const dbRows = matchupsData.matches;
    const listMap = new Map<string, { awayList: string; homeList: string }>();
    for (const [game, entry] of Object.entries(listsData.listsMap ?? {})) {
      listMap.set(`${weekTab}#${game}`, {
        awayList: entry.awayList ?? "",
        homeList: entry.homeList ?? "",
      });
    }

    const games: GameRow[] = [];

    for (const dbRow of dbRows) {
      const gameCell = norm(dbRow.game);
      const awayId = norm(dbRow.awayId);
      const awayName = norm(dbRow.awayName);
      const awayTeam = norm(dbRow.awayTeam);
      const awayW = norm(dbRow.awayW);
      const awayL = norm(dbRow.awayL);
      const awayPts = norm(dbRow.awayPts);
      const awayPlms = norm(dbRow.awayPLMS);
      const homeId = norm(dbRow.homeId);
      const homeName = norm(dbRow.homeName);
      const homeTeam = norm(dbRow.homeTeam);
      const homeW = norm(dbRow.homeW);
      const homeL = norm(dbRow.homeL);
      const homePts = norm(dbRow.homePts);
      const homePlms = norm(dbRow.homePLMS);
      const scenario = norm(dbRow.scenario);

      const gameNumber = parseInt(gameCell, 10);
      const hasNumericGame =
        Number.isFinite(gameNumber) && gameCell.trim() !== "";

      if (!hasNumericGame || (!awayTeam && !homeTeam)) continue;

      const game = String(gameNumber);
      // rowIndex is the actual Google Sheet row number, stored by seed-mysql.
      // The sheet has 3-row gaps between series, so game N != row N+1.
      // Skip if unseeded (shouldn't happen post-deploy; seed populates it).
      const rowIndex = Number(dbRow.rowIndex) || 0;
      if (!rowIndex) continue;

      // A game is reported iff scenario is set. Pts columns are INT with 0
      // for empty sheet cells (post seed-mysql bulk-insert refactor), so pts
      // alone no longer distinguish unreported from a genuine 0-0 tie.
      const alreadyFilled = scenario !== "";
      const displayAwayPts = alreadyFilled ? awayPts : "";
      const displayHomePts = alreadyFilled ? homePts : "";

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
          pts: displayAwayPts,
          plms: awayPlms,
        },
        home: {
          id: homeId,
          name: homeName,
          team: homeTeam,
          wins: homeW,
          losses: homeL,
          pts: displayHomePts,
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
export async function POST(req: NextRequest) {
  try {
    // Native app auth: accept x-discord-id header as fallback
    const nativeDiscordId = req.headers.get("x-discord-id");
    const session = nativeDiscordId ? null : await getServerSession(authOptions);

    if (!session?.user && !nativeDiscordId) {
      return NextResponse.json({ ok: false, reason: "NOT_AUTH" }, { status: 401 });
    }

    // Check if this is Apple auth — either from native app (apple- prefix) or web session
    const isNativeAppleAuthPost = nativeDiscordId?.startsWith("apple-") ?? false;
    const appPlatform = req.headers.get("x-app-platform");
    const isWebAppleAuthPost = !nativeDiscordId && (session?.user as any)?.provider === "apple" && appPlatform === "ios";
    const isAppleAuth = isNativeAppleAuthPost || isWebAppleAuthPost;

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
    const sheets = getSheets();

    const raw = nativeDiscordId ?? (session?.user as any)?.discordId ?? (session?.user as any)?.id;
    const discordId = isNativeAppleAuthPost ? "" : normalizeDiscordId(raw);

    const [who, captainTeams] = await Promise.all([
      getNcxIdForDiscord(discordId || ""),
      getCaptainTeams(discordId || ""),
    ]);

    const role = resolveRole(discordId || "", who, captainTeams, isAppleAuth);
    if (!role) {
      return NextResponse.json(
        { ok: false, reason: "NO_NCXID" },
        { status: 404 }
      );
    }
    const myNcxid = (who?.ncxid ?? "").toUpperCase();
    const captainTeamKeys = captainTeams.map(teamKey);

    // Active week — pulled from MySQL (S9.current_week is refreshed every
    // reseed and stays in sync with the SCHEDULE!U2 cell).
    const [cwRows] = await pool.query<any[]>(
      "SELECT week_label FROM S9.current_week LIMIT 1"
    );
    const weekTab = norm(cwRows?.[0]?.week_label) || "WEEK 1";
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

    // ---- Run main week-tab write and Lists sheet upsert in parallel ----
    // Both are independent Sheets API round-trips; no reason to chain them.

    const wantsMainUpdate = batchData.length > 0;
    const wantsListsUpdate = !!(awayListStr || homeListStr);

    const writeMain = async (): Promise<boolean> => {
      if (!wantsMainUpdate) return false;
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: "RAW", data: batchData },
      });
      return true;
    };

    const writeLists = async (): Promise<boolean> => {
      if (!wantsListsUpdate) return false;
      try {
        const listsRes = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "Lists!A2:D",
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

        const values = [[weekTab, gameNo, awayListStr || "", homeListStr || ""]];

        if (matchIndex >= 0) {
          const listRowNum = matchIndex + 2;
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Lists!A${listRowNum}:D${listRowNum}`,
            valueInputOption: "RAW",
            requestBody: { values },
          });
        } else {
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: "Lists!A2:D2",
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values },
          });
        }
        return true;
      } catch (e) {
        console.warn("⚠️ Lists sheet update/append failed:", e);
        return false;
      }
    };

    const [didMainUpdate, didListsUpdate] = await Promise.all([
      writeMain(),
      writeLists(),
    ]);

    // If a score was successfully reported, auto-end any live stream marker
    // for this game: delete the S9.live_matchups row + the CL-4W webhook
    // announcement message from the #live channel.
    if (didMainUpdate && hasScoreInputs && gameNo) {
      void (async () => {
        try {
          const { endLiveMatchupRow } = await import("@/lib/liveMatchups");
          await endLiveMatchupRow(canonicalWeekLabel, gameNo);
        } catch (e) {
          console.warn("⚠️ auto-end live on report-game failed:", e);
        }
      })();
    }

    // ---- Fire-and-forget: enforce score-cell number format ----
    // Cosmetic only; the values themselves are already numeric. Don't block
    // the response on this round-trip.
    if (didMainUpdate && hasScoreInputs) {
      void (async () => {
        try {
          const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
          const weekSheet = spreadsheet.data.sheets?.find(
            (s) => s.properties?.title === weekTab
          );
          const sheetId = weekSheet?.properties?.sheetId;
          if (sheetId == null) return;

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
        } catch (fmtErr) {
          console.warn("⚠️ Background formatting failed:", fmtErr);
        }
      })();
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

        pushed = await sendPushForTeams(
          "game",
          [awayTeam, homeTeam],
          { title, body: bodyText, url },
          `report-game: ${canonicalWeekLabel} G${gameNo} ${awayTeam} v ${homeTeam}`
        );
      } catch (pushErr) {
        console.warn("⚠️ Push send failed:", pushErr);
      }
    }

    // ---- Series clinch push notification ----
    // (Runs BEFORE the background seed so it reads consistent pre-seed
    //  weekly_matchups data — the seed's DELETE+INSERT could otherwise
    //  race with this SELECT.)
    if (hasScoreInputs && a !== undefined && h !== undefined && Number(a) > 0 && Number(h) > 0 && gameNo) {
      try {
        const conn = await getMySqlConn();
        try {
          // Count wins in the series EXCLUDING the current game, so we can detect
          // the transition this report causes. Without this exclusion, the clinch
          // notification fires on every subsequent game in an already-decided series
          // (e.g. 4-1 clinch fires again at 4-2, 4-3).
          const [priorRows] = await conn.execute<any[]>(
            `SELECT awayPts, homePts FROM S9.weekly_matchups
             WHERE week_label = ? AND awayTeam = ? AND homeTeam = ?
             AND game <> ?
             AND awayPts > 0 AND homePts > 0`,
            [canonicalWeekLabel, awayTeam, homeTeam, gameNo]
          );

          let priorAwayWins = 0;
          let priorHomeWins = 0;
          for (const row of priorRows ?? []) {
            if (Number(row.awayPts) > Number(row.homePts)) priorAwayWins++;
            else if (Number(row.homePts) > Number(row.awayPts)) priorHomeWins++;
          }

          const awayWonThisGame = Number(a) > Number(h);
          const homeWonThisGame = Number(h) > Number(a);
          const newAwayWins = priorAwayWins + (awayWonThisGame ? 1 : 0);
          const newHomeWins = priorHomeWins + (homeWonThisGame ? 1 : 0);

          const awayJustClinched = priorAwayWins === 3 && awayWonThisGame;
          const homeJustClinched = priorHomeWins === 3 && homeWonThisGame;

          if (awayJustClinched || homeJustClinched) {
            const winner = awayJustClinched ? awayTeam : homeTeam;
            const loser = awayJustClinched ? homeTeam : awayTeam;
            const weekNum = canonicalWeekLabel.replace(/^WEEK\s*/i, "");

            try {
              await sendPushForTeams(
                "series",
                [awayTeam, homeTeam],
                {
                  title: "Series Complete",
                  body: `${winner} has defeated ${loser} in WEEK ${weekNum}`,
                  url: "/m/current",
                },
                `report-game: WEEK ${weekNum} ${winner} def ${loser}`
              );
            } catch (clinchPushErr) {
              console.warn("⚠️ Series clinch push failed:", clinchPushErr);
            }
          } else if (newAwayWins === 3 && newHomeWins === 3) {
            try {
              await sendPushForTeams(
                "series",
                [awayTeam, homeTeam],
                {
                  title: "GAME 7 ALERT",
                  body: `${awayTeam} v ${homeTeam} is going to GAME 7`,
                  url: "/m/current",
                },
                `report-game: ${canonicalWeekLabel} ${awayTeam} v ${homeTeam}`
              );
            } catch (game7PushErr) {
              console.warn("⚠️ Game 7 alert push failed:", game7PushErr);
            }
          }
        } finally {
          await conn.end();
        }
      } catch (clinchErr) {
        console.warn("⚠️ Series clinch check failed:", clinchErr);
      }
    }

    // ---- Background seed: refresh MySQL from the Sheet without blocking
    //      the response. UI polls, so it'll catch up within a few seconds.
    triggerSeedInBackground();

    return NextResponse.json({ ok: true, pushed });
  } catch (e) {
    console.error("💥 Report POST error:", e);
    return NextResponse.json(
      { ok: false, reason: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
