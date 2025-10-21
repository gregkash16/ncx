import { getSheets } from "@/lib/googleSheets";

export type NcxProfile = {
  ncxId: string;
  first: string;
  last: string;
};

export async function getNcxProfileByDiscordId(discordId: string): Promise<NcxProfile | null> {

  const spreadsheetId =
    process.env.NCX_LEAGUE_SHEET_ID || process.env.SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) return null;

  const sheets = getSheets();

  // Discord_ID sheet: A=NCXID, B=First, C=Last, D=DiscordID
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Discord_ID!A2:D",
  });

  const rows = resp.data.values || [];
  const found = rows.find((r) => {
    const discordCol = (r[3] ?? "").toString().trim();
    return discordCol !== "" && discordCol === discordId;
  });

  if (!found) return null;

  const ncxId = (found[0] ?? "").toString().trim();
  const first = (found[1] ?? "").toString().trim();
  const last  = (found[2] ?? "").toString().trim();

  if (!ncxId) return null;
  return { ncxId, first, last };
}
