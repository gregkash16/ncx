// src/app/api/indstats/route.ts
import { NextResponse } from "next/server";
import { fetchIndStatsDataCached } from "@/lib/googleSheets";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(50, Math.max(5, Number(searchParams.get("limit") || 25)));

  if (!q) return NextResponse.json({ items: [] });

  const all = (await fetchIndStatsDataCached()) ?? [];

  const matches = all.filter((r: any) => {
    const name = `${r.first ?? ""} ${r.last ?? ""}`.toLowerCase();
    const ncxid = String(r.ncxid ?? "").toLowerCase();
    const team = String(r.team ?? "").toLowerCase();
    const faction = String(r.faction ?? "").toLowerCase();
    return (
      name.includes(q) ||
      ncxid.includes(q) ||
      team.includes(q) ||
      faction.includes(q)
    );
  });

  // sort: GP desc, then rank asc (numeric), then name
  matches.sort((a: any, b: any) => {
    const agp = Number(a.games ?? 0);
    const bgp = Number(b.games ?? 0);
    if (bgp !== agp) return bgp - agp;

    const ar = Number(a.rank ?? 1e9);
    const br = Number(b.rank ?? 1e9);
    if (!Number.isNaN(ar) && !Number.isNaN(br) && ar !== br) return ar - br;

    const an = `${a.first ?? ""} ${a.last ?? ""}`.trim();
    const bn = `${b.first ?? ""} ${b.last ?? ""}`.trim();
    return an.localeCompare(bn);
  });

  // project only fields we care about for cards; preserve numeric types where helpful
  const items = matches.slice(0, limit).map((r: any) => ({
    rank: Number(r.rank ?? 0),
    ncxid: String(r.ncxid ?? ""),
    first: String(r.first ?? ""),
    last: String(r.last ?? ""),
    pick: Number(r.pick ?? 0),
    team: String(r.team ?? ""),
    faction: String(r.faction ?? ""),
    wins: Number(r.wins ?? 0),
    losses: Number(r.losses ?? 0),
    points: Number(r.points ?? 0),
    plms: Number(r.plms ?? 0),
    games: Number(r.games ?? 0),
    winPct: Number(r.winPct ?? 0),
    ppg: Number(r.ppg ?? 0),
    efficiency: Number(r.efficiency ?? 0),
    war: Number(r.war ?? 0),
    h2h: Number(r.h2h ?? 0),
    potato: Number(r.potato ?? 0),
    sos: Number(r.sos ?? 0),
  }));

  return NextResponse.json({ items });
}
