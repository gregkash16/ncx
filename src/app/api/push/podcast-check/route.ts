/**
 * /api/push/podcast-check
 *
 * Manual trigger for the same daily check that runs in-process (see
 * src/instrumentation.ts). Useful for one-off runs and for seeding the
 * KV "last seen" value on first deploy.
 */

import { NextResponse } from 'next/server';
import { runPodcastCheck } from '@/lib/podcastCheck';

async function handler() {
  try {
    const result = await runPodcastCheck();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('podcast-check error:', err);
    return NextResponse.json(
      { newEpisode: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

export const GET = handler;
export const POST = handler;
