// src/app/m/advstats/page.tsx
import MobileAdvStatsServer from "./MobileAdvStatsServer";

export const revalidate = 60;

export default async function MobileAdvStatsPage() {
  return <MobileAdvStatsServer />;
}