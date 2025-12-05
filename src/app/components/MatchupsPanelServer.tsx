// src/app/components/MatchupsPanelServer.tsx
// Server component: fetches MySQL matchups for the selected week,
// then renders your existing client MatchupsPanel.

import MatchupsPanel from "./MatchupsPanel";
import { getMatchupsForWeek, getActiveWeekFromDb, normalizeWeekLabel } from "@/lib/matchupsDb";
import { fetchIndStatsDataCached } from "@/lib/googleSheets"; // you already used this in IndStatsPanelServer
import type { IndRow, FactionMap } from "@/lib/googleSheets";

// If you already have a helper that builds the faction map (NCXID -> faction),
// you can import it instead of this placeholder.
async function getFactionMapFromSheets(): Promise<FactionMap> {
  // If you already have a helper for this, replace this entire function with that.
  // Otherwise, you can keep using whatever you had in page.tsx before.
  return {} as FactionMap;
}

type MatchupsPanelServerProps = {
  /** Raw week param from the URL (?w=WEEK 6) */
  weekParam?: string | null;
};

export default async function MatchupsPanelServer({
  weekParam,
}: MatchupsPanelServerProps) {
  // 1) Figure out active week from DB
  const activeWeek = await getActiveWeekFromDb(); // e.g. "WEEK 7"

  // 2) Decide which week to show
  const selectedWeek = normalizeWeekLabel(
    weekParam && weekParam.trim() ? weekParam : activeWeek
  );

  // 3) Load matchups for that week from MySQL
  const matchData = await getMatchupsForWeek(selectedWeek);

  // 4) Still reuse Ind Stats from Sheets (for now)
  const indStats: IndRow[] = (await fetchIndStatsDataCached()) ?? [];

  // 5) Faction map (NCXID -> faction). If you already build this in page.tsx,
  //    you can pass it in as a prop instead of fetching here.
  const factionMap: FactionMap = await getFactionMapFromSheets();

  // 6) If you have stream schedule / lists for week in MySQL, you can
  //    import analogous helpers and build these here.
  const scheduleWeek = activeWeek; // or selectedWeek, depending on your logic
  const scheduleMap = undefined;   // TODO: plug in if you have a schedule table
  const listsForWeek = undefined;  // TODO: plug in if you have a lists table

  return (
    <MatchupsPanel
      data={matchData}
      weekLabel={selectedWeek}   // “currently showing” label
      activeWeek={activeWeek}   // “gold pill = current week”
      scheduleWeek={scheduleWeek}
      scheduleMap={scheduleMap}
      indStats={indStats}
      factionMap={factionMap}
      listsForWeek={listsForWeek}
    />
  );
}
