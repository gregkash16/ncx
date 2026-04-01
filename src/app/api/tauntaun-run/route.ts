import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const [rows] = await pool.query<any[]>(
    "SELECT name, score FROM railway.tauntaun_run_leaderboard ORDER BY score DESC LIMIT 5"
  );
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = String(body.name ?? "").toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 3).padEnd(3, " ");
  const score = Math.floor(Number(body.score));

  if (!score || score < 0 || score > 999999) {
    return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  }

  await pool.query(
    "INSERT INTO railway.tauntaun_run_leaderboard (name, score) VALUES (?, ?)",
    [name, score]
  );

  // Return updated top 5
  const [rows] = await pool.query<any[]>(
    "SELECT name, score FROM railway.tauntaun_run_leaderboard ORDER BY score DESC LIMIT 5"
  );
  return NextResponse.json(rows);
}
