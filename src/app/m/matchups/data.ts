// /src/app/m/matchups/data.ts
// Mobile data adapter that uses your real Google Sheets loaders.

import type { MatchRow, IndRow, StreamSchedule } from "../../../lib/googleSheets";
import {
  fetchMatchupsDataCached,      // returns { weekTab, matches }
  fetchIndStatsDataCached,      // returns IndRow[]
  fetchStreamScheduleCached,    // returns { scheduleWeek, scheduleMap }
  fetchFactionMapCached,        // returns Record<ncxid, Faction>
} from "../../../lib/googleSheets";

type ScheduleMap = StreamSchedule["scheduleMap"];

function parseWeekNum(label?: string | null): number | null {
  if (!label) return null;
  const m = label.trim().match(/week\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Returns matchups for the requested week (if valid) or the active week.
 * Also returns both the shown week label and the true active week so the client
 * can render the week strip and guard selection.
 */
export async function getMobileMatchupsData(selectedWeek?: string): Promise<{
  rows: MatchRow[];
  weekLabel: string;               // label of the *shown* data (selected or active)
  activeWeek: string;              // true active week (SCHEDULE!U2)
  scheduleWeek: string;
  scheduleMap: ScheduleMap;
  indStats: IndRow[];
  factionMap: Record<string, string>;
}> {
  // First fetch active week
  const [{ weekTab: activeWeek, matches: activeMatches }, schedule, indStats, factionMap] =
    await Promise.all([
      fetchMatchupsDataCached(),    // { weekTab, matches } for active week
      fetchStreamScheduleCached(),  // { scheduleWeek, scheduleMap }
      fetchIndStatsDataCached(),    // IndRow[]
      fetchFactionMapCached(),      // Record<string, string>
    ]);

  // Validate requested week (must be <= active)
  const reqNum = parseWeekNum(selectedWeek);
  const activeNum = parseWeekNum(activeWeek);
  const weekToShow =
    reqNum && activeNum && reqNum <= activeNum ? selectedWeek : activeWeek;

  // If showing a past week, fetch that week’s matches (cached by key)
  const { weekTab: weekLabel, matches } =
    weekToShow === activeWeek
      ? { weekTab: activeWeek, matches: activeMatches }
      : await fetchMatchupsDataCached(weekToShow);

  // Keep only rows with numeric game id (mirrors desktop behavior)
  const rows = (matches || []).filter((m) => /^\d+$/.test((m.game || "").trim()));

  return {
    rows,
    weekLabel: weekLabel || "",
    activeWeek: activeWeek || "",
    scheduleWeek: schedule.scheduleWeek || "",
    scheduleMap: schedule.scheduleMap || {},
    indStats: indStats || [],
    factionMap: factionMap || {},
  };
}
