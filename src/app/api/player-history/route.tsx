import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ncxid = (searchParams.get("ncxid") || "").trim();

    if (!ncxid) {
      return NextResponse.json({ ok: false, reason: "Missing ncxid" }, { status: 400 });
    }

    const [rows] = await pool.query<any[]>(
      `
      SELECT
        ncxid,
        first_name,
        last_name,
        wins,
        losses,
        games,
        win_pct,
        points,
        plms,
        ppg,
        adj_ppg,
        championships,
        s1, s2, s3, s4, s5, s6, s7, s8, s9
      FROM S9.all_time_stats
      WHERE ncxid = ?
      LIMIT 1
      `,
      [ncxid]
    );

    if (!rows?.length) {
      return NextResponse.json({ ok: false, reason: "Player not found" }, { status: 404 });
    }

    const r = rows[0];

    const seasons = [
      { season: 1, team: r.s1 },
      { season: 2, team: r.s2 },
      { season: 3, team: r.s3 },
      { season: 4, team: r.s4 },
      { season: 5, team: r.s5 },
      { season: 6, team: r.s6 },
      { season: 7, team: r.s7 },
      { season: 8, team: r.s8 },
      { season: 9, team: r.s9 },
    ].filter((s) => s.team && s.team.trim() !== "");

    return NextResponse.json({
      ok: true,
      ncxid: r.ncxid,
      first: r.first_name,
      last: r.last_name,
      wins: Number(r.wins ?? 0),
      losses: Number(r.losses ?? 0),
      games: Number(r.games ?? 0),
      winPct: Number(r.win_pct ?? 0),
      points: Number(r.points ?? 0),
      plms: Number(r.plms ?? 0),
      ppg: Number(r.ppg ?? 0),
      adj_ppg: Number(r.adj_ppg ?? 0),
      championships: r.championships ?? "",
      seasons,
    });
  } catch (err: any) {
    console.error("GET /api/player-history error:", err);
    return NextResponse.json(
      { ok: false, reason: err?.message || "Failed to load history" },
      { status: 500 }
    );
  }
}
