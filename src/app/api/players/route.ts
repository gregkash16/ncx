// src/app/api/players/route.ts
import { NextResponse } from "next/server";
import { getSheets } from "@/lib/googleSheets";

// Keep this in sync with desktop columns (A..U)
function toStr(v: unknown) {
  return (v ?? "").toString().trim();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(50, Math.max(5, Number(searchParams.get("limit") || 25)));

  if (!q) return NextResponse.json({ items: [] });

  const spreadsheetId =
    process.env.NCX_STATS_SHEET_ID || process.env.SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    return NextResponse.json({ items: [], error: "Missing NCX_STATS_SHEET_ID" }, { status: 500 });
  }

  const sheets = getSheets();
  // ALL TIME STATS!A2:U500 (Row 1 headers) — same as desktop PlayersPanelServer
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "ALL TIME STATS!A2:U500",
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = (res.data.values ?? []) as string[][];
  const all = rows
    .map((r) => {
      const first = toStr(r[1]);
      if (!first) return null; // skip empty
      const seasons = [
        toStr(r[12]) || null,
        toStr(r[13]) || null,
        toStr(r[14]) || null,
        toStr(r[15]) || null,
        toStr(r[16]) || null,
        toStr(r[17]) || null,
        toStr(r[18]) || null,
        toStr(r[19]) || null,
      ];
      return {
        ncxid: toStr(r[0]),
        first,
        last: toStr(r[2]),
        discord: toStr(r[3]),
        wins: Number(toStr(r[4]) || 0),
        losses: Number(toStr(r[5]) || 0),
        points: Number(toStr(r[6]) || 0),
        plms: Number(toStr(r[7]) || 0),
        games: Number(toStr(r[8]) || 0),
        winPct: Number(toStr(r[9]) || 0),
        ppg: Number(toStr(r[10]) || 0),
        seasons,
        championships: toStr(r[20]),
      };
    })
    .filter(Boolean) as any[];

  // search by ncxid / name / discord — same fields desktop panel exposes
  const matches = all.filter((p) => {
    const name = `${p.first} ${p.last}`.toLowerCase();
    return (
      p.ncxid.toLowerCase().includes(q) ||
      name.includes(q) ||
      p.discord.toLowerCase().includes(q)
    );
  });

  // sort: by games desc, then wins desc, then ncxid
  matches.sort((a, b) => {
    if (b.games !== a.games) return b.games - a.games;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.ncxid.localeCompare(b.ncxid, undefined, { numeric: true });
  });

  return NextResponse.json({ items: matches.slice(0, limit) });
}
