// src/app/api/faction-logo/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normFaction(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

const FACTION_FILE_WEBP: Record<string, string> = {
  CIS: "CIS.webp",
  EMPIRE: "Empire.webp",
  "FIRST ORDER": "First Order.webp",
  REBELS: "Rebels.webp",
  REPUBLIC: "Republic.webp",
  RESISTANCE: "Resistance.webp",
  SCUM: "Scum.webp",
};

// Cache final PNG as Buffer (fast, avoids repeated sharp work)
const cache = new Map<string, Buffer>();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const faction = normFaction(searchParams.get("faction"));

    const file = FACTION_FILE_WEBP[faction];
    if (!file) {
      return NextResponse.json(
        { ok: false, reason: "UNKNOWN_FACTION", faction },
        { status: 400 }
      );
    }

    let pngBuf = cache.get(file);

    if (!pngBuf) {
      const abs = path.join(process.cwd(), "public", "factions", file);
      const webpBuf = await fs.readFile(abs);

      // Convert WebP -> PNG
      pngBuf = await sharp(webpBuf).png().toBuffer();
      cache.set(file, pngBuf);
    }

    // Use Blob so TS/BodyInit never argues
    const blob = new Blob([new Uint8Array(pngBuf)], { type: "image/png" });

    return new NextResponse(blob, {
    status: 200,
    headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
    });

  } catch (err: any) {
    console.error("GET /api/faction-logo error:", err);
    return NextResponse.json(
      { ok: false, reason: err?.message ?? "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
