"use client";

import { useEffect, useMemo, useState } from "react";

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

  useEffect(() => {
    if (!ncxid) return;
    const ac = new AbortController();

    async function run() {
      try {
        setLoading(true);
        setErr(null);
        setVideos([]);
        setSelectedId(null);

        const res = await fetch(`/api/player-videos?ncxid=${encodeURIComponent(ncxid)}`, {
          signal: ac.signal,
          // Let the browser cache as instructed by server headers
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const vids: VideoItem[] = data?.videos ?? [];
        setVideos(vids);
        if (vids.length) setSelectedId(vids[0].id);
      } catch (e: any) {
        if (e?.name !== "AbortError") setErr(e?.message || "Failed to load videos");
      } finally {
        setLoading(false);
      }
    }

    run();
    return () => ac.abort();
  }, [ncxid]);

  const selected = useMemo(
    () => videos.find((v) => v.id === selectedId) || null,
    [videos, selectedId]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300">
          YouTube Videos tagged <span className="text-cyan-400">{ncxid}</span>
        </h3>
        {loading && <span className="text-xs text-zinc-500">Loading…</span>}
      </div>

      {err && (
        <div className="text-sm text-red-300 border border-red-800/50 bg-red-900/20 rounded-lg px-3 py-2">
          {err}
        </div>
      )}

      {!loading && !err && videos.length === 0 && (
        <div className="text-sm text-zinc-500 italic">No videos found for this player.</div>
      )}

      {/* ✅ CONSISTENT SIZE WRAPPER */}
      {/* 960px max width ≈ “1080p preview feel” on most YouTube layouts */}
      {/* Keeps 16:9 via aspect-video and centers it */}
      {selected && (
        <div className="mx-auto w-full max-w-[960px]">
          <div className="aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-black">
            <iframe
              key={selected.id}
              width="100%"
              height="100%"
              src={selected.embedUrl}
              title={selected.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Thumbnails strip constrained to same max width for visual alignment */}
      {videos.length > 0 && (
        <div className="mx-auto w-full max-w-[960px]">
          <div className="flex overflow-x-auto gap-3 pb-1">
            {videos.map((v) => {
              const active = v.id === selectedId;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className={[
                    "shrink-0 w-44 rounded-lg border p-2 text-left transition",
                    active
                      ? "border-purple-500/60 bg-purple-500/10"
                      : "border-zinc-800 hover:border-purple-500/40",
                  ].join(" ")}
                >
                  <img
                    src={v.thumb}
                    alt={v.title}
                    className="w-full h-24 object-cover rounded-md mb-2"
                    loading="lazy"
                  />
                  <div className="text-xs text-zinc-300 line-clamp-2">{v.title}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}