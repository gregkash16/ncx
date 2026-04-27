/**
 * NCX podcast new-episode detector.
 *
 * Fetches the podcast RSS feed, compares the latest episode's link against
 * a KV-stored last-seen value, and fires an FCM push to every subscriber
 * when a new episode appears. Idempotent — calling it repeatedly with no
 * new episode is a no-op.
 *
 * Used by both the HTTP route (/api/push/podcast-check) and the in-process
 * daily scheduler (src/instrumentation.ts).
 */

import { XMLParser } from 'fast-xml-parser';
import { sql } from '@vercel/postgres';
import { sendFCMToDevices } from '@/lib/fcm';
import { ensureSubscriptionsTable } from '@/lib/fcmSubscriptions';
import { kvGet, kvSet } from '@/lib/kv';

const RSS_URL = 'https://anchor.fm/s/10d914e6c/podcast/rss';
const KV_KEY = 'podcast:lastEpisodeLink';

export type PodcastCheckResult =
  | { newEpisode: false; latest?: LatestEpisode; error?: string }
  | { newEpisode: true; episode: LatestEpisode; recipients: number; sent: number; failed: number };

export type LatestEpisode = {
  title: string;
  link: string;
  pubDate: string;
};

async function fetchLatestEpisode(): Promise<LatestEpisode | null> {
  const res = await fetch(RSS_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);

  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);

  const items = parsed?.rss?.channel?.item ?? [];
  const list = Array.isArray(items) ? items : [items];
  if (list.length === 0) return null;

  const item = list[0];
  return {
    title: String(item?.title ?? '').trim(),
    link: String(item?.link ?? '').trim(),
    pubDate: String(item?.pubDate ?? '').trim(),
  };
}

export async function runPodcastCheck(): Promise<PodcastCheckResult> {
  const latest = await fetchLatestEpisode();
  if (!latest || !latest.link) {
    return { newEpisode: false, error: 'no episodes in feed' };
  }

  const lastSeen = await kvGet<string>(KV_KEY);
  if (lastSeen === latest.link) {
    return { newEpisode: false, latest };
  }

  // Persist the link before pushing so a crash mid-send doesn't cause a
  // duplicate notification on the next run. Trade-off: a partial-failure
  // run won't be retried automatically.
  await kvSet(KV_KEY, latest.link);

  await ensureSubscriptionsTable();
  const r = await sql<{ device_token: string }>`
    SELECT device_token FROM fcm_subscriptions
  `;
  const tokens = r.rows.map((row) => row.device_token).filter(Boolean);

  let sent = 0;
  let failed = 0;
  if (tokens.length > 0) {
    const result = await sendFCMToDevices(
      tokens,
      {
        title: 'New NCX Podcast Episode',
        body: latest.title,
        url: '/m/podcast',
      },
      { category: 'podcast', trigger: 'cron: daily 10am NY' }
    );
    sent = result.sent;
    failed = result.failed;
  }

  return {
    newEpisode: true,
    episode: latest,
    recipients: tokens.length,
    sent,
    failed,
  };
}
