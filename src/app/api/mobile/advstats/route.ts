/**
 * GET /api/mobile/advstats
 * Returns advanced statistics
 *
 * Returns: {
 *   t1: any,
 *   t2: any,
 *   t3: any,
 *   t4: any,
 *   t5: any,
 *   pilotUsage: PilotUsageByFaction,
 *   listAverages: ListAverages
 * }
 */

import { NextResponse } from "next/server";
import {
  fetchAdvStatsCached,
  fetchPilotUsageByFactionCached,
  fetchListAveragesCached,
} from "@/lib/googleSheets";

export async function GET(req: Request) {
  try {
    const [advStats, pilotUsage, listAverages] = await Promise.all([
      fetchAdvStatsCached(),
      fetchPilotUsageByFactionCached(),
      fetchListAveragesCached(),
    ]);

    return NextResponse.json({
      t1: advStats.t1,
      t2: advStats.t2,
      t3: advStats.t3,
      t4: advStats.t4,
      t5: advStats.t5,
      pilotUsage,
      listAverages,
    });
  } catch (e) {
    console.error("[mobile/advstats] GET error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
