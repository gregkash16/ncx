// src/lib/captains.ts
//
// MySQL-backed captain lookup. Replaces the per-request Google Sheets read
// (`NCXID!K2:O25`) that the matchup-builder routes used to do, which was
// burning Sheets read quota due to 4-second polling.
//
// The S9.captains table is populated by the seed-mysql route's loadCaptains().
// Captains don't change mid-season, so a reseed is the only refresh trigger.

import { pool } from "@/lib/db";

export async function getCaptainTeams(discordId: string): Promise<string[]> {
  if (!discordId) return [];
  const [rows] = await pool.query<any[]>(
    `SELECT team_name FROM S9.captains WHERE discord_id = ?`,
    [discordId]
  );
  return (rows ?? []).map((r: any) => String(r.team_name));
}
