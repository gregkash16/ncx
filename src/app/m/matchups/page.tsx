// src/app/m/matchups/page.tsx
import { Suspense } from "react";
import MatchupsPanelServer from "@/app/components/MatchupsPanelServer";

export const runtime = "nodejs";
export const revalidate = 60;

export default async function MobileMatchupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const selectedWeek = (sp?.w as string | undefined) || undefined;

  return (
    <div className="py-4">
      <Suspense fallback={<div className="p-6 text-center text-zinc-300">Loading matchups...</div>}>
        <MatchupsPanelServer weekParam={selectedWeek} mobile />
      </Suspense>
    </div>
  );
}
