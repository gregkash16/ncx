// src/app/components/AdvStatsPanel.tsx
"use client";

import { useState } from "react";

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

type ListAverages = {
  averageShipCount: number | null;
  averagePilotInit: number | null;
};

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
  // Canonical order for factions we expect
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

  // Sort factions so known ones are first, unknown ones (if any) follow
  const sortedFactions = [
    ...factionOrder.filter((f) => allFactions.includes(f)),
    ...allFactions.filter((f) => !factionOrder.includes(f)),
  ];

  const [selectedFaction, setSelectedFaction] = useState<string | null>(null);

  const activeFaction =
    (selectedFaction && sortedFactions.includes(selectedFaction)
      ? selectedFaction
      : sortedFactions[0]) || "";

  const currentRows: PilotUsageRow[] =
    (activeFaction && pilotUsageByFaction?.[activeFaction]) || [];

  const hasShip = listAverages?.averageShipCount != null;
  const hasInit = listAverages?.averagePilotInit != null;

  const avgShip = hasShip
    ? listAverages.averageShipCount!.toFixed(1)
    : "—";
  const avgInit = hasInit
    ? listAverages.averagePilotInit!.toFixed(1)
    : "—";

  return (
    <div className="space-y-8">
      {/* TABLE 1 */}
      <section className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-4 md:p-6">
        <h3 className="text-lg font-semibold text-cyan-400 mb-3">
          Team Averages
        </h3>
        <Table1 rows={table1} />
      </section>

      {/* TABLES 2–5: responsive grid; will stack on small screens */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-4 md:p-6">
          <h3 className="text-lg font-semibold text-cyan-400 mb-3">
            Scenario Averages
          </h3>
          <Table2 rows={table2} />
        </div>

        <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-4 md:p-6">
          <h3 className="text-lg font-semibold text-cyan-400 mb-3">
            Scenario × Factions
          </h3>
          <Table3 rows={table3} />
        </div>

        <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-4 md:p-6">
          <h3 className="text-lg font-semibold text-cyan-400 mb-3">
            Faction vs Faction
          </h3>
          <Table4 rows={table4} />
        </div>

        <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-4 md:p-6">
          <h3 className="text-lg font-semibold text-cyan-400 mb-3">
            Faction Performance
          </h3>
          <Table5 rows={table5} />
        </div>
      </section>

      {/* Pilot usage by faction + List averages */}
      <section className="w-full lg:w-1/2 mx-auto rounded-2xl bg-zinc-900/70 border border-zinc-800 p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3">
          <h3 className="text-lg font-semibold text-cyan-400">
            Pilot Usage by Faction
          </h3>
          <div className="flex flex-wrap gap-2 text-xs">
            {sortedFactions.length === 0 && (
              <span className="text-zinc-400">
                No pilot usage data yet.
              </span>
            )}
            {sortedFactions.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setSelectedFaction(f)}
                className={cx(
                  "px-3 py-1.5 rounded-full border transition",
                  activeFaction === f
                    ? "border-cyan-400 bg-cyan-500/10 text-cyan-200"
                    : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-cyan-400/60"
                )}
              >
                {factionLabelMap[f] ?? f}
              </button>
            ))}
          </div>
        </div>

        {/* NEW: List Averages box (desktop) */}
        {(hasShip || hasInit) && (
          <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-zinc-400">
              List Averages
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-zinc-900/70 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-zinc-400">
                  Avg Ship Count
                </div>
                <div className="mt-1 font-semibold tabular-nums text-zinc-100">
                  {avgShip}
                </div>
              </div>
              <div className="rounded-lg bg-zinc-900/70 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-zinc-400">
                  Avg Pilot Init
                </div>
                <div className="mt-1 font-semibold tabular-nums text-zinc-100">
                  {avgInit}
                </div>
              </div>
            </div>
          </div>
        )}

        <PilotUsageTable rows={currentRows} />
      </section>
    </div>
  );
}

/* ------------------------ helpers ------------------------ */

function toNum(x: string): number | null {
  if (!x) return null;
  const cleaned = x.replace(/[%+,]/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function cx(...args: (string | false | undefined)[]) {
  return args.filter(Boolean).join(" ");
}

function Td({
  children,
  highlight,
  align = "right",
}: {
  children: React.ReactNode;
  highlight?: boolean;
  align?: "left" | "right" | "center";
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
        "text-zinc-200",
        highlight && "border border-amber-400/70 bg-amber-500/10 rounded"
      )}
    >
      {children ?? "—"}
    </td>
  );
}

/* ------------------------ Table 1 ------------------------ */

// (rest of the tables unchanged – this is just your existing code)

function Table1({ rows }: { rows: Table1Row[] }) {
  const numericCols = [
    "totalGames",
    "avgWins",
    "avgLoss",
    "avgPoints",
    "avgPlms",
    "avgGames",
    "avgWinPct",
    "avgPpg",
    "avgEfficiency",
    "avgWar",
    "avgH2h",
    "avgPotato",
    "avgSos",
  ] as const;

  const maxima = new Map<string, number>();
  const minima = new Map<string, number>();

  for (const key of numericCols) {
    const nums = rows
      .map((r) => toNum(r[key as keyof Table1Row] as string))
      .filter((n): n is number => n !== null);
    if (!nums.length) continue;
    if (key === "avgLoss") minima.set(key, Math.min(...nums));
    else maxima.set(key, Math.max(...nums));
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full table-auto">
        <thead className="sticky top-0 bg-zinc-900/90 backdrop-blur border-b border-zinc-800 text-xs uppercase text-zinc-300">
          <tr>
            <th className="px-3 py-2 text-left">Team</th>
            <th className="px-3 py-2">Total Games</th>
            <th className="px-3 py-2">Avg Wins</th>
            <th className="px-3 py-2">Avg Loss</th>
            <th className="px-3 py-2">Avg Points</th>
            <th className="px-3 py-2">Avg PL/MS</th>
            <th className="px-3 py-2">Avg Games</th>
            <th className="px-3 py-2">Avg Win %</th>
            <th className="px-3 py-2">Avg PPG</th>
            <th className="px-3 py-2">Avg Efficiency</th>
            <th className="px-3 py-2">Avg WAR</th>
            <th className="px-3 py-2">Avg H2H</th>
            <th className="px-3 py-2">Avg Potato</th>
            <th className="px-3 py-2">Avg SOS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map((r, i) => (
            <tr key={`${r.team}-${i}`} className="odd:bg-zinc-900/30">
              <Td align="left">{r.team}</Td>
              <Td highlight={toNum(r.totalGames) === maxima.get("totalGames")}>
                {r.totalGames}
              </Td>
              <Td highlight={toNum(r.avgWins) === maxima.get("avgWins")}>
                {r.avgWins}
              </Td>
              <Td highlight={toNum(r.avgLoss) === minima.get("avgLoss")}>
                {r.avgLoss}
              </Td>
              <Td highlight={toNum(r.avgPoints) === maxima.get("avgPoints")}>
                {r.avgPoints}
              </Td>
              <Td highlight={toNum(r.avgPlms) === maxima.get("avgPlms")}>
                {r.avgPlms}
              </Td>
              <Td highlight={toNum(r.avgGames) === maxima.get("avgGames")}>
                {r.avgGames}
              </Td>
              <Td highlight={toNum(r.avgWinPct) === maxima.get("avgWinPct")}>
                {r.avgWinPct}
              </Td>
              <Td highlight={toNum(r.avgPpg) === maxima.get("avgPpg")}>
                {r.avgPpg}
              </Td>
              <Td
                highlight={
                  toNum(r.avgEfficiency) === maxima.get("avgEfficiency")
                }
              >
                {r.avgEfficiency}
              </Td>
              <Td highlight={toNum(r.avgWar) === maxima.get("avgWar")}>
                {r.avgWar}
              </Td>
              <Td highlight={toNum(r.avgH2h) === maxima.get("avgH2h")}>
                {r.avgH2h}
              </Td>
              <Td highlight={toNum(r.avgPotato) === maxima.get("avgPotato")}>
                {r.avgPotato}
              </Td>
              <Td highlight={toNum(r.avgSos) === maxima.get("avgSos")}>
                {r.avgSos}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Table2, Table3, Table4, Table5, PilotUsageTable remain exactly as you pasted */
/* ------------------------ Table 2 ------------------------ */

function Table2({ rows }: { rows: Table2Row[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full table-auto">
        <thead className="sticky top-0 bg-zinc-900/90 backdrop-blur border-b border-zinc-800 text-xs uppercase text-zinc-300">
          <tr>
            <th className="px-3 py-2 text-left">Scenario</th>
            <th className="px-3 py-2">Avg Home Pts</th>
            <th className="px-3 py-2">Avg Away Pts</th>
            <th className="px-3 py-2">Avg Total Pts</th>
            <th className="px-3 py-2">Avg W Pts</th>
            <th className="px-3 py-2">Avg L Pts</th>
            <th className="px-3 py-2">&lt; 20</th>
            <th className="px-3 py-2">&gt;= 20</th>
            <th className="px-3 py-2">Total Games</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map((r, i) => (
            <tr key={`${r.scenario}-${i}`} className="odd:bg-zinc-900/30">
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
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------ Table 3 ------------------------ */

function Table3({ rows }: { rows: Table3Row[] }) {
  const heads = [
    "Scenario",
    "Republic",
    "CIS",
    "Rebels",
    "Empire",
    "Resistance",
    "First Order",
    "Scum",
  ] as const;
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full table-auto">
        <thead className="sticky top-0 bg-zinc-900/90 backdrop-blur border-b border-zinc-800 text-xs uppercase text-zinc-300">
          <tr>
            {heads.map((h) => (
              <th
                key={h}
                className={h === "Scenario" ? "px-3 py-2 text-left" : "px-3 py-2"}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map((r, i) => (
            <tr key={`${r.scenario}-${i}`} className="odd:bg-zinc-900/30">
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
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------ Table 4 ------------------------ */

function Table4({ rows }: { rows: Table4Row[] }) {
  const heads = [
    "Faction Vs",
    "Republic",
    "CIS",
    "Rebels",
    "Empire",
    "Resistance",
    "First Order",
    "Scum",
  ] as const;
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full table-auto">
        <thead className="sticky top-0 bg-zinc-900/90 backdrop-blur border-b border-zinc-800 text-xs uppercase text-zinc-300">
          <tr>
            {heads.map((h) => (
              <th
                key={h}
                className={h === "Faction Vs" ? "px-3 py-2 text-left" : "px-3 py-2"}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map((r, i) => (
            <tr key={`${r.factionVs}-${i}`} className="odd:bg-zinc-900/30">
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
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------ Table 5 ------------------------ */

function Table5({ rows }: { rows: Table5Row[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full table-auto">
        <thead className="sticky top-0 bg-zinc-900/90 backdrop-blur border-b border-zinc-800 text-xs uppercase text-zinc-300">
          <tr>
            <th className="px-3 py-2 text-left">Faction</th>
            <th className="px-3 py-2">Wins</th>
            <th className="px-3 py-2">Losses</th>
            <th className="px-3 py-2">Win %</th>
            <th className="px-3 py-2">Avg Draft</th>
            <th className="px-3 py-2">Expected Win %</th>
            <th className="px-3 py-2">Perf +/-</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map((r, i) => (
            <tr key={`${r.faction}-${i}`} className="odd:bg-zinc-900/30">
              <Td align="left">{r.faction}</Td>
              <Td>{r.wins}</Td>
              <Td>{r.losses}</Td>
              <Td>{r.winPct}</Td>
              <Td>{r.avgDraft}</Td>
              <Td>{r.expectedWinPct}</Td>
              <Td>{r.perfPlusMinus}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------ Pilot Usage Table ------------------------ */

function PilotUsageTable({ rows }: { rows: PilotUsageRow[] }) {
  // For bar graph scale
  const maxUses = rows.length
    ? Math.max(...rows.map((r) => r.uses ?? 0))
    : 0;

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <div className="max-h-[520px] overflow-y-auto pr-2">
      <table className="min-w-full text-sm">

        <thead className="sticky top-0 bg-zinc-900/90 backdrop-blur border-b border-zinc-800 text-xs uppercase text-zinc-300">
          <tr>
            <th className="px-3 py-2 text-left">Pilot</th>
            <th className="px-3 py-2 text-right">Uses</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={2}
                className="px-3 py-4 text-sm text-zinc-400 text-center"
              >
                No lists recorded for this faction yet.
              </td>
            </tr>
          )}

          {rows.map((r, i) => {
            const ratio =
              maxUses > 0 ? Math.max(0.05, r.uses / maxUses) : 0; // min bar width

            return (
              <tr
                key={`${r.pilotId}-${i}`}
                className="odd:bg-zinc-900/30"
              >
                {/* Pilot name + ship glyph */}
                <Td align="left">
                  <div className="flex items-center gap-3">
                    {r.shipGlyph && (
                      <span className="ship-icons text-xl leading-none">
                        {r.shipGlyph}
                      </span>
                    )}
                    <span>{r.pilotName}</span>
                  </div>
                </Td>

                {/* Uses with horizontal bar graph */}
                <Td align="right">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-cyan-500/80"
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-sm text-zinc-100 min-w-[2ch] text-right">
                      {r.uses}
                    </span>
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
