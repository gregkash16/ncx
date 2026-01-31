// src/app/m/advstats/MobileAdvStats.tsx
"use client";

import { useMemo, useState } from "react";

type ListAverages = {
  averageShipCount: number | null;
  averagePilotInit: number | null;
};

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

type TabId = "t1" | "t2" | "t3" | "t4" | "t5" | "pilots";

const TAB_DEFS: Array<{ id: TabId; label: string }> = [
  { id: "t1", label: "Teams" },
  { id: "t2", label: "Scen Avg" },
  { id: "t3", label: "Scen×Fact" },
  { id: "t4", label: "FvF" },
  { id: "t5", label: "Perf" },
  { id: "pilots", label: "Pilots" },
];

const PANEL =
  "rounded-2xl border border-[var(--ncx-border)] bg-[var(--ncx-bg-elev)] shadow-[0_4px_20px_rgba(0,0,0,0.25)]";

const CARD =
  "rounded-xl border border-[var(--ncx-border)] bg-[color:color-mix(in_oklab,var(--ncx-bg)_70%,transparent)]";

const SOFT =
  "bg-[color:color-mix(in_oklab,var(--ncx-bg-elev)_75%,transparent)]";

const CHIP =
  "inline-flex items-center rounded-md border border-[var(--ncx-border)] px-2 py-1 text-[11px]";

const TITLE =
  "text-xl font-extrabold tracking-wide text-[var(--ncx-text-primary)]";

const SUBTLE =
  "text-[11px] uppercase tracking-wide text-[var(--ncx-text-muted)]";

export default function MobileAdvStats({
  table1,
  table2,
  table3,
  table4,
  table5,
  pilotUsage,
  listAverages,
}: {
  table1: Table1Row[];
  table2: Table2Row[];
  table3: Table3Row[];
  table4: Table4Row[];
  table5: Table5Row[];
  pilotUsage: PilotUsageByFaction;
  listAverages: ListAverages;
}) {
  const [tab, setTab] = useState<TabId>("t1");

  const avgShip = useMemo(() => {
    const v = listAverages?.averageShipCount;
    return v != null ? v.toFixed(1) : undefined;
  }, [listAverages]);

  const avgInit = useMemo(() => {
    const v = listAverages?.averagePilotInit;
    return v != null ? v.toFixed(1) : undefined;
  }, [listAverages]);

  return (
    <section className="w-full">
      <div className={`${PANEL} p-3`}>
        <h2 className={TITLE}>Advanced Stats</h2>

        {/* Tabs */}
        <div
          className={[
            "mt-3 grid grid-cols-6 gap-1 rounded-xl border border-[var(--ncx-border)]",
            "bg-[var(--ncx-bg)] p-1",
          ].join(" ")}
        >
          {TAB_DEFS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={[
                  "rounded-lg px-2 py-1.5 text-[11px] transition",
                  active
                    ? "bg-[var(--ncx-accent)] text-[var(--ncx-accent-contrast)] font-semibold"
                    : "text-[var(--ncx-text-secondary)] hover:text-[var(--ncx-text-primary)]",
                ].join(" ")}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="mt-3">
          {tab === "t1" && <Table1Cards rows={table1} />}
          {tab === "t2" && <Table2Cards rows={table2} />}
          {tab === "t3" && <Table3Cards rows={table3} />}
          {tab === "t4" && <Table4Cards rows={table4} />}
          {tab === "t5" && <Table5Cards rows={table5} />}

          {tab === "pilots" && (
            <div className="space-y-3">
              {/* List averages box */}
              <div className={`${CARD} p-2`}>
                <div className={SUBTLE}>List Averages</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <Stat k="Avg Ship Count" v={avgShip} />
                  <Stat k="Avg Pilot Init" v={avgInit} />
                </div>
              </div>

              <MobilePilotUsage pilotUsage={pilotUsage} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------- shared helpers ------------------- */

function Stat({ k, v }: { k: string; v?: string }) {
  return (
    <div className={`rounded-lg ${SOFT} px-2 py-1 text-center`}>
      <div className="uppercase text-[10px] tracking-wide text-[var(--ncx-text-muted)]">
        {k}
      </div>
      <div className="font-semibold tabular-nums text-[var(--ncx-text-primary)]">
        {v ?? "—"}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="mt-4 text-center text-sm text-[var(--ncx-text-muted)]">
      No data.
    </div>
  );
}

function factionDisplayLabel(key: string): string {
  const map: Record<string, string> = {
    rebelalliance: "Rebels",
    galacticempire: "Empire",
    separatistalliance: "CIS",
    republic: "Republic",
    resistance: "Resistance",
    firstorder: "First Order",
    scumandvillainy: "Scum",
  };
  const k = key.toLowerCase();
  if (map[k]) return map[k];
  return k.charAt(0).toUpperCase() + k.slice(1);
}

/* ------------------- Cards ------------------- */

function Table1Cards({ rows }: { rows: Table1Row[] }) {
  if (!rows?.length) return <Empty />;
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={`${r.team}-${i}`} className={`${CARD} p-3`}>
          <div className="flex items-center justify-between gap-3">
            <div className="truncate text-sm font-semibold text-[var(--ncx-text-primary)]">
              {r.team}
            </div>
            <div className="text-xs text-[var(--ncx-text-muted)]">
              Games: {r.totalGames || "—"}
            </div>
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

function Table2Cards({ rows }: { rows: Table2Row[] }) {
  if (!rows?.length) return <Empty />;
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={`${r.scenario}-${i}`} className={`${CARD} p-3`}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[var(--ncx-text-primary)]">
              {r.scenario}
            </div>
            <span className={`${CHIP} text-[var(--ncx-text-secondary)]`}>
              Games: {r.totalGames || "—"}
            </span>
          </div>
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

function Table3Cards({ rows }: { rows: Table3Row[] }) {
  if (!rows?.length) return <Empty />;

  const order: Array<keyof Table3Row> = [
    "republic",
    "cis",
    "rebels",
    "empire",
    "resistance",
    "firstOrder",
    "scum",
  ];
  const labels: Record<string, string> = {
    republic: "Republic",
    cis: "CIS",
    rebels: "Rebels",
    empire: "Empire",
    resistance: "Resistance",
    firstOrder: "First Order",
    scum: "Scum",
  };

  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={`${r.scenario}-${i}`} className={`${CARD} p-3`}>
          <div className="text-sm font-semibold text-[var(--ncx-text-primary)]">
            {r.scenario}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {order.map((k) => (
              <div key={String(k)} className={`rounded-lg ${SOFT} px-2 py-1`}>
                <div className="text-[10px] uppercase tracking-wide text-[var(--ncx-text-muted)]">
                  {labels[k]}
                </div>
                <div className="font-semibold tabular-nums text-[var(--ncx-text-primary)]">
                  {(r[k] as string) || "—"}
                </div>
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Table4Cards({ rows }: { rows: Table4Row[] }) {
  if (!rows?.length) return <Empty />;

  const order: Array<keyof Table4Row> = [
    "republic",
    "cis",
    "rebels",
    "empire",
    "resistance",
    "firstOrder",
    "scum",
  ];
  const labels: Record<string, string> = {
    republic: "Republic",
    cis: "CIS",
    rebels: "Rebels",
    empire: "Empire",
    resistance: "Resistance",
    firstOrder: "First Order",
    scum: "Scum",
  };

  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={`${r.factionVs}-${i}`} className={`${CARD} p-3`}>
          <div className="text-sm font-semibold text-[var(--ncx-text-primary)]">
            {r.factionVs}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {order.map((k) => (
              <div key={String(k)} className={`rounded-lg ${SOFT} px-2 py-1`}>
                <div className="text-[10px] uppercase tracking-wide text-[var(--ncx-text-muted)]">
                  {labels[k]}
                </div>
                <div className="font-semibold tabular-nums text-[var(--ncx-text-primary)]">
                  {(r[k] as string) || "—"}
                </div>
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Table5Cards({ rows }: { rows: Table5Row[] }) {
  if (!rows?.length) return <Empty />;
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={`${r.faction}-${i}`} className={`${CARD} p-3`}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[var(--ncx-text-primary)]">
              {r.faction}
            </div>
            <span className={`${CHIP} text-[var(--ncx-text-secondary)]`}>
              Win%: {r.winPct || "—"}
            </span>
          </div>
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

/* ------------------- Mobile Pilot Usage ------------------- */

function MobilePilotUsage({ pilotUsage }: { pilotUsage: PilotUsageByFaction }) {
  const factionKeys = useMemo(() => Object.keys(pilotUsage || {}), [pilotUsage]);
  const [selected, setSelected] = useState<string>(() => factionKeys[0] ?? "");

  // keep selected valid if data changes
  useMemo(() => {
    if (!selected && factionKeys[0]) setSelected(factionKeys[0]);
    if (selected && factionKeys.length && !factionKeys.includes(selected)) {
      setSelected(factionKeys[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factionKeys.join("|")]);

  if (!factionKeys.length) return <Empty />;

  const rows = pilotUsage[selected] ?? [];
  const maxUses = rows.length ? Math.max(...rows.map((r) => r.uses ?? 0)) : 0;

  return (
    <div className="space-y-3">
      {/* faction chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {factionKeys.map((key) => {
          const label = factionDisplayLabel(key);
          const isActive = key === selected;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={[
                "whitespace-nowrap rounded-full border px-3 py-1 text-xs transition",
                isActive
                  ? "border-[var(--ncx-accent)] bg-[var(--ncx-accent-soft)] text-[var(--ncx-text-primary)]"
                  : "border-[var(--ncx-border)] bg-[var(--ncx-bg)] text-[var(--ncx-text-secondary)] hover:text-[var(--ncx-text-primary)] hover:border-[var(--ncx-accent)]",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* list with internal scroll */}
      <div className="max-h-[420px] overflow-y-auto rounded-xl border border-[var(--ncx-border)] bg-[color:color-mix(in_oklab,var(--ncx-bg)_65%,transparent)]">
        {rows.length === 0 ? (
          <div className="py-4 text-center text-sm text-[var(--ncx-text-muted)]">
            No lists recorded for this faction yet.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--ncx-border)]">
            {rows.map((r, idx) => {
              const ratio = maxUses > 0 ? Math.max(0.05, r.uses / maxUses) : 0;

              return (
                <li key={`${r.pilotId}-${idx}`} className="px-3 py-2 flex items-center gap-3">
                  {r.shipGlyph ? (
                    <span className="ship-icons text-xl leading-none text-[var(--ncx-text-secondary)]">
                      {r.shipGlyph}
                    </span>
                  ) : (
                    <span className="ship-icons text-xl leading-none text-[var(--ncx-text-muted)]">
                      —
                    </span>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm text-[var(--ncx-text-primary)]">
                      {r.pilotName}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-28">
                    <div className="flex-1 h-1.5 rounded-full bg-[color:color-mix(in_oklab,var(--ncx-border)_60%,transparent)] overflow-hidden">
                      <div
                        className="h-1.5 rounded-full bg-[var(--ncx-accent)]"
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-xs text-[var(--ncx-text-primary)]">
                      {r.uses}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
