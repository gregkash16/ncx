"use client";

import type React from "react";
import { useEffect, useMemo, useState, useCallback } from "react";

type VideoItem = {
  id: string;
  title: string;
  tags: string[];
  thumb: string;
  embedUrl: string;
};

export default function PlayerVideos({ ncxid }: { ncxid: string }) {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fetch videos for this player
  useEffect(() => {
    if (!ncxid) return;
    const ac = new AbortController();

    async function run() {
      try {
        setLoading(true);
        setErr(null);
        setVideos([]);
        setSelectedId(null);

        const res = await fetch(
          `/api/player-videos?ncxid=${encodeURIComponent(ncxid)}`,
          { signal: ac.signal }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const vids: VideoItem[] = data?.videos ?? [];
        setVideos(vids);
        if (vids.length) setSelectedId(vids[0].id);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setErr(e?.message || "Failed to load videos");
        }
      } finally {
        setLoading(false);
      }
    }

    void run();
    return () => ac.abort();
  }, [ncxid]);

  const selected = useMemo(
    () => videos.find((v) => v.id === selectedId) || null,
    [videos, selectedId]
  );

  // Keyboard navigation (left/right arrows)
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!videos.length || !selectedId) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

      const idx = videos.findIndex((v) => v.id === selectedId);
      if (idx < 0) return;

      if (e.key === "ArrowLeft" && idx > 0) {
        setSelectedId(videos[idx - 1].id);
      } else if (e.key === "ArrowRight" && idx < videos.length - 1) {
        setSelectedId(videos[idx + 1].id);
      }
    },
    [videos, selectedId]
  );

  return (
    <div className="space-y-4" onKeyDown={onKeyDown} tabIndex={0}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--ncx-text-primary)]">
          YouTube Videos tagged{" "}
          <span className="ncx-accent">{ncxid}</span>
        </h3>
        {loading && (
          <span className="text-xs text-[var(--ncx-text-muted)]">Loading…</span>
        )}
      </div>

      {err && (
        <div className="text-sm text-[var(--ncx-text-primary)] border border-[rgb(var(--ncx-highlight-rgb)/0.60)] bg-[rgb(var(--ncx-highlight-rgb)/0.12)] rounded-lg px-3 py-2">
          {err}
        </div>
      )}

      {!loading && !err && videos.length === 0 && (
        <div className="text-sm text-[var(--ncx-text-muted)] italic">
          No videos found for this player.
        </div>
      )}

      {/* Consistent 16:9 player wrapper */}
      {selected && (
        <div className="mx-auto w-full md:w-[960px]">
          <div className="relative aspect-video rounded-xl overflow-hidden border border-[var(--ncx-border)] bg-[var(--ncx-bg-start)]">
            <iframe
              key={selected.id}
              className="absolute inset-0 block w-full h-full"
              src={selected.embedUrl}
              title={selected.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Thumbnails aligned to same width */}
      {videos.length > 0 && (
        <div className="mx-auto w-full md:w-[960px]">
          <div className="flex overflow-x-auto gap-3 pb-1">
            {videos.map((v) => {
              const active = v.id === selectedId;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className={[
                    "shrink-0 w-44 rounded-lg border p-2 text-left transition outline-none focus:ring-2 focus:ring-[rgb(var(--ncx-primary-rgb)/0.35)]",
                    active
                      ? "border-[rgb(var(--ncx-primary-rgb)/0.60)] bg-[rgb(var(--ncx-primary-rgb)/0.12)]"
                      : "border-[var(--ncx-border)] hover:border-[rgb(var(--ncx-primary-rgb)/0.40)]",
                  ].join(" ")}
                  aria-pressed={active}
                >
                  <img
                    src={v.thumb}
                    alt={v.title}
                    className="w-full h-24 object-cover rounded-md mb-2"
                    loading="lazy"
                  />
                  <div className="text-xs text-[var(--ncx-text-primary)] line-clamp-2">
                    {v.title}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
