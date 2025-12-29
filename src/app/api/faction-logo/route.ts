// src/app/api/faction-logo/route.ts
import { NextRequest } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normFaction(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

// Maps any normalized faction string -> exact PNG filename in /public/factions
const FACTION_TO_FILE: Record<string, string> = {
  REPUBLIC: "Republic.png",
  CIS: "CIS.png",
  REBELS: "Rebels.png",
  EMPIRE: "Empire.png",
  RESISTANCE: "Resistance.png",
  "FIRST ORDER": "First Order.png",
  SCUM: "Scum.png",
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const factionRaw = searchParams.get("faction");
    const key = normFaction(factionRaw);

    const fileName = FACTION_TO_FILE[key];
    if (!fileName) {
      return new Response(`Unknown faction: ${String(factionRaw ?? "")}`, { status: 400 });
    }

    // Resolve file from /public/factions
    const filePath = path.join(process.cwd(), "public", "factions", fileName);

    const buf = await fs.readFile(filePath);

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    console.error("GET /api/faction-logo error:", err);
    return new Response("Server error", { status: 500 });
  }
}
