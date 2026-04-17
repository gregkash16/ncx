/**
 * /api/push/test
 *
 * Dev-only test endpoint — sends "Development / This is a Test Push notification"
 * to every FCM subscriber (all_teams = true OR any team selected).
 *
 * Hit GET or POST to trigger. Returns { sent, failed, total }.
 */

import { NextResponse } from 'next/server';
import { sendPushToCategory } from '@/lib/fcm';

async function sendTest() {
  const result = await sendPushToCategory(
    'test',
    [],
    {
      title: 'Development',
      body: 'This is a Test Push notification',
    },
    'manual: /api/push/test'
  );
  return NextResponse.json(result);
}

export async function GET() {
  return sendTest();
}

export async function POST() {
  return sendTest();
}
