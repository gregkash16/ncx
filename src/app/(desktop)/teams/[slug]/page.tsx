import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await pool.query<any[]>(
      `
        SELECT DISTINCT awayTeam AS team FROM weekly_matchups
        UNION
        SELECT DISTINCT homeTeam AS team FROM weekly_matchups
        ORDER BY team ASC
      `
    );

    const teams = (rows ?? []).map((r) => r.team).filter(Boolean);

    return NextResponse.json({ ok: true, teams });
  } catch (err: any) {
    console.error("GET /api/teams error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load teams" },
      { status: 500 }
    );
  }
}
