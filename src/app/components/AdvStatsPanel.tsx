"use client";

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

export default function AdvStatsPanel({
  table1,
  table2,
  table3,
  table4,
  table5,
}: {
  table1: Table1Row[];
  table2: Table2Row[];
  table3: Table3Row[];
  table4: Table4Row[];
  table5: Table5Row[];
}) {
  return (
    <div className="space-y-8">
      {/* TABLE 1 */}
      <section className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-4 md:p-6">
        <h3 className="text-lg font-semibold text-cyan-400 mb-3">Team Averages</h3>
        <Table1 rows={table1} />
      </section>

      {/* TABLES 2–5: responsive grid; will stack on small screens */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-4 md:p-6">
          <h3 className="text-lg font-semibold text-cyan-400 mb-3">Scenario Averages</h3>
          <Table2 rows={table2} />
        </div>

        <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-4 md:p-6">
          <h3 className="text-lg font-semibold text-cyan-400 mb-3">Scenario × Factions</h3>
          <Table3 rows={table3} />
        </div>

        <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-4 md:p-6">
          <h3 className="text-lg font-semibold text-cyan-400 mb-3">Faction vs Faction</h3>
          <Table4 rows={table4} />
        </div>

        <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-4 md:p-6">
          <h3 className="text-lg font-semibold text-cyan-400 mb-3">Faction Performance</h3>
          <Table5 rows={table5} />
        </div>
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
        align === "left" ? "text-left" : align === "center" ? "text-center" : "text-right",
        "text-zinc-200",
        highlight && "border border-amber-400/70 bg-amber-500/10 rounded"
      )}
    >
      {children ?? "—"}
    </td>
  );
}

/* ------------------------ Table 1 ------------------------ */

function Table1({ rows }: { rows: Table1Row[] }) {
  // compute leaders (max for all, except avgLoss = min)
  const numericCols = [
    "totalGames","avgWins","avgLoss","avgPoints","avgPlms","avgGames",
    "avgWinPct","avgPpg","avgEfficiency","avgWar","avgH2h","avgPotato","avgSos",
  ] as const;

  const maxima = new Map<string, number>();  // for most columns
  const minima = new Map<string, number>();  // specifically for avgLoss

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
              <Td highlight={toNum(r.totalGames) === maxima.get("totalGames")}>{r.totalGames}</Td>
              <Td highlight={toNum(r.avgWins) === maxima.get("avgWins")}>{r.avgWins}</Td>
              <Td highlight={toNum(r.avgLoss) === minima.get("avgLoss")}>{r.avgLoss}</Td>
              <Td highlight={toNum(r.avgPoints) === maxima.get("avgPoints")}>{r.avgPoints}</Td>
              <Td highlight={toNum(r.avgPlms) === maxima.get("avgPlms")}>{r.avgPlms}</Td>
              <Td highlight={toNum(r.avgGames) === maxima.get("avgGames")}>{r.avgGames}</Td>
              <Td highlight={toNum(r.avgWinPct) === maxima.get("avgWinPct")}>{r.avgWinPct}</Td>
              <Td highlight={toNum(r.avgPpg) === maxima.get("avgPpg")}>{r.avgPpg}</Td>
              <Td highlight={toNum(r.avgEfficiency) === maxima.get("avgEfficiency")}>{r.avgEfficiency}</Td>
              <Td highlight={toNum(r.avgWar) === maxima.get("avgWar")}>{r.avgWar}</Td>
              <Td highlight={toNum(r.avgH2h) === maxima.get("avgH2h")}>{r.avgH2h}</Td>
              <Td highlight={toNum(r.avgPotato) === maxima.get("avgPotato")}>{r.avgPotato}</Td>
              <Td highlight={toNum(r.avgSos) === maxima.get("avgSos")}>{r.avgSos}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
  const heads = ["Scenario","Republic","CIS","Rebels","Empire","Resistance","First Order","Scum"] as const;
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full table-auto">
        <thead className="sticky top-0 bg-zinc-900/90 backdrop-blur border-b border-zinc-800 text-xs uppercase text-zinc-300">
          <tr>
            {heads.map((h) => (
              <th key={h} className={h==="Scenario" ? "px-3 py-2 text-left" : "px-3 py-2"}>
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
  const heads = ["Faction Vs","Republic","CIS","Rebels","Empire","Resistance","First Order","Scum"] as const;
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full table-auto">
        <thead className="sticky top-0 bg-zinc-900/90 backdrop-blur border-b border-zinc-800 text-xs uppercase text-zinc-300">
          <tr>
            {heads.map((h) => (
              <th key={h} className={h==="Faction Vs" ? "px-3 py-2 text-left" : "px-3 py-2"}>
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
