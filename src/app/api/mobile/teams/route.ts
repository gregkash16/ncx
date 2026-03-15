/**
 * Fetch list of teams for mobile client
 */

import { NextResponse } from "next/server";
import { fetchOverallStandingsCached } from "@/lib/googleSheets";

export async function GET() {
  try {
    const standings = await fetchOverallStandingsCached();
    const teams = standings?.map((t: any) => t.team) || [];

    return NextResponse.json({
      ok: true,
      teams,
    });
  } catch (e) {
    console.error("[mobile/teams]", e);
    return NextResponse.json(
      { ok: false, reason: "SERVER_ERROR", teams: [] },
      { status: 500 }
    );
  }
}
