import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await pool.query<any[]>(
      `
        SELECT
          t.\`rank\`      AS \`rank\`,
          t.\`team\`      AS team,
          t.\`wins\`      AS wins,
          t.\`losses\`    AS losses,
          t.\`game_wins\` AS gameWins,
          t.\`points\`    AS points
        FROM S9.\`overall_standings\` AS t
        ORDER BY t.\`rank\` ASC
      `
    );

    const items = (rows ?? []).map((r: any) => ({
      rank: Number(r.rank),
      team: String(r.team ?? ""),
      wins: Number(r.wins ?? 0),
      losses: Number(r.losses ?? 0),
      gameWins: Number(r.gameWins ?? 0),
      points: Number(r.points ?? 0),
    }));

    return NextResponse.json({ items });
  } catch (err: any) {
    console.error("GET /api/standings error:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to fetch standings" },
      { status: 500 }
    );
  }
}
