// Idempotent: ensures the S9.matchup_draft table has the pending_sub column
// used by the post-finalize substitution flow. Cached in module scope so the
// INFORMATION_SCHEMA check runs at most once per Node process.

import { pool } from "./db";

let migrationDone = false;
let migrationPromise: Promise<void> | null = null;

export async function ensureMatchupDraftColumns(): Promise<void> {
  if (migrationDone) return;
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    const [rows] = await pool.query<any[]>(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = 'S9'
         AND TABLE_NAME = 'matchup_draft'
         AND COLUMN_NAME = 'pending_sub'`
    );
    if (!rows || rows.length === 0) {
      await pool.query(
        `ALTER TABLE S9.matchup_draft ADD COLUMN pending_sub TINYINT(1) NOT NULL DEFAULT 0`
      );
    }
    migrationDone = true;
  })().catch((err) => {
    migrationPromise = null;
    throw err;
  });

  return migrationPromise;
}
