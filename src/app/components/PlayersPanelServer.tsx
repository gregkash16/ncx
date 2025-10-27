// src/app/components/PlayersPanelServer.tsx
// Server Component (no 'use client')
import PlayersPanel from "./PlayersPanel";
import { fetchAllTimeStatsCached } from "@/lib/googleSheets";

// Exported so PlayersPanel.tsx can `import type { PlayerRow } from "./PlayersPanelServer"`
export type PlayerRow = {
  ncxid: string;
  first: string;
  last: string;
  discord: string;
  wins: string;
  losses: string;
  points: string;
  plms: string;
  games: string;
  winPct: string;
  ppg: string;
  seasons: (string | null)[]; // S1..S8 team names, null if empty
  championships: string;
};

function toStr(v: unknown) {
  return (v ?? "").toString().trim();
}
function ncxNumber(id: string): number {
  const m = (id || "").match(/\d+/);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
}

export default async function PlayersPanelServer() {
  try {
    // Pull from cached helper (10 min revalidate)
    const rows = (await fetchAllTimeStatsCached()) as string[][];

    const data: PlayerRow[] = (rows ?? [])
      .map((r) => {
        const first = toStr(r[1]);
        if (!first) return null; // skip rows without first name

        const seasons = [
          toStr(r[12]) || null, // M: S1
          toStr(r[13]) || null, // N: S2
          toStr(r[14]) || null, // O: S3
          toStr(r[15]) || null, // P: S4
          toStr(r[16]) || null, // Q: S5
          toStr(r[17]) || null, // R: S6
          toStr(r[18]) || null, // S: S7
          toStr(r[19]) || null, // T: S8
        ];

        return {
          ncxid: toStr(r[0]),
          first,
          last: toStr(r[2]),
          discord: toStr(r[3]),
          wins: toStr(r[4]),
          losses: toStr(r[5]),
          points: toStr(r[6]),
          plms: toStr(r[7]),
          games: toStr(r[8]),
          winPct: toStr(r[9]),
          ppg: toStr(r[10]),
          seasons,
          championships: toStr(r[20]), // U: Championships
        };
      })
      .filter(Boolean) as PlayerRow[];

    // Sort by NCXID numeric part: NCX01, NCX02, ..., NCX99
    data.sort((a, b) => {
      const na = ncxNumber(a.ncxid);
      const nb = ncxNumber(b.ncxid);
      if (na !== nb) return na - nb;
      return a.ncxid.localeCompare(b.ncxid, undefined, { numeric: true });
    });

    return <PlayersPanel data={data} />;
  } catch (err: any) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-zinc-300">
        Failed to load Player Stats. {toStr(err?.message)}
      </div>
    );
  }
}
