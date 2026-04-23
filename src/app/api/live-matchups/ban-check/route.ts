// src/app/api/live-matchups/ban-check/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isDiscordIdBanned } from "@/app/api/live-matchups/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "").trim().replace(/[<@!>]/g, "").replace(/\D/g, "");
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = normalizeDiscordId(
      (session?.user as any)?.discordId ?? (session?.user as any)?.id
    );
    if (!discordId) {
      return NextResponse.json({ banned: false, signedIn: false });
    }
    const banned = await isDiscordIdBanned(discordId);
    return NextResponse.json({ banned, signedIn: true });
  } catch (err: any) {
    console.error("GET /api/live-matchups/ban-check error:", err);
    return NextResponse.json({ banned: false, signedIn: false });
  }
}
