// Shared helpers for ending a live matchup — used by DELETE /api/live-matchups,
// the 2h purge inside GET /api/live-matchups, and report-game auto-clear.

import { pool } from "@/lib/db";

export const LIVE_DISCORD_CHANNEL_ID = "1494224545522122822";
const DISCORD_API = "https://discord.com/api/v10";

async function deleteDiscordMessage(messageId: string): Promise<void> {
  const token = process.env.CL4W_BOT_TOKEN;
  if (!token || !messageId) return;
  try {
    const res = await fetch(
      `${DISCORD_API}/channels/${LIVE_DISCORD_CHANNEL_ID}/messages/${messageId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bot ${token}` },
      }
    );
    // 204 = deleted, 404 = already gone (both fine). 403/401 = perms issue.
    if (!res.ok && res.status !== 404) {
      console.warn(
        `⚠️ Discord live message delete failed (${res.status}): ${await res.text()}`
      );
    }
  } catch (e) {
    console.warn("⚠️ Discord live message delete threw:", e);
  }
}

// Delete the live_matchups row for (weekLabel, game) and also remove the
// corresponding CL-4W webhook announcement from the Discord channel, if any.
// Never throws — safe to call fire-and-forget.
export async function endLiveMatchupRow(
  weekLabel: string,
  game: string
): Promise<void> {
  if (!weekLabel || !game) return;
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT discord_message_id FROM S9.live_matchups
        WHERE week_label = ? AND game = ?`,
      [weekLabel, game]
    );
    const messageId =
      Array.isArray(rows) && rows.length > 0 && rows[0]?.discord_message_id
        ? String(rows[0].discord_message_id)
        : "";

    await pool.query(
      `DELETE FROM S9.live_matchups WHERE week_label = ? AND game = ?`,
      [weekLabel, game]
    );

    if (messageId) await deleteDiscordMessage(messageId);
  } catch (e) {
    console.warn("⚠️ endLiveMatchupRow failed:", e);
  }
}

// Purge all live rows older than 2h, deleting their Discord messages first.
export async function purgeExpiredLiveMatchups(): Promise<void> {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT week_label, game, discord_message_id FROM S9.live_matchups
        WHERE started_at < NOW() - INTERVAL 2 HOUR`
    );
    const expired = Array.isArray(rows) ? rows : [];
    if (expired.length === 0) return;

    await pool.query(
      `DELETE FROM S9.live_matchups WHERE started_at < NOW() - INTERVAL 2 HOUR`
    );

    for (const r of expired) {
      if (r?.discord_message_id) {
        await deleteDiscordMessage(String(r.discord_message_id));
      }
    }
  } catch (e) {
    console.warn("⚠️ purgeExpiredLiveMatchups failed:", e);
  }
}
