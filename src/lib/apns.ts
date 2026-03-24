/**
 * APNs (Apple Push Notification service) utilities for sending notifications to iOS devices
 */

import apn from 'node-apn';

/**
 * Send APNs push notifications to device tokens
 * @param deviceTokens Array of APNs device tokens
 * @param payload Notification payload with title, body, and optional url
 */
export async function sendAPNsToDevices(
  deviceTokens: string[],
  payload: { title: string; body: string; url?: string }
): Promise<{ sent: number; failed: number }> {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const keyP8 = process.env.APNS_KEY_P8;
  const bundleId = process.env.APNS_BUNDLE_ID || 'com.ncx.app';

  if (!keyId || !teamId || !keyP8) {
    console.error('Missing APNs credentials:', {
      hasKeyId: !!keyId,
      hasTeamId: !!teamId,
      hasKeyP8: !!keyP8,
      keyP8Length: keyP8?.length,
    });
    return { sent: 0, failed: deviceTokens.length };
  }

  console.log('APNs credentials loaded:', {
    keyId,
    teamId,
    keyP8Start: keyP8.substring(0, 50),
    keyP8End: keyP8.substring(keyP8.length - 30),
    keyP8Length: keyP8.length,
  });

  const provider = new apn.Provider({
    token: {
      key: keyP8,
      keyId,
      teamId,
    },
    production: true,
    requestTimeout: 5000,
  });

  const notification = new apn.Notification({
    alert: {
      title: payload.title,
      body: payload.body,
    },
    sound: 'default',
    badge: 0,
    contentAvailable: true,
    mutableContent: true,
    topic: bundleId,
    // Custom data
    payload: {
      url: payload.url || '/m/current',
      title: payload.title,
      body: payload.body,
    },
  });

  let sent = 0;
  let failed = 0;

  try {
    console.log(`[APNs] Sending to ${deviceTokens.length} devices`);
    const results = await provider.send(notification, deviceTokens);

    console.log(`[APNs] Send results:`, {
      sent: results.sent?.length || 0,
      failed: results.failed?.length || 0,
    });

    // Process results for failed tokens
    if (results.failed && results.failed.length > 0) {
      for (const failure of results.failed) {
        console.error(`[APNs] Failed for token ${failure.device}:`, JSON.stringify(failure));
        failed++;
      }
    }

    sent = deviceTokens.length - failed;
    console.log(`[APNs] Summary: sent=${sent}, failed=${failed}`);
  } catch (error) {
    console.error('APNs provider error:', error);
    failed = deviceTokens.length;
  } finally {
    provider.shutdown();
  }

  return { sent, failed };
}
