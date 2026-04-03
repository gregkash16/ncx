/**
 * Firebase Cloud Messaging (FCM) — server-side sender for Android push notifications.
 *
 * Uses the FCM HTTP v1 API with a Google service account.
 * Requires env vars: FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY
 */

import { google } from 'googleapis';

const FCM_PROJECT_ID = process.env.FCM_PROJECT_ID || '';
const FCM_CLIENT_EMAIL = process.env.FCM_CLIENT_EMAIL || '';
const FCM_PRIVATE_KEY = (process.env.FCM_PRIVATE_KEY || '').replace(/\\n/g, '\n');

async function getAccessToken(): Promise<string> {
  const auth = new google.auth.JWT(
    FCM_CLIENT_EMAIL,
    undefined,
    FCM_PRIVATE_KEY,
    ['https://www.googleapis.com/auth/firebase.messaging']
  );

  const { token } = await auth.getAccessToken();
  if (!token) throw new Error('Failed to get FCM access token');
  return token;
}

export async function sendFCMToDevices(
  deviceTokens: string[],
  payload: { title: string; body: string; url?: string }
) {
  if (!FCM_PROJECT_ID || !FCM_CLIENT_EMAIL || !FCM_PRIVATE_KEY) {
    console.warn('FCM not configured — skipping Android push notifications');
    return { sent: 0, failed: 0 };
  }

  const accessToken = await getAccessToken();
  const url = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;

  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    deviceTokens.map(async (token) => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: {
                title: payload.title,
                body: payload.body,
              },
              data: {
                url: payload.url || '/m/current',
                title: payload.title,
                body: payload.body,
              },
              android: {
                priority: 'high',
                notification: {
                  sound: 'default',
                  channelId: 'ncx_game_updates',
                },
              },
            },
          }),
        });

        if (res.ok) {
          sent++;
        } else {
          const errBody = await res.text();
          console.error(`FCM send failed for token ${token.slice(0, 20)}...: ${errBody}`);
          failed++;
        }
      } catch (e) {
        console.error('FCM send error:', e);
        failed++;
      }
    })
  );

  return { sent, failed };
}
