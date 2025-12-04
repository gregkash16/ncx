// /m/standings/page.tsx

import MobileStandings from "./MobileStandings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const runtime = "nodejs"; // for googleapis

export default async function MobileStandingsPage() {
  return <MobileStandings />;
}
