// src/lib/googleSheets.ts
import { google, sheets_v4 } from "googleapis";
import { unstable_cache } from "next/cache";

/** ---------------------------- Auth client ---------------------------- **/
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

/** ----------------------------- Utilities ---------------------------- **/
const norm = (v: unknown) => String(v ?? "").trim();

/** tiny retry/backoff for 429s */
async function withBackoff<T>(fn: () => Promise<T>, tries = 4, base = 250): Promise<T> {
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

/** ------------------------ Matchups (by week) ------------------------ **/
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
  /** Derived: 7-game blocks -> 1,2,3... (based on game number) */
  seriesNo: number;
};

export type MatchupsData = { weekTab: string; matches: MatchRow[] };

/** A..Q (= 0..16) mapping shared by all loaders */
function mapGridRowToMatchRow(r: any[]): MatchRow {
  const game     = norm(r?.[0]);  // A
  const awayId   = norm(r?.[1]);  // B
  const awayName = norm(r?.[2]);  // C
  const awayTeam = norm(r?.[3]);  // D
  const awayW    = norm(r?.[4]);  // E
  const awayL    = norm(r?.[5]);  // F
  const awayPts  = norm(r?.[6]);  // G
  const awayPLMS = norm(r?.[7]);  // H
  // I ignored (index 8)
  const homeId   = norm(r?.[9]);  // J
  const homeName = norm(r?.[10]); // K
  const homeTeam = norm(r?.[11]); // L
  const homeW    = norm(r?.[12]); // M
  const homeL    = norm(r?.[13]); // N
  const homePts  = norm(r?.[14]); // O
  const homePLMS = norm(r?.[15]); // P
  const scenario = norm(r?.[16]); // Q

  const n = Number(game);
  const seriesNo = Number.isFinite(n) && n > 0 ? Math.ceil(n / 7) : 0;

  return {
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
    scenario,
    seriesNo,
  };
}

/** Non-cached helper (kept for completeness) */
export async function fetchMatchupsData(): Promise<MatchupsData> {
  const sheets = getSheets();
  const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
  if (!spreadsheetId) throw new Error("Missing NCX_LEAGUE_SHEET_ID");

  // Active week
  const weekRes = await withBackoff(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "SCHEDULE!U2",
      valueRenderOption: "FORMATTED_VALUE",
    })
  );
  const weekTab = norm(weekRes.data.values?.[0]?.[0]) || "WEEK 1";

  // Week rows
  const dataRes = await withBackoff(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${weekTab}!A2:Q120`,
      valueRenderOption: "FORMATTED_VALUE",
    })
  );
  const rows = dataRes.data.values || [];
  const matches = rows
    .map(mapGridRowToMatchRow)
    .filter((m) => m.game !== "" && (m.awayTeam !== "" || m.homeTeam !== ""));

  return { weekTab, matches };
}

/** Cached, param-aware matchups (revalidate 60s). */
export async function fetchMatchupsDataCached(weekOverride?: string): Promise<MatchupsData> {
  const cached = unstable_cache(
    async (): Promise<MatchupsData> => {
      const sheets = getSheets();
      const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
      if (!spreadsheetId) throw new Error("Missing NCX_LEAGUE_SHEET_ID");

      // Active week
      const u2 = await withBackoff(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "SCHEDULE!U2",
          valueRenderOption: "FORMATTED_VALUE",
        })
      );
      const activeWeek = norm(u2.data.values?.[0]?.[0]) || "WEEK 1";
      const targetWeek = (weekOverride && weekOverride.trim()) || activeWeek;

      // Target week grid
      const res = await withBackoff(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${targetWeek}!A2:Q120`,
          valueRenderOption: "FORMATTED_VALUE",
        })
      );
      const rows = res.data.values ?? [];
      const matches = rows
        .map(mapGridRowToMatchRow)
        .filter((m) => m.game !== "" && (m.awayTeam !== "" || m.homeTeam !== ""));

      return { weekTab: targetWeek, matches };
    },
    ["matchups-data", weekOverride || "active"],
    { revalidate: 60 }
  );

  return cached();
}

/** ---------------------- Individual player stats --------------------- **/
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
    .filter((r) => norm(r?.[0]) !== "") // keep rows with a Rank
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

/** Cached (5 min) */
export const fetchIndStatsDataCached = unstable_cache(
  async () => fetchIndStatsData(),
  ["indstats-data"],
  { revalidate: 300 }
);

/** --------------------------- Stream schedule ------------------------ **/
export type StreamSchedule = {
  scheduleWeek: string; // value from M3
  scheduleMap: Record<string, { day: string; slot: string }>;
};

export async function fetchStreamSchedule(): Promise<StreamSchedule> {
  const sheets = getSheets();
  const sheetId =
    process.env.STREAM_SCHEDULE_SHEET_ID || process.env.NCX_STREAM_SCHEDULE_SHEET_ID;

  if (!sheetId) {
    throw new Error("Missing STREAM_SCHEDULE_SHEET_ID (or NCX_STREAM_SCHEDULE_SHEET_ID)");
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
        range: "A2:I50",
        valueRenderOption: "FORMATTED_VALUE",
      })
    ),
  ]);

  const scheduleWeek = norm(m3Resp.data.values?.[0]?.[0]);
  const rows = gridResp.data.values ?? [];
  const scheduleMap: StreamSchedule["scheduleMap"] = {};

  for (const r of rows) {
    const day = norm(r?.[0]);
    const slot = norm(r?.[1]);
    const game = norm(r?.[2]);
    if (!day || !slot || !game) continue;
    scheduleMap[game] = { day: day.toUpperCase(), slot: slot.toUpperCase() };
  }

  return { scheduleWeek, scheduleMap };
}

/** Cached (5 min) */
export const fetchStreamScheduleCached = unstable_cache(
  async () => {
    try {
      return await fetchStreamSchedule();
    } catch {
      // Fail-soft: return empty when not configured
      return { scheduleWeek: "", scheduleMap: {} as StreamSchedule["scheduleMap"] };
    }
  },
  ["stream-schedule"],
  { revalidate: 300 }
);

/** ---------------------------- Discord map --------------------------- **/
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
      const ncxid = norm(r?.[0]);
      const first = norm(r?.[1]);
      const last = norm(r?.[2]);
      const discRaw = String(r?.[3] ?? "");
      const discordId = discRaw.trim().replace(/[<@!>]/g, "").replace(/\D/g, "");
      if (discordId) obj[discordId] = { ncxid, first, last };
    }
    return obj;
  },
  ["discord-map"],
  { revalidate: 300 }
);

/** ----------------------------- Faction map -------------------------- **/
export type FactionMap = Record<string, string>; // ncxid -> canonical uppercase faction

let __factionMapCache: { data: FactionMap; at: number } | null = null;
const FIVE_MIN = 5 * 60 * 1000;

export async function fetchFactionMapCached(): Promise<FactionMap> {
  if (__factionMapCache && Date.now() - __factionMapCache.at < FIVE_MIN) {
    return __factionMapCache.data;
  }

  const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
  const sheets = getSheets();

  // K28 = YES/NO switch on NCXID tab
  const switchRes = await withBackoff(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "NCXID!K28",
      valueRenderOption: "FORMATTED_VALUE",
    })
  );
  const useSwitch = norm(switchRes.data.values?.[0]?.[0]).toUpperCase() === "YES";

  // A2:I215 → A (NCXID), H (Faction), I (Faction Switch)
  const res = await withBackoff(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "NCXID!A2:I215",
      valueRenderOption: "FORMATTED_VALUE",
    })
  );

  const rows = (res.data.values ?? []) as string[][];
  const map: FactionMap = {};

  for (const r of rows) {
    const ncxid = norm(r[0]);
    if (!ncxid) continue;
    const factionH = norm(r[7]);
    const factionI = norm(r[8]);
    const chosen = useSwitch ? factionI : factionH;
    if (chosen) map[ncxid] = chosen.toUpperCase();
  }

  __factionMapCache = { data: map, at: Date.now() };
  return map;
}

/** ---------------------------- Advanced Stats ------------------------ **/
export const fetchAdvStatsCached = unstable_cache(
  async () => {
    const sheets = getSheets();
    const spreadsheetId =
      process.env.NCX_LEAGUE_SHEET_ID ||
      process.env.SHEETS_SPREADSHEET_ID ||
      process.env.NCX_STATS_SHEET_ID;

    if (!spreadsheetId) throw new Error("Missing NCX_LEAGUE_SHEET_ID");

    // Locate ADV STATS tab (prefer gid)
    const ADV_GID = 1028481426;
    const meta = await withBackoff(() =>
      sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" })
    );

    const props = meta.data.sheets?.map((s) => s.properties!).filter(Boolean) ?? [];
    let adv = props.find((p) => p.sheetId === ADV_GID);
    if (!adv) {
      adv = props.find(
        (p) => (p.title ?? "").replace(/\s+/g, "").toLowerCase() === "advstats"
      );
    }
    if (!adv?.title) throw new Error("ADV STATS tab not found");

    const ADV_TITLE = adv.title;
    const T = (a1: string) => `'${ADV_TITLE}'!${a1}`;

    // Fetch all five tables in parallel
    const [t1, t2, t3, t4, t5] = await Promise.all([
      withBackoff(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: T("A2:N25"),
          valueRenderOption: "FORMATTED_VALUE",
        })
      ),
      withBackoff(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: T("A28:I32"),
          valueRenderOption: "FORMATTED_VALUE",
        })
      ),
      withBackoff(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: T("A36:H40"),
          valueRenderOption: "FORMATTED_VALUE",
        })
      ),
      withBackoff(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: T("A43:H49"),
          valueRenderOption: "FORMATTED_VALUE",
        })
      ),
      withBackoff(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: T("J36:P42"),
          valueRenderOption: "FORMATTED_VALUE",
        })
      ),
    ]);

    return {
      t1: t1.data.values ?? [],
      t2: t2.data.values ?? [],
      t3: t3.data.values ?? [],
      t4: t4.data.values ?? [],
      t5: t5.data.values ?? [],
    };
  },
  ["adv-stats-data"],
  { revalidate: 600 } // 10 minutes
);

/** ------------------------- All-Time Player Stats --------------------- **/
export const fetchAllTimeStatsCached = unstable_cache(
  async () => {
    const sheets = getSheets();
    const spreadsheetId =
      process.env.NCX_STATS_SHEET_ID || process.env.SHEETS_SPREADSHEET_ID;

    if (!spreadsheetId) throw new Error("Missing NCX_STATS_SHEET_ID");

    const res = await withBackoff(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "ALL TIME STATS!A2:U500",
        valueRenderOption: "FORMATTED_VALUE",
      })
    );

    return res.data.values ?? [];
  },
  ["alltime-stats-data"],
  { revalidate: 600 } // 10 minutes
);
