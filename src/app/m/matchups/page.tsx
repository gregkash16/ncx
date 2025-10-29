// src/app/m/matchups/page.tsx
import { Suspense } from "react";
import MatchupsClient from "./MatchupsClient";
import { getMobileMatchupsData } from "./data";

export const runtime = "nodejs"; // googleapis needs Node
export const revalidate = 60;

// Next 15: searchParams is a Promise on server components
export default async function MobileMatchupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const selectedWeek = (sp?.w as string | undefined) || undefined;
  // (Optional) we don’t need to pass q here; the client reads it from URL.

  // Fetch on the server; validates selectedWeek against active & returns both
  const payload = await getMobileMatchupsData(selectedWeek);

  return (
    <Suspense fallback={<div className="p-6 text-center text-zinc-300">Loading matchups…</div>}>
      <MatchupsClient payload={payload} />
    </Suspense>
  );
}
