// src/app/m/indstats/page.tsx
import IndStatsPanelServer from "@/app/components/IndStatsPanelServer";

export const revalidate = 0;

export default async function MobileIndStatsPage() {
  return (
    <div className="py-4">
      <IndStatsPanelServer />
    </div>
  );
}
