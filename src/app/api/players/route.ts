// src/app/api/players/route.ts
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Player = {
  ncxid: string;
  first: string;
  last: string;
  discord: string;
  wins: number;
  losses: number;
  points: number;
  plms: number;
  games: number;
  winPct: number;
  ppg: number;
  seasons: (string | null)[];
  championships: string;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const limit = Math.min(50, Math.max(5, Number(searchParams.get("limit") || 25)));

    if (!q) return NextResponse.json({ items: [] });

    // Mirror the SELECT used in PlayersPanelServer
    const [rows] = await pool.query<any[]>(
      `
      SELECT
        ncxid,
        first_name,
        last_name,
        discord,
        wins,
        losses,
        points,
        plms,
        games,
        win_pct,
        ppg,
        s1, s2, s3, s4, s5, s6, s7, s8, s9,
        championships
      FROM S9.all_time_stats
      ORDER BY id ASC
      `
    );

    const all: Player[] = (rows ?? [])
      .map((r) => {
        const first = (r.first_name ?? "").toString().trim();
        if (!first) return null; // skip blank rows

        return {
          ncxid: (r.ncxid ?? "").toString().trim(),
          first,
          last: (r.last_name ?? "").toString().trim(),
          discord: (r.discord ?? "").toString().trim(),

          wins: Number(r.wins ?? 0),
          losses: Number(r.losses ?? 0),
          points: Number(r.points ?? 0),
          plms: Number(r.plms ?? 0),
          games: Number(r.games ?? 0),
          winPct: Number(r.win_pct ?? 0),
          ppg: Number(r.ppg ?? 0),

          seasons: [
            r.s1 || null,
            r.s2 || null,
            r.s3 || null,
            r.s4 || null,
            r.s5 || null,
            r.s6 || null,
            r.s7 || null,
            r.s8 || null,
            r.s9 || null,
          ],

          championships: (r.championships ?? "").toString().trim(),
        };
      })
      .filter(Boolean) as Player[];

    // search by ncxid / name / discord
    const matches = all.filter((p) => {
      const name = `${p.first} ${p.last}`.toLowerCase();
      const discord = (p.discord || "").toLowerCase();
      return (
        p.ncxid.toLowerCase().includes(q) ||
        name.includes(q) ||
        discord.includes(q)
      );
    });

    // sort: games desc, then wins desc, then ncxid
    matches.sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.ncxid.localeCompare(b.ncxid, undefined, { numeric: true });
    });

    return NextResponse.json({ items: matches.slice(0, limit) });
  } catch (err: any) {
    console.error("GET /api/players error:", err);
    return NextResponse.json(
      { items: [], ok: false, error: err?.message || "Failed to load players" },
      { status: 500 }
    );
  }
}
