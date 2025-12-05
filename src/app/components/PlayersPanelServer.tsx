// src/app/components/PlayersPanelServer.tsx
// Server Component (no 'use client')

import PlayersPanel from "./PlayersPanel";
import { getMysqlPool } from "@/lib/mysql";
import { fetchVideosByNCXID } from "@/lib/youtube";

/**
 * Exported so PlayersPanel.tsx (client) can `import type { PlayerRow }`.
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
  seasons: (string | null)[];
  championships: string;
};

/** Playlists to scan for tagged videos */
export const PLAYLIST_IDS: string[] = [
  "PLthDdnmc3AhMNcXcyb6thZpdCjWbt8RoP", // S8
  "PLthDdnmc3AhPIAWm3Eg14LKA-DXDcqsGf", // S7
  "PLthDdnmc3AhMAmg_RiTD6M5_Im5Me9Pb-", // S6
  "PLthDdnmc3AhObY8AVPxno8D5eIUMPTTh0", // S5
  "PLthDdnmc3AhMXKzs-EVzwT1sibGpOXLGo", // S4
  "PLthDdnmc3AhPeLNZTI36p2eMFkSk1JbqM", // S3
  "PLthDdnmc3AhNxzabFnsm3kKVWNXl5qdkG", // S2
  "PLthDdnmc3AhNfRyS_9RA3PY6v1g2ZmYLz", // S1
];

/** Helper: numeric sort based on NCXID */
function ncxNumber(id: string): number {
  const m = (id || "").match(/\d+/);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
}

/** Main server component */
export default async function PlayersPanelServer() {
  const pool = getMysqlPool();

  try {
    const [rows] = await pool.query<any[]>(`
      SELECT
        ncxid,
        first_name,
        last_name,
        discord,
        wins,
        losses,
        points,
        plms,
        games,
        win_pct,
        ppg,
        s1, s2, s3, s4, s5, s6, s7, s8,
        championships
      FROM S8.all_time_stats
      ORDER BY id ASC
    `);

    const data: PlayerRow[] = rows.map((r) => ({
      ncxid: String(r.ncxid ?? ""),
      first: String(r.first_name ?? ""),
      last: String(r.last_name ?? ""),
      discord: String(r.discord ?? ""),
      wins: String(r.wins ?? ""),
      losses: String(r.losses ?? ""),
      points: String(r.points ?? ""),
      plms: String(r.plms ?? ""),
      games: String(r.games ?? ""),
      winPct: String(r.win_pct ?? ""),
      ppg: String(r.ppg ?? ""),
      seasons: [
        r.s1 || null,
        r.s2 || null,
        r.s3 || null,
        r.s4 || null,
        r.s5 || null,
        r.s6 || null,
        r.s7 || null,
        r.s8 || null,
      ],
      championships: String(r.championships ?? ""),
    }));

    // Sort NCXID numerically: NCX01 → NCX99
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
        Failed to load Player Stats. {String(err?.message ?? "")}
      </div>
    );
  }
}

/** Optional server helper for fetching videos for an NCXID */
export async function fetchPlayerVideos(ncxid: string) {
  if (!ncxid || !PLAYLIST_IDS.length) return [];

  try {
    const videos = await fetchVideosByNCXID(ncxid, PLAYLIST_IDS);
    return videos.map((v) => ({
      id: v.id,
      title: v.title,
      tags: v.tags ?? [],
      thumb: `https://img.youtube.com/vi/${v.id}/mqdefault.jpg`,
      embedUrl: `https://www.youtube.com/embed/${v.id}`,
    }));
  } catch {
    return [];
  }
}
