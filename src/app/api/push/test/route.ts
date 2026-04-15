/**
 * /api/push/test
 *
 * Dev-only test endpoint — sends "Development / This is a Test Push notification"
 * to every FCM subscriber (all_teams = true OR any team selected).
 *
 * Hit GET or POST to trigger. Returns { sent, failed, total }.
 */

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { sendFCMToDevices } from '@/lib/fcm';

async function sendTest() {
  const { rows } = await sql<{ device_token: string }>`
    SELECT device_token
    FROM fcm_subscriptions
    WHERE all_teams = TRUE
       OR (teams IS NOT NULL AND array_length(teams, 1) > 0)
  `;

  const tokens = rows.map((r) => r.device_token).filter(Boolean);

  if (tokens.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0, note: 'No subscribers' });
  }

  const result = await sendFCMToDevices(tokens, {
    title: 'Development',
    body: 'This is a Test Push notification',
  });

  return NextResponse.json({ ...result, total: tokens.length });
}

export async function GET() {
  return sendTest();
}

export async function POST() {
  return sendTest();
}
