// src/app/m/advstats/page.tsx
import AdvStatsPanelServer from "@/app/components/AdvStatsPanelServer";

export const revalidate = 60;

export default async function MobileAdvStatsPage() {
  return (
    <div className="px-2 py-4">
      <AdvStatsPanelServer />
    </div>
  );
}
