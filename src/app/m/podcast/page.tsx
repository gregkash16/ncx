// src/app/m/podcast/page.tsx
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
    const res = await fetch(RSS_URL, { next: { revalidate: 60 * 60 } });
    if (!res.ok) return [];

    const xml = await res.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });

    const data = parser.parse(xml);
    const items = data?.rss?.channel?.item;
    const arr = Array.isArray(items) ? items : items ? [items] : [];

    return arr.slice(0, 10).map((it: any) => ({
      title: String(it?.title ?? "Untitled"),
      link: String(it?.link ?? ""),
      pubDate: it?.pubDate ? String(it.pubDate) : undefined,
    }));
  } catch {
    return [];
  }
}

export default async function MobilePodcastPage() {
  const episodes = await getEpisodes();

  return (
    <div className="p-3 space-y-4 text-[var(--ncx-text-primary)]">

      {/* Header */}
      <header>
        <h1 className="text-lg font-extrabold tracking-wide">
          <span className="text-[rgb(var(--ncx-primary-rgb))]">Podcast</span>
        </h1>
        <p className="text-[11px] text-[var(--ncx-text-muted)] mt-1">
          Listen on Spotify or browse recent episodes.
        </p>
      </header>

      {/* Spotify Embed */}
      <div className="rounded-2xl overflow-hidden border border-[var(--ncx-border)] bg-[var(--ncx-panel-bg)]">
        <iframe
          src={SPOTIFY_EMBED_URL}
          width="100%"
          height="232"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="block"
        />
      </div>

      {/* Episodes */}
      {episodes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--ncx-text-muted)]">
            Latest Episodes
          </h2>

          <div className="space-y-2">
            {episodes.map((ep) => (
              <a
                key={`${ep.title}-${ep.link}`}
                href={ep.link}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-[var(--ncx-border)] bg-[var(--ncx-panel-bg)] px-3 py-3 transition active:scale-[0.98]"
              >
                <div className="text-sm font-semibold leading-snug">
                  {ep.title}
                </div>
                {ep.pubDate && (
                  <div className="text-[11px] text-[var(--ncx-text-muted)] mt-1">
                    {ep.pubDate}
                  </div>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* RSS Fallback */}
      {episodes.length === 0 && (
        <div className="text-xs text-[var(--ncx-text-muted)]">
          Episodes couldn’t be loaded right now. The Spotify player above will still work.
        </div>
      )}

      {/* Contact */}
      <section className="rounded-xl border border-[var(--ncx-border)] bg-[var(--ncx-panel-bg)] px-3 py-3">
        <div className="text-sm font-semibold">
          Contact the Show
        </div>
        <div className="mt-1 text-[11px] text-[var(--ncx-text-muted)]">
          Questions, comments, or something X-Wing to promote?
        </div>
        <a
          href="mailto:pod@nickelcityxwing.com"
          className="mt-2 inline-block text-sm font-semibold text-[rgb(var(--ncx-primary-rgb))] hover:underline"
        >
          pod@nickelcityxwing.com
        </a>
      </section>

    </div>
  );
}
