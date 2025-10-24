// /src/app/m/matchups/data.ts
// Mobile data adapter that uses your real Google Sheets loaders.

import type { MatchRow, IndRow, StreamSchedule } from '../../../lib/googleSheets';
import {
  fetchMatchupsDataCached,      // returns { weekTab, matches }
  fetchIndStatsDataCached,      // returns IndRow[]
  fetchStreamScheduleCached,    // returns { scheduleWeek, scheduleMap }
  fetchFactionMapCached,        // returns Record<ncxid, Faction>
} from '../../../lib/googleSheets';

type ScheduleMap = StreamSchedule['scheduleMap'];

export async function getMobileMatchupsData(): Promise<{
  rows: MatchRow[];
  weekLabel: string;
  scheduleWeek: string;
  scheduleMap: ScheduleMap;
  indStats: IndRow[];
  factionMap: Record<string, string>;
}> {
  const [{ weekTab, matches }, schedule, indStats, factionMap] = await Promise.all([
    fetchMatchupsDataCached(),    // { weekTab, matches }
    fetchStreamScheduleCached(),  // { scheduleWeek, scheduleMap }
    fetchIndStatsDataCached(),    // IndRow[]
    fetchFactionMapCached(),      // Record<string, string>
  ]);

  // Keep only rows with numeric game id (mirrors your desktop behavior nicely)
  const rows = (matches || []).filter((m) => /^\d+$/.test((m.game || '').trim()));

  return {
    rows,
    weekLabel: weekTab || '',
    scheduleWeek: schedule.scheduleWeek || '',
    scheduleMap: schedule.scheduleMap || {},
    indStats: indStats || [],
    factionMap: factionMap || {},
  };
}
