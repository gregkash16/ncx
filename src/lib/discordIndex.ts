import { getSheets } from "@/lib/googleSheets";

type DiscordIndexRow = {
  discordId: string | null;
  discordTag: string | null; // optional "name#1234" if you store it
};

let _cache: Record<string, DiscordIndexRow> | null = null;
// If you truly never change the sheet, you can keep this forever.
// Otherwise add a TTL like: let _lastLoad = 0; const TTL = 1000*60*10;

export async function getDiscordIndex(): Promise<Record<string, DiscordIndexRow>> {
  if (_cache) return _cache;

  const spreadsheetId =
    process.env.NCX_LEAGUE_SHEET_ID || process.env.SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) return {};

  const sheets = getSheets();

  // Discord_ID sheet: A=NCXID, B=First, C=Last, D=DiscordID, (E=DiscordTag if you have it)
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Discord_ID!A2:E",
  });

  const rows = resp.data.values || [];
  const map: Record<string, DiscordIndexRow> = {};

  for (const r of rows) {
    const ncxId = (r[0] ?? "").toString().trim();
    const discordId = ((r[3] ?? "") as string).trim();
    const discordTag = ((r[4] ?? "") as string).trim() || null;

    if (!ncxId) continue;

    map[ncxId] = {
      discordId: /^\d{5,}$/.test(discordId) ? discordId : null,
      discordTag,
    };
  }

  _cache = map;
  return map;
}

// Convenience helpers if you prefer direct lookups:
export async function getDiscordIdByNcxId(ncxId: string): Promise<string | null> {
  const idx = await getDiscordIndex();
  return idx[ncxId]?.discordId ?? null;
}
export async function getDiscordTagByNcxId(ncxId: string): Promise<string | null> {
  const idx = await getDiscordIndex();
  return idx[ncxId]?.discordTag ?? null;
}
