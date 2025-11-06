// src/app/api/push/subscribe/route.ts
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

type Keys = { p256dh?: string; auth?: string };
type SubPayload =
  | { subscription?: { endpoint?: string; keys?: Keys } } // preferred shape from client
  | { endpoint?: string; keys?: Keys };                   // legacy flat shape

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SubPayload;
    const sub = (body as any).subscription ?? body;

    const endpoint = sub?.endpoint;
    const p256dh = sub?.keys?.p256dh;
    const auth = sub?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { ok: false, error: "Invalid subscription payload (need endpoint, keys.p256dh, keys.auth)" },
        { status: 400 }
      );
    }

    // Minimal upsert (ONLY the three columns).
    await sql`
      INSERT INTO push_subscriptions (endpoint, p256dh, auth)
      VALUES (${endpoint}, ${p256dh}, ${auth})
      ON CONFLICT (endpoint)
      DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
    `;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("push/subscribe error:", err?.message || err);
    return NextResponse.json(
      { ok: false, error: "Server error while saving subscription", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
