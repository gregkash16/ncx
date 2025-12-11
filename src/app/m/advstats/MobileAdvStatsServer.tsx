// src/app/m/advstats/MobileAdvStatsServer.tsx
// Server component (no 'use client')
// Now reads advanced stats + pilot usage from MySQL.

import MobileAdvStats from "./MobileAdvStats";
import {
  fetchAdvStatsCached,
  fetchPilotUsageByFactionCached,
  fetchListAveragesCached,
} from "@/lib/googleSheets";

type ListAverages = {
  averageShipCount: number | null;
  averagePilotInit: number | null;
};

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

export default async function MobileAdvStatsServer() {
  // Pull t1–t5 and pilot-usage data in parallel
  const [adv, pilotUsage, listAverages] = await Promise.all([
    fetchAdvStatsCached(),
    fetchPilotUsageByFactionCached(),
    fetchListAveragesCached(),
  ]);

  const { t1, t2, t3, t4, t5 } = adv;

  const table1: Table1Row[] = (t1 ?? [])
    .map((r) => ({
      team: r[0] ?? "",
      totalGames: r[1] ?? "",
      avgWins: r[2] ?? "",
      avgLoss: r[3] ?? "",
      avgPoints: r[4] ?? "",
      avgPlms: r[5] ?? "",
      avgGames: r[6] ?? "",
      avgWinPct: r[7] ?? "",
      avgPpg: r[8] ?? "",
      avgEfficiency: r[9] ?? "",
      avgWar: r[10] ?? "",
      avgH2h: r[11] ?? "",
      avgPotato: r[12] ?? "",
      avgSos: r[13] ?? "",
    }))
    .filter((r) => r.team);

  const table2: Table2Row[] = (t2 ?? [])
    .map((r) => ({
      scenario: r[0] ?? "",
      avgHomePts: r[1] ?? "",
      avgAwayPts: r[2] ?? "",
      avgTotalPts: r[3] ?? "",
      avgWpts: r[4] ?? "",
      avgLpts: r[5] ?? "",
      lt20: r[6] ?? "",
      gte20: r[7] ?? "",
      totalGames: r[8] ?? "",
    }))
    .filter((r) => r.scenario);

  const table3: Table3Row[] = (t3 ?? [])
    .map((r) => ({
      scenario: r[0] ?? "",
      republic: r[1] ?? "",
      cis: r[2] ?? "",
      rebels: r[3] ?? "",
      empire: r[4] ?? "",
      resistance: r[5] ?? "",
      firstOrder: r[6] ?? "",
      scum: r[7] ?? "",
    }))
    .filter((r) => r.scenario);

  const table4: Table4Row[] = (t4 ?? [])
    .map((r) => ({
      factionVs: r[0] ?? "",
      republic: r[1] ?? "",
      cis: r[2] ?? "",
      rebels: r[3] ?? "",
      empire: r[4] ?? "",
      resistance: r[5] ?? "",
      firstOrder: r[6] ?? "",
      scum: r[7] ?? "",
    }))
    .filter((r) => r.factionVs);

  const table5: Table5Row[] = (t5 ?? [])
    .map((r) => ({
      faction: r[0] ?? "",
      wins: r[1] ?? "",
      losses: r[2] ?? "",
      winPct: r[3] ?? "",
      avgDraft: r[4] ?? "",
      expectedWinPct: r[5] ?? "",
      perfPlusMinus: r[6] ?? "",
    }))
    .filter((r) => r.faction);

  return (
    <MobileAdvStats
      table1={table1}
      table2={table2}
      table3={table3}
      table4={table4}
      table5={table5}
      pilotUsage={pilotUsage as PilotUsageByFaction}
      listAverages={listAverages as ListAverages}
    />
  );
}

