// src/app/components/PodcastPanel.tsx
import React from "react";
import { XMLParser } from "fast-xml-parser";

const RSS_URL = "https://anchor.fm/s/10d914e6c/podcast/rss";
const SPOTIFY_EMBED_URL =
  "https://open.spotify.com/embed/show/1vTvE3Zqmj6Bh3SnleP9jg";

type Episode = {
  title: string;
  link: string;
  pubDate?: string;
};

async function getEpisodes(): Promise<Episode[]> {
  try {
    const res = await fetch(RSS_URL, { next: { revalidate: 60 * 60 } }); // 1 hour
    if (!res.ok) return [];

    const xml = await res.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });

    const data = parser.parse(xml);
    const items = data?.rss?.channel?.item;

    const arr = Array.isArray(items) ? items : items ? [items] : [];
    return arr.slice(0, 12).map((it: any) => ({
      title: String(it?.title ?? "Untitled"),
      link: String(it?.link ?? ""),
      pubDate: it?.pubDate ? String(it.pubDate) : undefined,
    }));
  } catch {
    return [];
  }
}

export default async function PodcastPanel() {
  const episodes = await getEpisodes();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-2xl border border-[var(--ncx-border)] bg-[var(--ncx-panel-bg)] p-6 md:p-8 shadow-xl">
        <div className="mb-5">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--ncx-text-primary)]">
            Podcast
          </h2>
          <p className="mt-1 text-sm text-[var(--ncx-text-primary)]">
            Listen on Spotify or jump into the latest episodes.
          </p>
        </div>

        {/* Spotify embed */}
        <div className="rounded-2xl overflow-hidden border border-[var(--ncx-border)] bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.12)]">
          <iframe
            src={SPOTIFY_EMBED_URL}
            width="100%"
            height="352"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="block"
          />
        </div>

        {/* Latest episodes (optional, from RSS) */}
        {episodes.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-[var(--ncx-text-primary)] mb-3">
              Latest Episodes
            </h3>

            <div className="grid grid-cols-1 gap-2">
              {episodes.map((ep) => (
                <a
                  key={`${ep.title}-${ep.link}`}
                  href={ep.link}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-[var(--ncx-border)] bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] px-4 py-3 transition hover:bg-[rgb(var(--ncx-primary-rgb)/0.12)] hover:border-[rgb(var(--ncx-primary-rgb)/0.60)]"
                >
                  <div className="text-sm font-semibold text-[var(--ncx-text-primary)]">
                    {ep.title}
                  </div>
                  {ep.pubDate && (
                    <div className="text-xs text-[var(--ncx-text-muted)] mt-1">
                      {ep.pubDate}
                    </div>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}

        {episodes.length === 0 && (
          <div className="mt-6 text-sm text-[var(--ncx-text-muted)]">
            Episodes list couldn’t be loaded right now (RSS fetch/parse). The Spotify
            player above will still work.
          </div>
        )}
      </div>
    </div>
  );
}
