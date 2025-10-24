// src/app/m/matchups/page.tsx
import { Suspense } from 'react';
import MatchupsClient from './MatchupsClient';
import { getMobileMatchupsData } from './data';

export const runtime = 'nodejs';     // use Node because googleapis needs it
export const revalidate = 60;        // cache server result for 60s (tweak as you like)

export default async function MobileMatchupsPage() {
  // Fetch on the server (faster, reliable, no client 500s)
  const payload = await getMobileMatchupsData();

  return (
    <Suspense fallback={<div className="p-6 text-center text-zinc-300">Loading matchups…</div>}>
      <MatchupsClient payload={payload} />
    </Suspense>
  );
}
