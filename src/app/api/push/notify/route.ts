import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import webpush from 'web-push';

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  const subject = process.env.VAPID_MAILTO || 'mailto:noreply@nickelcityxwing.com';
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    // Throw a clear error only when the route is called
    throw new Error('Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars.');
  }
  webpush.setVapidDetails(subject, pub, priv);
  vapidReady = true;
}

export async function POST(req: Request) {
  ensureVapid();

  const secret = req.headers.get('x-push-secret');
  if (secret !== process.env.PUSH_NOTIFY_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Expect: { title, body, url }
  const payload = await req.json().catch(() => ({}));
  const msg = JSON.stringify({
    title: payload.title ?? 'NCX',
    body: payload.body ?? 'Update',
    url: payload.url ?? '/m/current',
  });

  const { rows } = await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions`;
  const subs = rows.map(r => ({
    endpoint: r.endpoint,
    keys: { p256dh: r.p256dh, auth: r.auth },
  }));

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s as any, msg);
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
        }
      }
    })
  );

  return NextResponse.json({ sent: subs.length });
}
