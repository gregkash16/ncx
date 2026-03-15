/**
 * Individual player statistics for mobile
 */

import { NextResponse } from "next/server";
import { fetchIndStatsData } from "@/lib/googleSheets";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("q")?.toLowerCase() || "";

    let stats = await fetchIndStatsData();

    // Filter by name or team if search query provided
    if (search) {
      stats = stats.filter(
        (s: any) =>
          s.first?.toLowerCase().includes(search) ||
          s.last?.toLowerCase().includes(search) ||
          s.team?.toLowerCase().includes(search) ||
          s.faction?.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      ok: true,
      stats: stats.slice(0, 100), // Limit to 100 for mobile
    });
  } catch (e) {
    console.error("[mobile/indstats]", e);
    return NextResponse.json(
      { ok: false, reason: "SERVER_ERROR", stats: [] },
      { status: 500 }
    );
  }
}
