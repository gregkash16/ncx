// Server Component (no 'use client')
import PlayersPanelServer from "@/app/components/PlayersPanelServer";

export default async function MobilePlayers() {
  return (
    <section className="w-full">
      <div className="rounded-2xl border border-[var(--ncx-border)] bg-[var(--ncx-bg-panel)] p-3 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
        <div className="sticky -top-1 z-10 -mx-2 mb-2 rounded-xl border border-[var(--ncx-border)] bg-[rgb(0_0_0/0.40)] px-3 py-2 text-sm font-semibold text-[var(--ncx-text-primary)] backdrop-blur">
          Players
        </div>

        {/* If content is wide, allow horizontal scroll on small screens */}
        <div className="-mx-3 overflow-x-auto px-1">
          <div className="min-w-[640px]">
            <PlayersPanelServer />
          </div>
        </div>
      </div>
    </section>
  );
}
