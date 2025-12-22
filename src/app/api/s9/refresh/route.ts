import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/[<@!>]/g, "")
    .replace(/\D/g, "");
}

function isAdminSession(session: any): boolean {
  // 1) If your auth already injects admin flags, honor them
  if (session?.user?.role === "admin") return true;
  if (session?.user?.isAdmin === true) return true;

  // 2) Fallback: env var list of Discord IDs
  const rawSessionId = (session?.user as any)?.discordId ?? (session?.user as any)?.id;
  const discordId = normalizeDiscordId(rawSessionId);

  const env = process.env.ADMIN_DISCORD_IDS ?? "";
  const allow = new Set(
    env
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  return discordId ? allow.has(discordId) : false;
}


async function triggerSeed() {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const key = process.env.SEED_API_KEY;
  if (!key) throw new Error("Missing SEED_API_KEY");

  const url = `${baseUrl}/api/seed-mysql?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Seed failed: ${res.status} ${txt}`);
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, reason: "NOT_AUTH" }, { status: 401 });
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ ok: false, reason: "NOT_ADMIN" }, { status: 403 });
    }

    await triggerSeed();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("POST /api/s9/refresh error:", err);
    return NextResponse.json(
      { ok: false, reason: err?.message ?? "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
