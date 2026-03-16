/**
 * Player individual stats for mobile home screen
 */

import { NextResponse } from "next/server";
import { fetchIndStatsData } from "@/lib/googleSheets";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ncxid = url.searchParams.get("ncxid");

    if (!ncxid) {
      return NextResponse.json(
        { ok: false, reason: "MISSING_NCXID", stats: null },
        { status: 400 }
      );
    }

    const allStats = await fetchIndStatsData();
    const playerStats = allStats.find(
      (s: any) => s.ncxid?.toUpperCase() === ncxid.toUpperCase()
    );

    if (!playerStats) {
      return NextResponse.json(
        { ok: false, reason: "PLAYER_NOT_FOUND", stats: null },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      stats: playerStats,
    });
  } catch (e) {
    console.error("[mobile/player-stats]", e);
    return NextResponse.json(
      { ok: false, reason: "SERVER_ERROR", stats: null },
      { status: 500 }
    );
  }
}
