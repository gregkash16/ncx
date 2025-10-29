// src/app/components/PlayersPanelServer.tsx
// Server Component (no 'use client')
import PlayersPanel from "./PlayersPanel";
import { fetchAllTimeStatsCached } from "@/lib/googleSheets";
import { fetchVideosByNCXID } from "@/lib/youtube";

/**
 * Exported so PlayersPanel.tsx (client) can `import type { PlayerRow } from "./PlayersPanelServer"`.
 * NOTE: Do not add runtime-only fields here unless PlayersPanel also expects them.
 */
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

/**
 * ⬇️ Add your playlist IDs here. Only these will be scanned for ncxid tags.
 * You can update this list at deploy time without touching any client code.
 *
 * Examples:
 *  - https://www.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxx  -> list param is the playlistId
 */
export const PLAYLIST_IDS: string[] = [
  // S8
  "PLthDdnmc3AhMNcXcyb6thZpdCjWbt8RoP",
  // S7
  "PLthDdnmc3AhPIAWm3Eg14LKA-DXDcqsGf",
  // S6
  "PLthDdnmc3AhMAmg_RiTD6M5_Im5Me9Pb-",
  // S5
  "PLthDdnmc3AhObY8AVPxno8D5eIUMPTTh0",
  // S4
  "PLthDdnmc3AhMXKzs-EVzwT1sibGpOXLGo",
  // S3
  "PLthDdnmc3AhPeLNZTI36p2eMFkSk1JbqM",
  // S2
  "PLthDdnmc3AhNxzabFnsm3kKVWNXl5qdkG",
  // S1
  "PLthDdnmc3AhNfRyS_9RA3PY6v1g2ZmYLz",
];


/**
 * Server-helper: fetch videos for an NCXID across the configured playlists.
 * Returns a minimal shape you can pass to a client video gallery.
 *
 * Usage (server-side only):
 *   const vids = await fetchPlayerVideos("NCX123");
 */
export async function fetchPlayerVideos(ncxid: string) {
  if (!ncxid) return [];
  if (!PLAYLIST_IDS.length) return [];

  try {
    const videos = await fetchVideosByNCXID(ncxid, PLAYLIST_IDS);
    // Normalize to a lean shape for the client
    return videos.map(v => ({
      id: v.id,
      title: v.title,
      tags: v.tags ?? [],
      thumb: `https://img.youtube.com/vi/${v.id}/mqdefault.jpg`,
      embedUrl: `https://www.youtube.com/embed/${v.id}`,
    }));
  } catch (err) {
    console.error("[fetchPlayerVideos] Failed:", err);
    return [];
  }
}

/** ---------- existing logic below (unchanged) ---------- */

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

    // Note: We intentionally do NOT pass any YouTube data to PlayersPanel yet,
    // to avoid changing its prop shape. You can fetch on-demand in a client
    // component via an API route that calls `fetchPlayerVideos()`, or create a
    // small server wrapper to hydrate the initial player's videos.

    return <PlayersPanel data={data} />;
  } catch (err: any) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-zinc-300">
        Failed to load Player Stats. {toStr(err?.message)}
      </div>
    );
  }
}
