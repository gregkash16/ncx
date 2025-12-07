// src/app/components/AdvStatsPanelServer.tsx
// Server component (no 'use client')
import AdvStatsPanel from "./AdvStatsPanel";
import { fetchAdvStatsCached, fetchPilotUsageByFactionCached } from "@/lib/googleSheets";

type Table1Row = {
  team: string;
  totalGames: string;
  avgWins: string;
  avgLoss: string; // lowest is best
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

type PilotUsageRow = {
  pilotId: string;
  pilotName: string;
  uses: number;
  shipGlyph: string;
};

type PilotUsageByFaction = Record<string, PilotUsageRow[]>;


function s(v: unknown) {
  return (v ?? "").toString().trim();
}

export default async function AdvStatsPanelServer() {
  try {
    // Pull all five tables and pilot usage
    const { t1, t2, t3, t4, t5 } = await fetchAdvStatsCached();
    const pilotUsageByFaction: PilotUsageByFaction = await fetchPilotUsageByFactionCached();

    // --- Map each table into typed rows your AdvStatsPanel expects ---
    const table1: Table1Row[] = (t1 ?? [])
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

    const table2: Table2Row[] = (t2 ?? [])
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

    const table3: Table3Row[] = (t3 ?? [])
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

    const table4: Table4Row[] = (t4 ?? [])
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

    const table5: Table5Row[] = (t5 ?? [])
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

    return (
      <AdvStatsPanel
        table1={table1}
        table2={table2}
        table3={table3}
        table4={table4}
        table5={table5}
        pilotUsageByFaction={pilotUsageByFaction}
      />
    );
  } catch (err: any) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-zinc-300">
        Failed to load Advanced Stats. {(err?.message ?? String(err)) as string}
      </div>
    );
  }
}
