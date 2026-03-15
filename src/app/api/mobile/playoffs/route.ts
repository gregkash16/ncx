/**
 * Playoff bracket data for mobile
 */

import { NextResponse } from "next/server";
import { fetchPlayoffBracket } from "@/lib/googleSheets";

export async function GET() {
  try {
    const bracket = await fetchPlayoffBracket();

    return NextResponse.json({
      ok: true,
      bracket: bracket || {},
    });
  } catch (e) {
    console.error("[mobile/playoffs]", e);
    return NextResponse.json(
      { ok: false, reason: "SERVER_ERROR", bracket: {} },
      { status: 500 }
    );
  }
}
