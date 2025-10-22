import { google, sheets_v4 } from "googleapis";

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

/** A single matchup row from the WEEK sheet */
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

function norm(v: unknown): string {
  return String(v ?? "").trim();
}

/**
 * Reads SCHEDULE!U2 to discover the active week tab (e.g. "WEEK 3"),
 * then loads that tab's A2:Q120 and returns normalized match rows.
 */
export async function fetchMatchupsData(): Promise<MatchupsData> {
  const sheets = getSheets();
  const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
  if (!spreadsheetId) {
    throw new Error("Missing NCX_LEAGUE_SHEET_ID");
  }

  // 1) Active week tab name from SCHEDULE!U2
  const weekRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "SCHEDULE!U2",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const weekTab = norm(weekRes.data.values?.[0]?.[0]) || "WEEK 1";

  // 2) Week data A2:Q120
  const dataRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${weekTab}!A2:Q120`,
    valueRenderOption: "FORMATTED_VALUE",
  });
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

// --- INDIVIDUAL STATS FETCHER ---
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
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "INDIVIDUAL!A2:V",
    valueRenderOption: "FORMATTED_VALUE",
  });

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
