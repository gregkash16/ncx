"use client";

import { useState } from "react";

type Props = {
  slug: string;
};

export default function TeamIntroToggle({ slug }: Props) {
  const [open, setOpen] = useState(false);

  const introSrc = `/intros/${slug}.webm`;

  return (
    <div className="space-y-3">
      {/* Toggle Pill */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="
          inline-flex items-center gap-2
          rounded-full
          px-4 py-1.5
          text-sm font-semibold
          border border-[var(--ncx-border)]
          bg-[rgb(var(--ncx-primary-rgb)/0.08)]
          text-[rgb(var(--ncx-primary-rgb))]
          hover:bg-[rgb(var(--ncx-primary-rgb)/0.15)]
          transition
          cursor-pointer
        "
      >
        {open ? "Close Intro" : "Team Intro"}
      </button>

      {/* Video Panel */}
      {open && (
        <div className="rounded-2xl overflow-hidden border border-[var(--ncx-border)] bg-black">
            <video
                src={introSrc}
                controls
                playsInline
                preload="metadata"
                className="w-full max-h-[70vh] object-contain"
            />
            </div>
      )}
    </div>
  );
}
