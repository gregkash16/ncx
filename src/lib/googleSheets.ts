import { google, sheets_v4 } from "googleapis";
import { unstable_cache } from "next/cache";

/**
 * Build an authenticated Google Sheets client using a service account.
 * Requires:
 *  - GOOGLE_SERVICE_ACCOUNT_EMAIL
 *  - GOOGLE_SERVICE_ACCOUNT_KEY  (private key with \n escaped)
 */
export function getSheets(): sheets_v4.Sheets {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!email || !key) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_KEY"
    );
  }

  // If the key is provided with literal \n, turn them into real newlines.
  key = key.replace(/\\n/g, "\n");

  const jwt = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth: jwt });
}

/** ---------- Utility ---------- */

function norm(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "").trim().replace(/[<@!>]/g, "").replace(/\D/g, "");
}

/** tiny 429 retry/backoff */
async function withBackoff<T>(
  fn: () => Promise<T>,
  tries = 4,
  base = 250
): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    const is429 = e?.code === 429 || e?.response?.status === 429;
    if (is429 && tries > 1) {
      const jitter = Math.floor(Math.random() * 150);
      const delay = base * Math.pow(2, 4 - tries) + jitter; // 250, 500, 1000...
      await new Promise((r) => setTimeout(r, delay));
      return withBackoff(fn, tries - 1, base);
    }
    throw e;
  }
}

/** ---------- Matchups (week) ---------- */

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
  /** Derived: 7-game blocks -> 1,2,3... (based on A=game number) */
  seriesNo: number;
};

export type MatchupsData = {
  weekTab: string;
  matches: MatchRow[];
};

/**
 * Reads SCHEDULE!U2 to discover the active week tab (e.g. "WEEK 3"),
 * then loads that tab's A2:Q120 and returns normalized match rows.
 */
export async function fetchMatchupsData(): Promise<MatchupsData> {
  const sheets = getSheets();
  const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
  if (!spreadsheetId) throw new Error("Missing NCX_LEAGUE_SHEET_ID");

  // 1) Active week tab name from SCHEDULE!U2
  const weekRes = await withBackoff(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "SCHEDULE!U2",
      valueRenderOption: "FORMATTED_VALUE",
    })
  );
  const weekTab = norm(weekRes.data.values?.[0]?.[0]) || "WEEK 1";

  // 2) Week data A2:Q120
  const dataRes = await withBackoff(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${weekTab}!A2:Q120`,
      valueRenderOption: "FORMATTED_VALUE",
    })
  );
  const rows = dataRes.data.values || [];

  // 3) Normalize and filter
  const matches: MatchRow[] = rows
    .map((r) => {
      const game = norm(r?.[0]);
      const awayTeam = norm(r?.[3]);
      const homeTeam = norm(r?.[11]);

      // derive seriesNo: games 1–7 => 1, 8–14 => 2, etc.
      const nGame = Number(game);
      const seriesNo =
        Number.isFinite(nGame) && nGame > 0 ? Math.ceil(nGame / 7) : 0;

      return {
        game,
        awayId: norm(r?.[1]),
        awayName: norm(r?.[2]),
        awayTeam,
        awayW: norm(r?.[4]),
        awayL: norm(r?.[5]),
        awayPts: norm(r?.[6]),
        awayPLMS: norm(r?.[7]),
        homeId: norm(r?.[9]),
        homeName: norm(r?.[10]),
        homeTeam,
        homeW: norm(r?.[12]),
        homeL: norm(r?.[13]),
        homePts: norm(r?.[14]),
        homePLMS: norm(r?.[15]),
        scenario: norm(r?.[16]),
        seriesNo,
      };
    })
    // Keep only rows that have a game number and at least one team present
    .filter((m) => m.game !== "" && (m.awayTeam !== "" || m.homeTeam !== ""));

  return { weekTab, matches };
}

/** Cached wrapper (reduces quota). Revalidates every 60s. */
export const fetchMatchupsDataCached = unstable_cache(
  async () => fetchMatchupsData(),
  ["matchups-data"],
  { revalidate: 60 }
);

/** ---------- Individual stats ---------- */

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
  const sheets = getSheets();
  const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
  const res = await withBackoff(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "INDIVIDUAL!A2:V",
      valueRenderOption: "FORMATTED_VALUE",
    })
  );

  const rows = res.data.values ?? [];
  return rows
    .filter((r) => (r?.[0] ?? "").toString().trim() !== "") // keep rows with a Rank
    .map((r): IndRow => ({
      rank: r[0] ?? "",
      ncxid: r[1] ?? "",
      first: r[2] ?? "",
      last: r[3] ?? "",
      discord: r[4] ?? "",
      pick: r[5] ?? "",
      team: r[6] ?? "",
      faction: r[7] ?? "",
      wins: r[8] ?? "",
      losses: r[9] ?? "",
      points: r[10] ?? "",
      plms: r[11] ?? "",
      games: r[12] ?? "",
      winPct: r[13] ?? "",
      ppg: r[14] ?? "",
      efficiency: r[15] ?? "",
      war: r[16] ?? "",
      h2h: r[17] ?? "",
      potato: r[18] ?? "",
      sos: r[19] ?? "",
      predWins: r[20] ?? "",
      predLosses: r[21] ?? "",
    }));
}

/** Cached wrapper. Revalidates every 5 min. */
export const fetchIndStatsDataCached = unstable_cache(
  async () => fetchIndStatsData(),
  ["indstats-data"],
  { revalidate: 300 }
);

/** ---------- Stream schedule (M3 + A2:I) ---------- */

export type StreamSchedule = {
  scheduleWeek: string; // value from M3
  scheduleMap: Record<
    string, // game number as text, e.g. "13"
    { day: string; slot: string } // e.g. { day: "THURSDAY", slot: "GAME 1" }
  >;
};

/**
 * Reads:
 *  - M3 (current stream week)
 *  - A2:I50 (rows with Day, Game slot, Game number, etc.)
 *
 * Expected layout:
 *  - Rows 2-4: TUESDAY
 *  - Rows 6-8: THURSDAY
 *  - A: Day, B: Slot ("Game 1"..."Game 3"), C: Game number (matches MatchupsPanel game)
 */
export async function fetchStreamSchedule(): Promise<StreamSchedule> {
  const sheets = getSheets();

  const sheetId =
    process.env.STREAM_SCHEDULE_SHEET_ID ||
    process.env.NCX_STREAM_SCHEDULE_SHEET_ID;

  if (!sheetId) {
    throw new Error(
      "Missing STREAM_SCHEDULE_SHEET_ID (or NCX_STREAM_SCHEDULE_SHEET_ID)"
    );
  }

  const [m3Resp, gridResp] = await Promise.all([
    withBackoff(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "M3",
        valueRenderOption: "FORMATTED_VALUE",
      })
    ),
    withBackoff(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "A2:I50", // buffer that includes rows 2–8
        valueRenderOption: "FORMATTED_VALUE",
      })
    ),
  ]);

  const scheduleWeek = (m3Resp.data.values?.[0]?.[0] ?? "").toString().trim();

  const rows = gridResp.data.values ?? [];
  const scheduleMap: StreamSchedule["scheduleMap"] = {};

  for (const r of rows) {
    const day = (r?.[0] ?? "").toString().trim(); // A
    const slot = (r?.[1] ?? "").toString().trim(); // B (e.g. "Game 1")
    const game = (r?.[2] ?? "").toString().trim(); // C (e.g. "13")

    if (!day || !slot || !game) continue;

    scheduleMap[game] = {
      day: day.toUpperCase(), // "TUESDAY" / "THURSDAY"
      slot: slot.toUpperCase(), // "GAME 1" / "GAME 2" / "GAME 3"
    };
  }

  return { scheduleWeek, scheduleMap };
}

/** Cached wrapper. Revalidates every 5 min. */
export const fetchStreamScheduleCached = unstable_cache(
  async () => {
    try {
      return await fetchStreamSchedule();
    } catch {
      // Fail-soft: if not configured, don't throw—return empty.
      return { scheduleWeek: "", scheduleMap: {} as StreamSchedule["scheduleMap"] };
    }
  },
  ["stream-schedule"],
  { revalidate: 300 }
);

/** ---------- Discord map (for welcome banner) ---------- */
// Return a plain object so unstable_cache can serialize it
export const getDiscordMapCached = unstable_cache(
  async (): Promise<Record<string, { ncxid: string; first: string; last: string }>> => {
    const sheets = getSheets();
    const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
    const res = await withBackoff(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Discord_ID!A:D",
        valueRenderOption: "FORMATTED_VALUE",
      })
    );
    const rows = res.data.values || [];

    const obj: Record<string, { ncxid: string; first: string; last: string }> = {};
    for (const r of rows) {
      const ncxid = String(r?.[0] ?? "").trim();
      const first  = String(r?.[1] ?? "").trim();
      const last   = String(r?.[2] ?? "").trim();
      const discRaw = String(r?.[3] ?? "");
      const discordId = discRaw.trim().replace(/[<@!>]/g, "").replace(/\D/g, "");
      if (discordId) {
        obj[discordId] = { ncxid, first, last };
      }
    }
    return obj;
  },
  ["discord-map"],
  { revalidate: 300 }
);

// --- NEW: Faction map loader -------------------------------------------------
export type FactionMap = Record<string, string>; // ncxid -> "REBELS" | "EMPIRE" | ...

let __factionMapCache: { data: FactionMap; at: number } | null = null;
const FIVE_MIN = 5 * 60 * 1000;

export async function fetchFactionMapCached(): Promise<FactionMap> {
  if (__factionMapCache && Date.now() - __factionMapCache.at < FIVE_MIN) {
    return __factionMapCache.data;
  }

  const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
  const sheets = await getSheets();

  // Read YES/NO switch from K28 on the NCXID tab
  const switchRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "NCXID!K28",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const switchVal = ((switchRes.data.values?.[0]?.[0] ?? "") as string).trim().toUpperCase();
  const useSwitch = switchVal === "YES";

  // Read A2:I215 → need A (NCXID), H (Faction), I (Faction Switch)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "NCXID!A2:I215",
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = (res.data.values ?? []) as string[][];
  const map: FactionMap = {};

  for (const r of rows) {
    const ncxid = (r[0] ?? "").toString().trim();
    if (!ncxid) continue;

    const factionH = (r[7] ?? "").toString().trim(); // H
    const factionI = (r[8] ?? "").toString().trim(); // I
    const chosen = useSwitch ? factionI : factionH;

    if (chosen) {
      // Normalize to your canonical uppercase labels
      map[ncxid] = chosen.toUpperCase();
    }
  }

  __factionMapCache = { data: map, at: Date.now() };
  return map;
}
