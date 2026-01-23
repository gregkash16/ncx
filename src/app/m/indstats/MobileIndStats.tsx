// src/app/m/indstats/page.tsx (or wherever your route file lives)
// Server Component (no 'use client')
import IndStatsPanelServer from "@/app/components/IndStatsPanelServer";

export const revalidate = 60;

export default async function MobileIndStats() {
  return (
    <section className="w-full">
      <div className="rounded-2xl border border-[var(--ncx-border)] bg-[var(--ncx-bg-elev)] p-3 shadow-[0_4px_20px_rgb(0_0_0/0.25)]">
        <div className="sticky -top-1 z-10 -mx-2 mb-2 rounded-xl border border-[var(--ncx-border)] bg-[color:rgb(var(--ncx-bg-rgb)/0.85)] px-3 py-2 text-sm font-semibold text-[var(--ncx-text-primary)] backdrop-blur">
          Individual Stats
        </div>

        {/* If content is wide, allow horizontal scroll on small screens */}
        <div className="-mx-3 overflow-x-auto px-1">
          <div className="min-w-[640px]">
            <IndStatsPanelServer />
          </div>
        </div>
      </div>
    </section>
  );
}
