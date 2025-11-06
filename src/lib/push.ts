// src/lib/push.ts
import { sql } from '@vercel/postgres';
import webpush from 'web-push';

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  const subject = process.env.VAPID_MAILTO || 'mailto:noreply@nickelcityxwing.com';
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    throw new Error('Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars.');
  }
  webpush.setVapidDetails(subject, pub, priv);
  vapidReady = true;
}

export async function sendPushToAll(payload: { title: string; body: string; url: string }) {
  ensureVapid();

  const { rows } = await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions`;
  const subs = rows.map(r => ({
    endpoint: r.endpoint,
    keys: { p256dh: r.p256dh, auth: r.auth },
  }));

  const msg = JSON.stringify(payload);

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

  return subs.length; // number attempted
}
