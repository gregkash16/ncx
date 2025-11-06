import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function POST(req: Request) {
  const sub = (await req.json()) as Sub;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return new NextResponse('Bad subscription', { status: 400 });
  }
  await sql`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth)
    VALUES (${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth})
    ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
  `;
  return NextResponse.json({ ok: true });
}
