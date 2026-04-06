/**
 * /api/push/fcm-save
 *
 * Save/load/delete FCM (Android) push notification subscriptions.
 * Saves FCM device tokens for Android push notifications.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

// Ensure table exists
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS fcm_subscriptions (
      device_token TEXT PRIMARY KEY,
      all_teams BOOLEAN DEFAULT TRUE,
      teams TEXT[] DEFAULT '{}'
    )
  `;
}

// GET — load existing prefs for a token
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  await ensureTable();

  const { rows } = await sql`
    SELECT all_teams, teams FROM fcm_subscriptions WHERE device_token = ${token}
  `;

  if (rows.length === 0) {
    return NextResponse.json({ subscribed: false, allTeams: true, teams: [] });
  }

  return NextResponse.json({
    subscribed: true,
    allTeams: rows[0].all_teams,
    teams: rows[0].teams || [],
  });
}

// POST — save token + preferences
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { deviceToken, prefs } = body;

  if (!deviceToken) {
    return NextResponse.json({ error: 'Missing deviceToken' }, { status: 400 });
  }

  const allTeams = prefs?.allTeams !== false;
  const teams: string[] = Array.isArray(prefs?.teams) ? prefs.teams : [];

  await ensureTable();

  await sql`
    INSERT INTO fcm_subscriptions (device_token, all_teams, teams)
    VALUES (${deviceToken}, ${allTeams}, ${teams as any})
    ON CONFLICT (device_token)
    DO UPDATE SET all_teams = ${allTeams}, teams = ${teams as any}
  `;

  return NextResponse.json({ ok: true });
}

// DELETE — remove subscription
export async function DELETE(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  await ensureTable();
  await sql`DELETE FROM fcm_subscriptions WHERE device_token = ${token}`;

  return NextResponse.json({ ok: true });
}
