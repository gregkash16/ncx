/**
 * Podcast episodes for mobile
 */

import { NextResponse } from "next/server";

const RSS_URL = "https://anchor.fm/s/10d914e6c/podcast/rss";

type Episode = {
  title: string;
  link: string;
  pubDate?: string;
};

async function getEpisodes(): Promise<Episode[]> {
  try {
    const res = await fetch(RSS_URL);
    if (!res.ok) return [];

    const xml = await res.text();

    // Simple regex parsing for RSS (fallback approach)
    const items: Episode[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const content = match[1];
      const title = content.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "Untitled";
      const link = content.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
      const pubDate = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];

      items.push({
        title: title.replace(/<!\[CDATA\[/, "").replace(/\]\]>/, ""),
        link,
        pubDate,
      });
    }

    return items.slice(0, 20);
  } catch (e) {
    console.error("[mobile/podcast]", e);
    return [];
  }
}

export async function GET() {
  try {
    const episodes = await getEpisodes();
    return NextResponse.json({
      ok: true,
      episodes,
      spotifyUrl: "https://open.spotify.com/show/1vTvE3Zqmj6Bh3SnleP9jg",
    });
  } catch (e) {
    console.error("[mobile/podcast] GET error:", e);
    return NextResponse.json(
      { ok: false, reason: "SERVER_ERROR", episodes: [] },
      { status: 500 }
    );
  }
}
