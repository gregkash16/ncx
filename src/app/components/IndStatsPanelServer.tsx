// Server component: fetch + pass data to the client panel
import { fetchIndStatsDataCached } from "@/lib/googleSheets";
import IndStatsPanel from "./IndStatsPanel";

export default async function IndStatsPanelServer() {
  const data = (await fetchIndStatsDataCached()) ?? []; // ensure array
  return <IndStatsPanel data={data} />;
}
