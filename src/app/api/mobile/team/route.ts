/**
 * GET /api/mobile/team?slug=
 * Returns team detail page data
 *
 * Query params:
 *   slug - team slug (required)
 *
 * Returns: {
 *   teamName: string,
 *   schedule: ScheduleRow[],
 *   players: Array<IndStatsRow>,
 *   factionMap: Record<string, Faction>
 * }
 */

import { NextResponse } from "next/server";
import {
  fetchScheduleForTeam,
  fetchIndStatsDataCached,
  fetchFactionMapCached,
  fetchOverallStandingsCached,
} from "@/lib/googleSheets";
import { teamSlug } from "@/lib/slug";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return NextResponse.json(
        { error: "Missing slug parameter" },
        { status: 400 }
      );
    }

    // Get team name from slug by matching against all standings
    const standings = await fetchOverallStandingsCached();
    const resolvedTeamName = standings.find((t) => teamSlug(t.team) === slug)?.team;

    if (!resolvedTeamName) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    // Fetch team data
    const [schedule, allIndStats, factionMap] = await Promise.all([
      fetchScheduleForTeam(resolvedTeamName),
      fetchIndStatsDataCached(),
      fetchFactionMapCached(),
    ]);

    // Filter individual stats to just this team
    const players = allIndStats.filter(
      (p) => p.team === resolvedTeamName
    );

    return NextResponse.json({
      teamName: resolvedTeamName,
      schedule,
      players,
      factionMap,
    });
  } catch (e) {
    console.error("[mobile/team] GET error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
