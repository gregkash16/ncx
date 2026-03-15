/**
 * GET /api/mobile/matchups?w=
 * Returns matchup data for a given week
 *
 * Query params:
 *   w - week number (optional, defaults to active week)
 *
 * Returns: {
 *   rows: Matchup[],
 *   weekLabel: string,
 *   activeWeek: number | null,
 *   scheduleWeek: number | null,
 *   scheduleMap: Record<string, Schedule>,
 *   factionMap: Record<string, Faction>,
 *   listsMap: Record<string, List>
 * }
 */

import { NextResponse } from "next/server";
import {
  fetchMatchupsDataCached,
  fetchStreamScheduleCached,
  fetchFactionMapCached,
  fetchListsForWeekCached,
} from "@/lib/googleSheets";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const weekParam = url.searchParams.get("w");

    // Get matchup data
    const matchupData = await fetchMatchupsDataCached();
    const weekLabel = matchupData.weekTab;

    // Determine which week to return
    let targetWeek = weekLabel;
    if (weekParam) {
      targetWeek = `WEEK ${parseInt(weekParam, 10)}`;
    }

    // Fetch all required data
    const [schedule, factionMap, listsMap] = await Promise.all([
      fetchStreamScheduleCached(),
      fetchFactionMapCached(),
      fetchListsForWeekCached(targetWeek),
    ]);

    // Extract matchups for the target week from the matchup data
    const rows = matchupData.matches ?? [];

    // Parse week number from weekLabel
    const activeWeekMatch = weekLabel.match(/week\s*(\d+)/i);
    const activeWeek = activeWeekMatch ? parseInt(activeWeekMatch[1], 10) : null;

    const scheduleWeekMatch = targetWeek.match(/week\s*(\d+)/i);
    const scheduleWeek = scheduleWeekMatch
      ? parseInt(scheduleWeekMatch[1], 10)
      : null;

    // Use the schedule map from the schedule object
    const scheduleMap = schedule.scheduleMap ?? {}

    return NextResponse.json({
      rows,
      weekLabel,
      activeWeek,
      scheduleWeek,
      scheduleMap,
      factionMap,
      listsMap,
    });
  } catch (e) {
    console.error("[mobile/matchups] GET error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
