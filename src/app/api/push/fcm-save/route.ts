/**
 * /api/push/fcm-save
 *
 * Save/load/delete FCM (Android) push notification subscriptions.
 *
 * Per-category preferences (2026-04-17):
 *   game     — a game has been reported
 *   matchups — matchups have been finalized for a new series
 *   series   — a series has clinched or reached Game 7
 *   live     — someone has gone live streaming a game
 *   test     — manual test notifications
 *
 * Each team-based category has: {cat}_enabled, {cat}_all_teams, {cat}_teams[].
 * `test` is a single boolean. Legacy all_teams/teams are retained during
 * migration so nothing breaks mid-deploy; they are no longer written.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import {
  ensureSubscriptionsTable,
  type CategoryPrefs,
  type FcmPrefsPayload,
  type TeamCategory,
} from '@/lib/fcmSubscriptions';

function rowToPrefs(row: any): FcmPrefsPayload {
  const readCat = (cat: TeamCategory): CategoryPrefs => ({
    enabled: row[`${cat}_enabled`] !== false,
    allTeams: row[`${cat}_all_teams`] !== false,
    teams: Array.isArray(row[`${cat}_teams`]) ? row[`${cat}_teams`] : [],
  });
  return {
    game: readCat('game'),
    matchups: readCat('matchups'),
    series: readCat('series'),
    live: readCat('live'),
    test: row.test_enabled !== false,
  };
}

function defaultPrefs(): FcmPrefsPayload {
  const allOn = { enabled: true, allTeams: true, teams: [] as string[] };
  return {
    game: { ...allOn },
    matchups: { ...allOn },
    series: { ...allOn },
    live: { ...allOn },
    test: true,
  };
}

// GET — load existing prefs for a token.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  await ensureSubscriptionsTable();

  const { rows } = await sql`
    SELECT game_enabled, game_all_teams, game_teams,
           matchups_enabled, matchups_all_teams, matchups_teams,
           series_enabled, series_all_teams, series_teams,
           live_enabled, live_all_teams, live_teams,
           test_enabled
      FROM fcm_subscriptions
     WHERE device_token = ${token}
  `;

  if (rows.length === 0) {
    const defaults = defaultPrefs();
    // Include legacy top-level allTeams/teams for old iOS/Android builds that
    // predate the per-category redesign (2026-04-17).
    return NextResponse.json({
      subscribed: false,
      allTeams: true,
      teams: [],
      prefs: defaults,
    });
  }

  const parsed = rowToPrefs(rows[0]);
  return NextResponse.json({
    subscribed: true,
    // Legacy mirror — old clients read these top-level fields.
    allTeams: parsed.game.allTeams,
    teams: parsed.game.teams,
    prefs: parsed,
  });
}

function sanitizeCategory(input: any): CategoryPrefs {
  const enabled = input?.enabled !== false;
  const allTeams = input?.allTeams !== false;
  const teams: string[] = Array.isArray(input?.teams)
    ? input.teams.filter((t: any) => typeof t === 'string')
    : [];
  return { enabled, allTeams, teams };
}

// POST — save token + preferences.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { deviceToken, prefs } = body;

  if (!deviceToken) {
    return NextResponse.json({ error: 'Missing deviceToken' }, { status: 400 });
  }

  await ensureSubscriptionsTable();

  // Detect legacy body shape: { prefs: { allTeams, teams } } — older
  // iOS/Android builds. Promote it to all four team-based categories so the
  // user stays opted-in to everything.
  const isLegacyShape =
    prefs &&
    typeof prefs === 'object' &&
    !prefs.game &&
    !prefs.matchups &&
    (prefs.allTeams !== undefined || Array.isArray(prefs.teams));

  const game = isLegacyShape
    ? {
        enabled: true,
        allTeams: prefs.allTeams !== false,
        teams: Array.isArray(prefs.teams) ? prefs.teams : [],
      }
    : sanitizeCategory(prefs?.game);
  const matchups = isLegacyShape ? { ...game } : sanitizeCategory(prefs?.matchups);
  const series = isLegacyShape ? { ...game } : sanitizeCategory(prefs?.series);
  const live = isLegacyShape ? { ...game } : sanitizeCategory(prefs?.live);
  const test = isLegacyShape ? true : prefs?.test !== false;

  // Also mirror into legacy columns so an older deploy would still send to
  // this device during a rolling deploy. Uses game's settings as the canonical
  // legacy shape — that was the primary use of the legacy columns.
  await sql`
    INSERT INTO fcm_subscriptions (
      device_token, all_teams, teams,
      game_enabled, game_all_teams, game_teams,
      matchups_enabled, matchups_all_teams, matchups_teams,
      series_enabled, series_all_teams, series_teams,
      live_enabled, live_all_teams, live_teams,
      test_enabled
    )
    VALUES (
      ${deviceToken}, ${game.allTeams}, ${game.teams as any},
      ${game.enabled}, ${game.allTeams}, ${game.teams as any},
      ${matchups.enabled}, ${matchups.allTeams}, ${matchups.teams as any},
      ${series.enabled}, ${series.allTeams}, ${series.teams as any},
      ${live.enabled}, ${live.allTeams}, ${live.teams as any},
      ${test}
    )
    ON CONFLICT (device_token) DO UPDATE SET
      all_teams = ${game.allTeams},
      teams = ${game.teams as any},
      game_enabled = ${game.enabled},
      game_all_teams = ${game.allTeams},
      game_teams = ${game.teams as any},
      matchups_enabled = ${matchups.enabled},
      matchups_all_teams = ${matchups.allTeams},
      matchups_teams = ${matchups.teams as any},
      series_enabled = ${series.enabled},
      series_all_teams = ${series.allTeams},
      series_teams = ${series.teams as any},
      live_enabled = ${live.enabled},
      live_all_teams = ${live.allTeams},
      live_teams = ${live.teams as any},
      test_enabled = ${test}
  `;

  return NextResponse.json({ ok: true });
}

// DELETE — remove subscription entirely.
export async function DELETE(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  await ensureSubscriptionsTable();
  await sql`DELETE FROM fcm_subscriptions WHERE device_token = ${token}`;

  return NextResponse.json({ ok: true });
}
