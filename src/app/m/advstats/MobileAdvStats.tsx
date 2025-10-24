// src/app/m/advstats/MobileAdvStats.tsx
"use client";

import { useState } from "react";

type Table1Row = {
  team: string; totalGames: string; avgWins: string; avgLoss: string; avgPoints: string;
  avgPlms: string; avgGames: string; avgWinPct: string; avgPpg: string; avgEfficiency: string;
  avgWar: string; avgH2h: string; avgPotato: string; avgSos: string;
};
type Table2Row = {
  scenario: string; avgHomePts: string; avgAwayPts: string; avgTotalPts: string; avgWpts: string;
  avgLpts: string; lt20: string; gte20: string; totalGames: string;
};
type Table3Row = {
  scenario: string; republic: string; cis: string; rebels: string; empire: string;
  resistance: string; firstOrder: string; scum: string;
};
type Table4Row = {
  factionVs: string; republic: string; cis: string; rebels: string; empire: string;
  resistance: string; firstOrder: string; scum: string;
};
type Table5Row = {
  faction: string; wins: string; losses: string; winPct: string; avgDraft: string;
  expectedWinPct: string; perfPlusMinus: string;
};

export default function MobileAdvStats({
  table1, table2, table3, table4, table5,
}: {
  table1: Table1Row[]; table2: Table2Row[]; table3: Table3Row[]; table4: Table4Row[]; table5: Table5Row[];
}) {
  const [tab, setTab] = useState<"t1" | "t2" | "t3" | "t4" | "t5">("t1");

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
        <h2 className="mb-3 text-xl font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400">
          Advanced Stats
        </h2>

        {/* Segmented control: one table at a time */}
        <div className="grid grid-cols-5 gap-1 rounded-xl border border-neutral-800 bg-neutral-950 p-1">
          {[
            { id: "t1", label: "Teams" },
            { id: "t2", label: "Scen Avg" },
            { id: "t3", label: "Scen×Fact" },
            { id: "t4", label: "FvF" },
            { id: "t5", label: "Perf" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`rounded-lg px-2 py-1.5 text-[11px] ${
                tab === t.id
                  ? "bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 text-black font-semibold"
                  : "text-neutral-300 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="mt-3">
          {tab === "t1" && <Table1Cards rows={table1} />}
          {tab === "t2" && <Table2Cards rows={table2} />}
          {tab === "t3" && <Table3Cards rows={table3} />}
          {tab === "t4" && <Table4Cards rows={table4} />}
          {tab === "t5" && <Table5Cards rows={table5} />}
        </div>
      </div>
    </section>
  );
}

/* ------------------- Cards renderers (no horizontal scroll) ------------------- */

function Stat({ k, v }: { k: string; v?: string }) {
  return (
    <div className="rounded-lg bg-neutral-900/60 px-2 py-1 text-center">
      <div className="uppercase text-[10px] tracking-wide text-neutral-400">{k}</div>
      <div className="font-semibold tabular-nums text-neutral-200">{v ?? "—"}</div>
    </div>
  );
}

/* Table 1: Team Averages -> card per team */
function Table1Cards({ rows }: { rows: Table1Row[] }) {
  if (!rows?.length) return <Empty />;
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={`${r.team}-${i}`} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="truncate text-sm font-semibold text-neutral-200">{r.team}</div>
            <div className="text-xs text-neutral-400">Games: {r.totalGames || "—"}</div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <Stat k="W" v={r.avgWins} />
            <Stat k="L" v={r.avgLoss} />
            <Stat k="Pts" v={r.avgPoints} />
            <Stat k="PL/MS" v={r.avgPlms} />
            <Stat k="G" v={r.avgGames} />
            <Stat k="Win%" v={r.avgWinPct} />
            <Stat k="PPG" v={r.avgPpg} />
            <Stat k="Eff" v={r.avgEfficiency} />
            <Stat k="WAR" v={r.avgWar} />
            <Stat k="H2H" v={r.avgH2h} />
            <Stat k="Potato" v={r.avgPotato} />
            <Stat k="SOS" v={r.avgSos} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* Table 2: Scenario Averages -> card per scenario */
function Table2Cards({ rows }: { rows: Table2Row[] }) {
  if (!rows?.length) return <Empty />;
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={`${r.scenario}-${i}`} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
          <div className="text-sm font-semibold text-neutral-200">{r.scenario}</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <Stat k="Home" v={r.avgHomePts} />
            <Stat k="Away" v={r.avgAwayPts} />
            <Stat k="Total" v={r.avgTotalPts} />
            <Stat k="W Pts" v={r.avgWpts} />
            <Stat k="L Pts" v={r.avgLpts} />
            <Stat k="<20" v={r.lt20} />
            <Stat k="≥20" v={r.gte20} />
            <Stat k="Games" v={r.totalGames} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* Table 3: Scenario × Factions -> per scenario, chips per faction */
function Table3Cards({ rows }: { rows: Table3Row[] }) {
  if (!rows?.length) return <Empty />;
  const order: Array<keyof Table3Row> = ["republic","cis","rebels","empire","resistance","firstOrder","scum"];
  const labels: Record<string,string> = {
    republic:"Republic", cis:"CIS", rebels:"Rebels", empire:"Empire", resistance:"Resistance",
    firstOrder:"First Order", scum:"Scum",
  };
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={`${r.scenario}-${i}`} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
          <div className="text-sm font-semibold text-neutral-200">{r.scenario}</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {order.map((k) => (
              <div key={String(k)} className="rounded-lg bg-neutral-900/60 px-2 py-1">
                <div className="text-[10px] uppercase tracking-wide text-neutral-400">{labels[k]}</div>
                <div className="font-semibold tabular-nums text-neutral-200">{(r[k] as string) || "—"}</div>
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* Table 4: Faction vs Faction -> per row, chips for each opponent faction */
function Table4Cards({ rows }: { rows: Table4Row[] }) {
  if (!rows?.length) return <Empty />;
  const order: Array<keyof Table4Row> = ["republic","cis","rebels","empire","resistance","firstOrder","scum"];
  const labels: Record<string,string> = {
    republic:"Republic", cis:"CIS", rebels:"Rebels", empire:"Empire", resistance:"Resistance",
    firstOrder:"First Order", scum:"Scum",
  };
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={`${r.factionVs}-${i}`} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
          <div className="text-sm font-semibold text-neutral-200">{r.factionVs}</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {order.map((k) => (
              <div key={String(k)} className="rounded-lg bg-neutral-900/60 px-2 py-1">
                <div className="text-[10px] uppercase tracking-wide text-neutral-400">{labels[k]}</div>
                <div className="font-semibold tabular-nums text-neutral-200">{(r[k] as string) || "—"}</div>
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* Table 5: Faction Performance -> card per faction */
function Table5Cards({ rows }: { rows: Table5Row[] }) {
  if (!rows?.length) return <Empty />;
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={`${r.faction}-${i}`} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
          <div className="text-sm font-semibold text-neutral-200">{r.faction}</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <Stat k="W" v={r.wins} />
            <Stat k="L" v={r.losses} />
            <Stat k="Win%" v={r.winPct} />
            <Stat k="Avg Draft" v={r.avgDraft} />
            <Stat k="Exp Win%" v={r.expectedWinPct} />
            <Stat k="Perf ±" v={r.perfPlusMinus} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Empty() {
  return <div className="mt-4 text-center text-sm text-neutral-400">No data.</div>;
}
