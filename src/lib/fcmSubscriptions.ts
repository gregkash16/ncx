/**
 * Schema + migration helper for the FCM subscriptions table.
 *
 * Keeps the per-category columns idempotent so deploys never have to run a
 * one-shot migration. Callable from any route or lib.
 */
import { sql } from '@vercel/postgres';

export type TeamCategory = 'game' | 'matchups' | 'series' | 'live';
export type PushCategory = TeamCategory | 'test';

export type CategoryPrefs = {
  enabled: boolean;
  allTeams: boolean;
  teams: string[];
};

export type FcmPrefsPayload = {
  game: CategoryPrefs;
  matchups: CategoryPrefs;
  series: CategoryPrefs;
  live: CategoryPrefs;
  test: boolean;
};

export async function ensureSubscriptionsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS fcm_subscriptions (
      device_token TEXT PRIMARY KEY,
      all_teams BOOLEAN DEFAULT TRUE,
      teams TEXT[] DEFAULT '{}'
    )
  `;
  await sql`ALTER TABLE fcm_subscriptions ADD COLUMN IF NOT EXISTS game_enabled      BOOLEAN`;
  await sql`ALTER TABLE fcm_subscriptions ADD COLUMN IF NOT EXISTS game_all_teams    BOOLEAN`;
  await sql`ALTER TABLE fcm_subscriptions ADD COLUMN IF NOT EXISTS game_teams        TEXT[]`;
  await sql`ALTER TABLE fcm_subscriptions ADD COLUMN IF NOT EXISTS matchups_enabled  BOOLEAN`;
  await sql`ALTER TABLE fcm_subscriptions ADD COLUMN IF NOT EXISTS matchups_all_teams BOOLEAN`;
  await sql`ALTER TABLE fcm_subscriptions ADD COLUMN IF NOT EXISTS matchups_teams    TEXT[]`;
  await sql`ALTER TABLE fcm_subscriptions ADD COLUMN IF NOT EXISTS series_enabled    BOOLEAN`;
  await sql`ALTER TABLE fcm_subscriptions ADD COLUMN IF NOT EXISTS series_all_teams  BOOLEAN`;
  await sql`ALTER TABLE fcm_subscriptions ADD COLUMN IF NOT EXISTS series_teams      TEXT[]`;
  await sql`ALTER TABLE fcm_subscriptions ADD COLUMN IF NOT EXISTS live_enabled      BOOLEAN`;
  await sql`ALTER TABLE fcm_subscriptions ADD COLUMN IF NOT EXISTS live_all_teams    BOOLEAN`;
  await sql`ALTER TABLE fcm_subscriptions ADD COLUMN IF NOT EXISTS live_teams        TEXT[]`;
  await sql`ALTER TABLE fcm_subscriptions ADD COLUMN IF NOT EXISTS test_enabled      BOOLEAN`;

  await sql`
    UPDATE fcm_subscriptions
       SET game_enabled       = COALESCE(game_enabled,       TRUE),
           game_all_teams     = COALESCE(game_all_teams,     all_teams),
           game_teams         = COALESCE(game_teams,         teams),
           matchups_enabled   = COALESCE(matchups_enabled,   TRUE),
           matchups_all_teams = COALESCE(matchups_all_teams, all_teams),
           matchups_teams     = COALESCE(matchups_teams,     teams),
           series_enabled     = COALESCE(series_enabled,     TRUE),
           series_all_teams   = COALESCE(series_all_teams,   all_teams),
           series_teams       = COALESCE(series_teams,       teams),
           live_enabled       = COALESCE(live_enabled,       TRUE),
           live_all_teams     = COALESCE(live_all_teams,     all_teams),
           live_teams         = COALESCE(live_teams,         teams),
           test_enabled       = COALESCE(test_enabled,       TRUE)
     WHERE game_enabled IS NULL
        OR matchups_enabled IS NULL
        OR series_enabled IS NULL
        OR live_enabled IS NULL
        OR test_enabled IS NULL
  `;
}
