/**
 * Playoff bracket data for mobile
 */

import { NextResponse } from "next/server";

export async function GET() {
  try {
    // TODO: Implement playoff bracket data when available
    return NextResponse.json({
      ok: true,
      bracket: {},
    });
  } catch (e) {
    console.error("[mobile/playoffs]", e);
    return NextResponse.json(
      { ok: false, reason: "SERVER_ERROR", bracket: {} },
      { status: 500 }
    );
  }
}
