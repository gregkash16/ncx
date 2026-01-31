// src/app/components/AdvStatsPanel.tsx
"use client";

import { useState } from "react";

/* ======================= TYPES ======================= */

type Table1Row = {
  team: string;
  totalGames: string;
  avgWins: string;
  avgLoss: string;
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

type ListAverages = {
  averageShipCount: number | null;
  averagePilotInit: number | null;
};

/* ======================= MAIN ======================= */

export default function AdvStatsPanel({
  table1,
  table2,
  table3,
  table4,
  table5,
  pilotUsageByFaction,
  listAverages,
}: {
  table1: Table1Row[];
  table2: Table2Row[];
  table3: Table3Row[];
  table4: Table4Row[];
  table5: Table5Row[];
  pilotUsageByFaction: PilotUsageByFaction;
  listAverages: ListAverages;
}) {
  const factionOrder = [
    "galacticrepublic",
    "separatistalliance",
    "rebelalliance",
    "galacticempire",
    "resistance",
    "firstorder",
    "scumandvillainy",
  ];

  const factionLabelMap: Record<string, string> = {
    galacticrepublic: "Republic",
    separatistalliance: "CIS",
    rebelalliance: "Rebels",
    galacticempire: "Empire",
    resistance: "Resistance",
    firstorder: "First Order",
    scumandvillainy: "Scum",
  };

  const allFactions = Object.keys(pilotUsageByFaction ?? {});
  const sortedFactions = [
    ...factionOrder.filter((f) => allFactions.includes(f)),
    ...allFactions.filter((f) => !factionOrder.includes(f)),
  ];

  const [selectedFaction, setSelectedFaction] = useState<string | null>(null);
  const activeFaction =
    selectedFaction && sortedFactions.includes(selectedFaction)
      ? selectedFaction
      : sortedFactions[0] ?? "";

  const currentRows = pilotUsageByFaction?.[activeFaction] ?? [];

  const avgShip =
    listAverages?.averageShipCount != null
      ? listAverages.averageShipCount.toFixed(1)
      : "—";
  const avgInit =
    listAverages?.averagePilotInit != null
      ? listAverages.averagePilotInit.toFixed(1)
      : "—";

  return (
    <div className="space-y-8">
      <Section title="Team Averages">
        <Table1 rows={table1} />
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Section title="Scenario Averages">
          <Table2 rows={table2} />
        </Section>
        <Section title="Scenario × Factions">
          <Table3 rows={table3} />
        </Section>
        <Section title="Faction vs Faction">
          <Table4 rows={table4} />
        </Section>
        <Section title="Faction Performance">
          <Table5 rows={table5} />
        </Section>
      </div>

      <Section title="Pilot Usage by Faction" className="lg:w-1/2 mx-auto">
        <div className="flex flex-wrap gap-2 mb-4">
          {sortedFactions.map((f) => (
            <button
              key={f}
              onClick={() => setSelectedFaction(f)}
              className={cx(
                "px-3 py-1.5 rounded-full border text-xs transition",
                activeFaction === f
                  ? "border-[rgb(var(--ncx-primary))] bg-[rgb(var(--ncx-primary)/0.12)] text-[rgb(var(--ncx-primary))]"
                  : "border-[var(--ncx-border)] text-[var(--ncx-text-muted)] hover:border-[rgb(var(--ncx-primary)/0.6)]"
              )}
            >
              {factionLabelMap[f] ?? f}
            </button>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <StatBox label="Avg Ship Count" value={avgShip} />
          <StatBox label="Avg Pilot Init" value={avgInit} />
        </div>

        <PilotUsageTable rows={currentRows} />
      </Section>
    </div>
  );
}

/* ======================= UI HELPERS ======================= */

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-2xl bg-[var(--ncx-bg-panel)] border border-[var(--ncx-border)] p-4 md:p-6",
        className
      )}
    >
      <h3 className="text-lg font-semibold text-[rgb(var(--ncx-primary))] mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[rgb(24_24_27/0.6)] px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-[var(--ncx-text-muted)]">
        {label}
      </div>
      <div className="mt-1 font-semibold tabular-nums text-[var(--ncx-text-primary)]">
        {value}
      </div>
    </div>
  );
}

function cx(...args: (string | false | undefined)[]) {
  return args.filter(Boolean).join(" ");
}

/* ======================= TABLES ======================= */

function Td({
  children,
  align = "right",
  highlight,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  highlight?: boolean;
}) {
  return (
    <td
      className={cx(
        "px-3 py-2 text-sm",
        align === "left"
          ? "text-left"
          : align === "center"
          ? "text-center"
          : "text-right",
        highlight &&
          "border border-[rgb(var(--ncx-highlight))] bg-[rgb(var(--ncx-highlight)/0.12)] rounded"
      )}
    >
      {children ?? "—"}
    </td>
  );
}

function Table1({ rows }: { rows: Table1Row[] }) {
  return (
    <TableWrapper headers={[
      "Team","Total Games","Avg Wins","Avg Loss","Avg Points","Avg PL/MS",
      "Avg Games","Avg Win %","Avg PPG","Avg Efficiency","Avg WAR","Avg H2H",
      "Avg Potato","Avg SOS"
    ]}>
      {rows.map((r, i) => (
        <tr key={i}>
          <Td align="left">{r.team}</Td>
          <Td>{r.totalGames}</Td>
          <Td>{r.avgWins}</Td>
          <Td>{r.avgLoss}</Td>
          <Td>{r.avgPoints}</Td>
          <Td>{r.avgPlms}</Td>
          <Td>{r.avgGames}</Td>
          <Td>{r.avgWinPct}</Td>
          <Td>{r.avgPpg}</Td>
          <Td>{r.avgEfficiency}</Td>
          <Td>{r.avgWar}</Td>
          <Td>{r.avgH2h}</Td>
          <Td>{r.avgPotato}</Td>
          <Td>{r.avgSos}</Td>
        </tr>
      ))}
    </TableWrapper>
  );
}

function Table2({ rows }: { rows: Table2Row[] }) {
  return (
    <TableWrapper headers={[
      "Scenario","Avg Home","Avg Away","Avg Total","Avg W","Avg L","<20",">=20","Games"
    ]}>
      {rows.map((r, i) => (
        <tr key={i}>
          <Td align="left">{r.scenario}</Td>
          <Td>{r.avgHomePts}</Td>
          <Td>{r.avgAwayPts}</Td>
          <Td>{r.avgTotalPts}</Td>
          <Td>{r.avgWpts}</Td>
          <Td>{r.avgLpts}</Td>
          <Td>{r.lt20}</Td>
          <Td>{r.gte20}</Td>
          <Td>{r.totalGames}</Td>
        </tr>
      ))}
    </TableWrapper>
  );
}

function Table3({ rows }: { rows: Table3Row[] }) {
  return (
    <TableWrapper headers={[
      "Scenario","Republic","CIS","Rebels","Empire","Resistance","First Order","Scum"
    ]}>
      {rows.map((r, i) => (
        <tr key={i}>
          <Td align="left">{r.scenario}</Td>
          <Td>{r.republic}</Td>
          <Td>{r.cis}</Td>
          <Td>{r.rebels}</Td>
          <Td>{r.empire}</Td>
          <Td>{r.resistance}</Td>
          <Td>{r.firstOrder}</Td>
          <Td>{r.scum}</Td>
        </tr>
      ))}
    </TableWrapper>
  );
}

function Table4({ rows }: { rows: Table4Row[] }) {
  return (
    <TableWrapper headers={[
      "Faction vs","Republic","CIS","Rebels","Empire","Resistance","First Order","Scum"
    ]}>
      {rows.map((r, i) => (
        <tr key={i}>
          <Td align="left">{r.factionVs}</Td>
          <Td>{r.republic}</Td>
          <Td>{r.cis}</Td>
          <Td>{r.rebels}</Td>
          <Td>{r.empire}</Td>
          <Td>{r.resistance}</Td>
          <Td>{r.firstOrder}</Td>
          <Td>{r.scum}</Td>
        </tr>
      ))}
    </TableWrapper>
  );
}

function Table5({ rows }: { rows: Table5Row[] }) {
  return (
    <TableWrapper headers={[
      "Faction","Wins","Losses","Win %","Avg Draft","Expected %","Perf +/-"
    ]}>
      {rows.map((r, i) => (
        <tr key={i}>
          <Td align="left">{r.faction}</Td>
          <Td>{r.wins}</Td>
          <Td>{r.losses}</Td>
          <Td>{r.winPct}</Td>
          <Td>{r.avgDraft}</Td>
          <Td>{r.expectedWinPct}</Td>
          <Td>{r.perfPlusMinus}</Td>
        </tr>
      ))}
    </TableWrapper>
  );
}

function TableWrapper({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--ncx-border)]">
      <table className="w-full table-auto text-sm">
        <thead className="sticky top-0 bg-[rgb(24_24_27/0.9)] text-xs uppercase text-[var(--ncx-text-muted)]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--ncx-border)]">{children}</tbody>
      </table>
    </div>
  );
}

/* ======================= PILOT USAGE ======================= */

function PilotUsageTable({ rows }: { rows: PilotUsageRow[] }) {
  const maxUses = rows.length ? Math.max(...rows.map((r) => r.uses)) : 0;

  return (
    <div className="rounded-xl border border-[var(--ncx-border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[rgb(24_24_27/0.9)] text-xs uppercase text-[var(--ncx-text-muted)]">
          <tr>
            <th className="px-3 py-2 text-left">Pilot</th>
            <th className="px-3 py-2 text-right">Uses</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--ncx-border)]">
          {rows.map((r, i) => (
            <tr key={i}>
              <Td align="left">
                <div className="flex items-center gap-3">
                  <span className="ship-icons text-xl">{r.shipGlyph}</span>
                  {r.pilotName}
                </div>
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded bg-zinc-800">
                    <div
                      className="h-2 rounded bg-[rgb(var(--ncx-primary))]"
                      style={{
                        width: `${Math.max(
                          5,
                          (r.uses / maxUses) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="tabular-nums">{r.uses}</span>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
