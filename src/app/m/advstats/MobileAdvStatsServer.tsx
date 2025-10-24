// src/app/m/advstats/MobileAdvStatsServer.tsx
// Server component (no 'use client')
// Mirrors the desktop fetch logic but passes data to a mobile client UI.
import { getSheets } from "@/lib/googleSheets";
import MobileAdvStats from "./MobileAdvStats";

type Table1Row = {
  team: string;
  totalGames: string;
  avgWins: string;
  avgLoss: string;     // lowest is best
  avgPoints: string;
  avgPlms: string;
  avgGames: string;
  avgWinPct: string;
  avgPpg: string;
  avgEfficiency: string;
  avgWar: string;
  avgH2h: string;
  avgPotato: string;
  avgSos: string;
};

type Table2Row = {
  scenario: string;
  avgHomePts: string;
  avgAwayPts: string;
  avgTotalPts: string;
  avgWpts: string;
  avgLpts: string;
  lt20: string;
  gte20: string;
  totalGames: string;
};

type Table3Row = {
  scenario: string;
  republic: string;
  cis: string;
  rebels: string;
  empire: string;
  resistance: string;
  firstOrder: string;
  scum: string;
};

type Table4Row = {
  factionVs: string;
  republic: string;
  cis: string;
  rebels: string;
  empire: string;
  resistance: string;
  firstOrder: string;
  scum: string;
};

type Table5Row = {
  faction: string;
  wins: string;
  losses: string;
  winPct: string;
  avgDraft: string;
  expectedWinPct: string;
  perfPlusMinus: string;
};

function s(v: unknown) {
  return (v ?? "").toString().trim();
}

export default async function MobileAdvStatsServer() {
  const spreadsheetId =
    process.env.NCX_LEAGUE_SHEET_ID ||
    process.env.SHEETS_SPREADSHEET_ID ||
    process.env.NCX_STATS_SHEET_ID;

  if (!spreadsheetId) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-zinc-300">
        Missing <code>NCX_LEAGUE_SHEET_ID</code> env var (or fallback).
      </div>
    );
  }

  const sheets = getSheets();

  // Match desktop: locate ADV STATS sheet title by id/name
  const ADV_GID = 1028481426;
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });

  const allProps = meta.data.sheets?.map((sh) => sh.properties!).filter(Boolean) ?? [];
  let advProps = allProps.find((p) => p.sheetId === ADV_GID);
  if (!advProps) {
    advProps = allProps.find((p) => (p.title ?? "").replace(/\s+/g, "").toLowerCase() === "advstats");
  }
  if (!advProps?.title) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-zinc-300">
        Could not locate the <b>ADV STATS</b> tab in the sheet.
      </div>
    );
  }
  const ADV_TITLE = advProps.title;
  const T = (a1: string) => `'${ADV_TITLE}'!${a1}`;

  // --- Table 1: A2:N25
  const t1Res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: T("A2:N25"),
    valueRenderOption: "FORMATTED_VALUE",
  });
  const table1: Table1Row[] = (t1Res.data.values ?? [])
    .map((r) => ({
      team: s(r[0]),
      totalGames: s(r[1]),
      avgWins: s(r[2]),
      avgLoss: s(r[3]),
      avgPoints: s(r[4]),
      avgPlms: s(r[5]),
      avgGames: s(r[6]),
      avgWinPct: s(r[7]),
      avgPpg: s(r[8]),
      avgEfficiency: s(r[9]),
      avgWar: s(r[10]),
      avgH2h: s(r[11]),
      avgPotato: s(r[12]),
      avgSos: s(r[13]),
    }))
    .filter((r) => r.team);

  // --- Table 2: A28:I32
  const t2Res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: T("A28:I32"),
    valueRenderOption: "FORMATTED_VALUE",
  });
  const table2: Table2Row[] = (t2Res.data.values ?? [])
    .map((r) => ({
      scenario: s(r[0]),
      avgHomePts: s(r[1]),
      avgAwayPts: s(r[2]),
      avgTotalPts: s(r[3]),
      avgWpts: s(r[4]),
      avgLpts: s(r[5]),
      lt20: s(r[6]),
      gte20: s(r[7]),
      totalGames: s(r[8]),
    }))
    .filter((r) => r.scenario);

  // --- Table 3: A36:H40
  const t3Res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: T("A36:H40"),
    valueRenderOption: "FORMATTED_VALUE",
  });
  const table3: Table3Row[] = (t3Res.data.values ?? [])
    .map((r) => ({
      scenario: s(r[0]),
      republic: s(r[1]),
      cis: s(r[2]),
      rebels: s(r[3]),
      empire: s(r[4]),
      resistance: s(r[5]),
      firstOrder: s(r[6]),
      scum: s(r[7]),
    }))
    .filter((r) => r.scenario);

  // --- Table 4: A43:H49
  const t4Res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: T("A43:H49"),
    valueRenderOption: "FORMATTED_VALUE",
  });
  const table4: Table4Row[] = (t4Res.data.values ?? [])
    .map((r) => ({
      factionVs: s(r[0]),
      republic: s(r[1]),
      cis: s(r[2]),
      rebels: s(r[3]),
      empire: s(r[4]),
      resistance: s(r[5]),
      firstOrder: s(r[6]),
      scum: s(r[7]),
    }))
    .filter((r) => r.factionVs);

  // --- Table 5: J36:P42
  const t5Res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: T("J36:P42"),
    valueRenderOption: "FORMATTED_VALUE",
  });
  const table5: Table5Row[] = (t5Res.data.values ?? [])
    .map((r) => ({
      faction: s(r[0]),
      wins: s(r[1]),
      losses: s(r[2]),
      winPct: s(r[3]),
      avgDraft: s(r[4]),
      expectedWinPct: s(r[5]),
      perfPlusMinus: s(r[6]),
    }))
    .filter((r) => r.faction);

  return <MobileAdvStats table1={table1} table2={table2} table3={table3} table4={table4} table5={table5} />;
}
