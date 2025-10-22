'use client';

import { useMemo, useState } from "react";
import type { IndRow } from "@/lib/googleSheets";

type Props = { data: IndRow[] };

// Small helper for sortable headers
function Th({
  children,
  onClick,
  active,
  dir,
  className = "",
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: "asc" | "desc";
  className?: string;
  title?: string;
}) {
  return (
    <th
      onClick={onClick}
      title={title ?? "Click to sort"}
      className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-300 whitespace-nowrap cursor-pointer select-none ${className}`}
    >
      {children}
      {active ? (dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}

export default function IndStatsPanel({ data }: Props) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof IndRow>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // You said you removed Discord + Predicted Wins/Losses, so we won't render those columns.
  // Search by name/NCXID/team/faction.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) => {
      const inName =
        r.first.toLowerCase().includes(q) ||
        r.last.toLowerCase().includes(q);
      const inNcx = r.ncxid.toLowerCase().includes(q);
      const inTeam = r.team.toLowerCase().includes(q);
      const inFaction = r.faction.toLowerCase().includes(q);
      return inName || inNcx || inTeam || inFaction;
    });
  }, [data, query]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = (a[sortKey] ?? "").toString();
      const bv = (b[sortKey] ?? "").toString();
      const an = Number(av), bn = Number(bv);
      const bothNums = !Number.isNaN(an) && !Number.isNaN(bn);
      let cmp = 0;
      if (bothNums) cmp = an - bn;
      else cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const onSort = (k: keyof IndRow) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const headRowCls = "bg-zinc-950/70 border-b border-zinc-800 sticky top-0 z-10";
  const rowCls =
    "even:bg-zinc-900/30 odd:bg-zinc-900/10 hover:bg-zinc-800/40 transition-colors border-b border-zinc-800";
  const cell = "px-3 py-2 text-sm text-zinc-200";
  const num = `${cell} font-mono tabular-nums`;

  return (
    <div className="w-full">
      <div className="w-full rounded-2xl bg-zinc-900/70 border border-zinc-800 p-3 sm:p-4 md:p-6 shadow-xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg md:text-xl font-semibold text-cyan-400">
            INDIVIDUAL STATS
          </h2>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, NCXID, team, faction…"
            className="w-full md:w-96 bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>

        {/* REAL TABLE + EXPLICIT COLUMN WIDTHS */}
        <div className="relative w-full overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full table-auto">
            {/* Explicit widths (like a spreadsheet) so headers & cells always align */}
            <colgroup>
              <col style={{ width: 48 }} />   {/* Rank */}
              <col style={{ width: 88 }} />   {/* NCXID */}
              <col style={{ width: 140 }} />  {/* First */}
              <col style={{ width: 140 }} />  {/* Last */}
              <col style={{ width: 72 }} />   {/* Pick */}
              <col style={{ width: 220 }} />  {/* Team */}
              <col style={{ width: 140 }} />  {/* Faction */}
              <col style={{ width: 56 }} />   {/* W */}
              <col style={{ width: 56 }} />   {/* L */}
              <col style={{ width: 72 }} />   {/* Pts */}
              <col style={{ width: 84 }} />   {/* PL/MS */}
              <col style={{ width: 64 }} />   {/* GP */}
              <col style={{ width: 76 }} />   {/* Win% */}
              <col style={{ width: 72 }} />   {/* PPG */}
              <col style={{ width: 72 }} />   {/* Eff */}
              <col style={{ width: 72 }} />   {/* WAR */}
              <col style={{ width: 72 }} />   {/* H2H */}
              <col style={{ width: 76 }} />   {/* Potato */}
              <col style={{ width: 72 }} />   {/* SOS */}
            </colgroup>

            <thead className={headRowCls}>
              <tr>
                <Th onClick={() => onSort("rank")} active={sortKey==="rank"} dir={sortDir}>Rk</Th>
                <Th onClick={() => onSort("ncxid")} active={sortKey==="ncxid"} dir={sortDir}>NCXID</Th>
                <Th onClick={() => onSort("first")} active={sortKey==="first"} dir={sortDir}>First</Th>
                <Th onClick={() => onSort("last")} active={sortKey==="last"} dir={sortDir}>Last</Th>
                <Th onClick={() => onSort("pick")} active={sortKey==="pick"} dir={sortDir}>Pick</Th>
                <Th onClick={() => onSort("team")} active={sortKey==="team"} dir={sortDir}>Team</Th>
                <Th onClick={() => onSort("faction")} active={sortKey==="faction"} dir={sortDir}>Faction</Th>
                <Th onClick={() => onSort("wins")} active={sortKey==="wins"} dir={sortDir}>W</Th>
                <Th onClick={() => onSort("losses")} active={sortKey==="losses"} dir={sortDir}>L</Th>
                <Th onClick={() => onSort("points")} active={sortKey==="points"} dir={sortDir}>Pts</Th>
                <Th onClick={() => onSort("plms")} active={sortKey==="plms"} dir={sortDir}>PL/MS</Th>
                <Th onClick={() => onSort("games")} active={sortKey==="games"} dir={sortDir}>GP</Th>
                <Th onClick={() => onSort("winPct")} active={sortKey==="winPct"} dir={sortDir}>Win%</Th>
                <Th onClick={() => onSort("ppg")} active={sortKey==="ppg"} dir={sortDir}>PPG</Th>
                <Th onClick={() => onSort("efficiency")} active={sortKey==="efficiency"} dir={sortDir}>Eff</Th>
                <Th onClick={() => onSort("war")} active={sortKey==="war"} dir={sortDir}>WAR</Th>
                <Th onClick={() => onSort("h2h")} active={sortKey==="h2h"} dir={sortDir}>H2H</Th>
                <Th onClick={() => onSort("potato")} active={sortKey==="potato"} dir={sortDir}>Potato</Th>
                <Th onClick={() => onSort("sos")} active={sortKey==="sos"} dir={sortDir}>SOS</Th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-800">
                {sorted.map((r) => (
                  <tr key={r.ncxid} className={rowCls}>
                  <td className={num}>{r.rank}</td>
                  <td className={`${cell} font-semibold text-cyan-300`}>{r.ncxid}</td>
                  <td className={cell}>{r.first}</td>
                  <td className={cell}>{r.last}</td>
                  <td className={num}>{r.pick}</td>

                  {/* Team/Faction: truncate with tooltip to avoid overlap */}
                  <td className={`${cell} truncate`} title={r.team}>{r.team}</td>
                  <td className={`${cell} truncate`} title={r.faction}>{r.faction}</td>

                  <td className={num}>{r.wins}</td>
                  <td className={num}>{r.losses}</td>
                  <td className={num}>{r.points}</td>
                  <td className={num}>{r.plms}</td>
                  <td className={num}>{r.games}</td>
                  <td className={num}>{r.winPct}</td>
                  <td className={num}>{r.ppg}</td>
                  <td className={num}>{r.efficiency}</td>
                  <td className={num}>{r.war}</td>
                  <td className={num}>{r.h2h}</td>
                  <td className={num}>{r.potato}</td>
                  <td className={num}>{r.sos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Subtle divider below the table, optional */}
        <div className="mt-4 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
      </div>
    </div>
  );
}
