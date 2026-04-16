// src/app/api/indstats/route.ts
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(50, Math.max(5, Number(searchParams.get("limit") || 25)));

  if (!q) return NextResponse.json({ items: [] });

  const like = `%${q}%`;

  const [rows] = await pool.query<any[]>(
    `
    SELECT
      \`rank\`,
      ncxid,
      first_name,
      last_name,
      pick_no,
      team,
      faction,
      wins,
      losses,
      points,
      plms,
      games,
      winper,
      ppg,
      efficiency,
      war,
      h2h,
      potato,
      sos
    FROM individual_stats
    WHERE
         LOWER(CONCAT(first_name, ' ', last_name)) LIKE ?
      OR LOWER(ncxid) LIKE ?
      OR LOWER(team) LIKE ?
      OR LOWER(faction) LIKE ?
    ORDER BY
      CAST(games AS UNSIGNED) DESC,
      CAST(\`rank\` AS UNSIGNED) ASC,
      first_name ASC,
      last_name ASC
    LIMIT ?
    `,
    [like, like, like, like, limit]
  );

  const items = (rows ?? []).map((r: any) => ({
    rank: Number(r.rank ?? 0),
    ncxid: String(r.ncxid ?? ""),
    first: String(r.first_name ?? ""),
    last: String(r.last_name ?? ""),
    pick: Number(r.pick_no ?? 0),
    team: String(r.team ?? ""),
    faction: String(r.faction ?? ""),
    wins: Number(r.wins ?? 0),
    losses: Number(r.losses ?? 0),
    points: Number(r.points ?? 0),
    plms: Number(r.plms ?? 0),
    games: Number(r.games ?? 0),
    winPct: Number(r.winper ?? 0),
    ppg: Number(r.ppg ?? 0),
    efficiency: Number(r.efficiency ?? 0),
    war: Number(r.war ?? 0),
    h2h: Number(r.h2h ?? 0),
    potato: Number(r.potato ?? 0),
    sos: Number(r.sos ?? 0),
  }));

  return NextResponse.json({ items });
}
