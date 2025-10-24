// Server component (no 'use client')
import PlayersPanelServer from "@/app/components/PlayersPanelServer";

export default async function PlayersSafe() {
  try {
    return <PlayersPanelServer />;
  } catch (err: any) {
    const msg = (err?.message || String(err)).slice(0, 800);
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-950/40 p-4">
        <h3 className="text-base font-semibold text-red-300">Players panel failed</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-red-200">
          {msg}
        </p>
      </div>
    );
  }
}
