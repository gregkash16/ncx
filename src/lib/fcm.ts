/**
 * Firebase Cloud Messaging (FCM) — server-side sender for Android push notifications.
 *
 * Uses the FCM HTTP v1 API with a Google service account.
 * Requires env vars: FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY
 */

const FCM_PROJECT_ID = process.env.FCM_PROJECT_ID || '';
const FCM_CLIENT_EMAIL = process.env.FCM_CLIENT_EMAIL || '';

function getFcmPrivateKey(): string {
  const raw = process.env.FCM_PRIVATE_KEY || '';
  return raw.replace(/\\n/g, '\n');
}

/**
 * Get an OAuth2 access token using a service account JWT.
 * Manually constructs and signs the JWT instead of relying on googleapis library.
 */
async function getAccessToken(): Promise<string> {
  const privateKey = getFcmPrivateKey();

  if (!privateKey || !FCM_CLIENT_EMAIL) {
    throw new Error(`FCM not configured: email=${!!FCM_CLIENT_EMAIL}, keyLen=${privateKey.length}`);
  }

  // Import jose for JWT signing (available in Node 18+ / Edge runtime)
  const { SignJWT, importPKCS8 } = await import('jose');

  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(privateKey, 'RS256');

  const jwt = await new SignJWT({
    iss: FCM_CLIENT_EMAIL,
    sub: FCM_CLIENT_EMAIL,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(key);

  // Exchange JWT for access token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OAuth token exchange failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function sendFCMToDevices(
  deviceTokens: string[],
  payload: { title: string; body: string; url?: string },
  meta?: { category: string; trigger: string }
) {
  if (!FCM_PROJECT_ID || !FCM_CLIENT_EMAIL || !getFcmPrivateKey()) {
    console.warn('FCM not configured — skipping Android push notifications');
    if (meta) {
      const { logPushNotification } = await import('@/lib/pushLog');
      await logPushNotification({
        category: meta.category,
        title: payload.title,
        body: payload.body,
        trigger: meta.trigger,
        recipientCount: deviceTokens.length,
        sent: 0,
        failed: 0,
      });
    }
    return { sent: 0, failed: 0 };
  }

  const accessToken = await getAccessToken();
  const url = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;

  let sent = 0;
  let failed = 0;
  const staleTokens: string[] = [];

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
              apns: {
                payload: {
                  aps: {
                    sound: 'default',
                  },
                },
              },
            },
          }),
        });

        if (res.ok) {
          sent++;
          console.log(`FCM: sent to ${token.slice(0, 20)}...`);
        } else {
          const errBody = await res.text();
          console.error(`FCM send failed for token ${token.slice(0, 20)}...: ${errBody}`);
          failed++;
          let errorCode = '';
          try {
            errorCode = JSON.parse(errBody)?.error?.details?.find?.(
              (d: any) => d?.errorCode
            )?.errorCode ?? '';
          } catch {}
          if (errorCode === 'UNREGISTERED' || errorCode === 'INVALID_ARGUMENT') {
            staleTokens.push(token);
          }
        }
      } catch (e) {
        console.error('FCM send error:', e);
        failed++;
      }
    })
  );

  if (staleTokens.length > 0) {
    console.log(`FCM: purging ${staleTokens.length} stale tokens from fcm_subscriptions`);
    try {
      const { sql } = await import('@vercel/postgres');
      let purged = 0;
      for (const token of staleTokens) {
        try {
          const result = await sql`DELETE FROM fcm_subscriptions WHERE device_token = ${token}`;
          purged += result.rowCount ?? 0;
        } catch (e) {
          console.warn(`FCM: failed to purge token ${token.slice(0, 20)}...:`, e);
        }
      }
      console.log(`FCM: purged ${purged}/${staleTokens.length} stale tokens`);
    } catch (e) {
      console.warn('FCM: failed to purge stale tokens:', e);
    }
  }

  if (meta) {
    const { logPushNotification } = await import('@/lib/pushLog');
    await logPushNotification({
      category: meta.category,
      title: payload.title,
      body: payload.body,
      trigger: meta.trigger,
      recipientCount: deviceTokens.length,
      sent,
      failed,
    });
  }

  return { sent, failed };
}
