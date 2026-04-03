/**
 * /api/podcast
 *
 * Fetches and parses the NCX podcast RSS feed, returns episodes.
 */

import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

const RSS_URL = 'https://anchor.fm/s/10d914e6c/podcast/rss';

type Episode = {
  title: string;
  link: string;
  pubDate: string;
};

export async function GET() {
  try {
    const res = await fetch(RSS_URL, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);

    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);

    const items = parsed?.rss?.channel?.item ?? [];
    const list = Array.isArray(items) ? items : [items];

    const episodes: Episode[] = list.slice(0, 15).map((item: any) => ({
      title: String(item.title ?? '').trim(),
      link: String(item.link ?? '').trim(),
      pubDate: String(item.pubDate ?? '').trim(),
    }));

    return NextResponse.json({
      showName: 'NCX Podcast',
      spotifyEmbed: 'https://open.spotify.com/embed/show/1vTvE3Zqmj6Bh3SnleP9jg',
      episodes,
    });
  } catch (err: any) {
    console.error('GET /api/podcast error:', err);
    return NextResponse.json(
      { showName: 'NCX Podcast', spotifyEmbed: '', episodes: [], error: err.message },
      { status: 200 } // Still return 200 so the app can show Spotify fallback
    );
  }
}
