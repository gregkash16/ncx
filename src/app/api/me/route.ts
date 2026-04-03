/**
 * /api/me?discordId=123456789
 *
 * Looks up a Discord user's NCXID and returns their league stats.
 * Used by the Android (and iOS) native apps after Discord OAuth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDiscordMapCached, fetchIndStatsDataCached } from '@/lib/googleSheets';

export async function GET(req: NextRequest) {
  const discordId = req.nextUrl.searchParams.get('discordId');

  if (!discordId) {
    return NextResponse.json(
      { error: 'Missing discordId parameter' },
      { status: 400 }
    );
  }

  try {
    // Look up NCXID from Discord ID
    const discordMap = await getDiscordMapCached();
    const normalized = discordId.replace(/\D/g, '');
    const match = discordMap[normalized];

    if (!match) {
      return NextResponse.json({
        found: false,
        ncxid: null,
        name: null,
        stats: null,
      });
    }

    const { ncxid, first, last } = match;

    // Look up individual stats
    const indStats = await fetchIndStatsDataCached();
    const stats = indStats.find((s) => s.ncxid === ncxid) ?? null;

    return NextResponse.json({
      found: true,
      ncxid,
      name: `${first} ${last}`,
      stats,
    });
  } catch (err: any) {
    console.error('Error in /api/me:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
