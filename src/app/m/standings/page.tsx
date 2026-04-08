// /m/standings/page.tsx
import StandingsPanel from "@/app/components/StandingsPanel";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function MobileStandingsPage() {
  return (
    <div className="py-4">
      <StandingsPanel mobile />
    </div>
  );
}
