// src/app/components/MatchupsPanelServer.tsx
// Server component: fetches MySQL matchups for the selected week,
// then renders your client MatchupsPanel.

import MatchupsPanel from "./MatchupsPanel";
import {
  fetchIndStatsDataCached,
  fetchFactionMapCached,
  fetchStreamScheduleCached,
  fetchListsForWeekCached,
} from "@/lib/googleSheets";

// Use your existing helpers (you referenced these already)
import {
  getMatchupsForWeek,
  getActiveWeekFromDb,
  normalizeWeekLabel,
} from "@/lib/matchupsDb";

import type { IndRow, FactionMap } from "@/lib/googleSheets";

type MatchupsPanelServerProps = {
  /** Raw week param from the URL (?w=WEEK 6) */
  weekParam?: string | null;
};

export default async function MatchupsPanelServer({
  weekParam,
}: MatchupsPanelServerProps) {
  // 1) Active week from DB
  const activeWeek = await getActiveWeekFromDb(); // e.g. "WEEK 7"

  // 2) Decide which week to show
  const selectedWeek = normalizeWeekLabel(
    weekParam && weekParam.trim() ? weekParam : activeWeek
  );

  // 3) Matchups from MySQL
  const matchData = await getMatchupsForWeek(selectedWeek);

  // 4) Ind stats / faction map (MySQL via your transitional layer)
  const indStats: IndRow[] = (await fetchIndStatsDataCached()) ?? [];
  const factionMap: FactionMap = (await fetchFactionMapCached()) ?? {};

  // 5) Stream schedule (optional)
  const stream = await fetchStreamScheduleCached().catch(() => null);
  const scheduleWeek = stream?.scheduleWeek;
  const scheduleMap = stream?.scheduleMap;

  // 6) Lists for week (optional)
  const lists = await fetchListsForWeekCached(selectedWeek).catch(() => null);
  const listsForWeek = lists?.listsMap;

  // 7) Kill-switch for capsules
  const enableCapsules = process.env.NEXT_PUBLIC_MATCH_CAPSULES === "1";

  return (
    <MatchupsPanel
      data={matchData}
      weekLabel={selectedWeek}
      activeWeek={activeWeek}
      scheduleWeek={scheduleWeek}
      scheduleMap={scheduleMap}
      indStats={indStats}
      factionMap={factionMap}
      listsForWeek={listsForWeek}
      enableCapsules={enableCapsules}
    />
  );
}
