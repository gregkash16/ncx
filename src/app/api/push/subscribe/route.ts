import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

// Allow the client to send the same body structure used by your push helper
//  { subscription: { endpoint, keys: { p256dh, auth } }, origin, userAgent }
type Body = {
  subscription?: { endpoint: string; keys?: { p256dh?: string; auth?: string } };
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  origin?: string;
  userAgent?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    // Accept either "subscription" wrapper or flat shape
    const sub = body.subscription ?? body;
    const endpoint = sub?.endpoint;
    const p256dh = sub?.keys?.p256dh;
    const auth = sub?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
    }

    // Upsert by endpoint (avoids duplicates)
    await sql`
      INSERT INTO push_subscriptions (endpoint, p256dh, auth, origin, user_agent)
      VALUES (${endpoint}, ${p256dh}, ${auth}, ${body.origin ?? null}, ${body.userAgent ?? null})
      ON CONFLICT (endpoint)
      DO UPDATE SET
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        origin = EXCLUDED.origin,
        user_agent = EXCLUDED.user_agent;
    `;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("subscribe error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
