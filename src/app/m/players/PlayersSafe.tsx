// Server component (no 'use client')
import PlayersPanelServer from "@/app/components/PlayersPanelServer";

export default async function PlayersSafe() {
  try {
    return <PlayersPanelServer />;
  } catch (err: any) {
    const msg = (err?.message || String(err)).slice(0, 800);
    return (
      <div className="rounded-2xl border border-[rgb(var(--ncx-secondary-rgb)/0.45)] bg-[rgb(var(--ncx-secondary-rgb)/0.10)] p-4">
        <h3 className="text-base font-semibold text-[rgb(var(--ncx-secondary-rgb))]">
          Players panel failed
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--ncx-text-primary)]/85">
          {msg}
        </p>
      </div>
    );
  }
}
