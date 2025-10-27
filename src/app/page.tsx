// Cache the rendered page for 60s so we don't re-hit Sheets every request
export const revalidate = 60;

import Image from "next/image";
import CurrentWeekCard from "./components/CurrentWeekCard";
import StandingsPanel from "./components/StandingsPanel";
import MatchupsPanel from "./components/MatchupsPanel";
import IndStatsPanel from "./components/IndStatsPanel";
import ReportPanel from "./components/ReportPanel";
import PlayersPanelServer from "./components/PlayersPanelServer";
import AdvStatsPanelServer from "./components/AdvStatsPanelServer";
import HomeTabs from "./components/HomeTabs";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getDiscordMapCached,
  fetchMatchupsDataCached,
  fetchIndStatsDataCached,
  fetchStreamScheduleCached,
  fetchFactionMapCached,
} from "@/lib/googleSheets";

function parseWeekNum(label: string | undefined | null): number | null {
  if (!label) return null;
  const m = label.trim().match(/week\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/[<@!>]/g, "")
    .replace(/\D/g, "");
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const session = await getServerSession(authOptions);
  let message = "Please log in with your Discord.";

  if (session?.user) {
    try {
      const rawSessionId =
        (session.user as any).discordId ?? (session.user as any).id;
      const sessionId = normalizeDiscordId(rawSessionId);

      if (sessionId) {
        const discordMap = await getDiscordMapCached();
        const match = discordMap[sessionId];
        if (match) {
          const { ncxid, first, last } = match;
          message = `Welcome ${first} ${last}! – ${ncxid}`;
        } else {
          message = `Welcome ${session.user.name ?? "Pilot"}! – No NCXID Found.`;
        }
      } else {
        message = `Welcome ${session.user.name ?? "Pilot"}! – No Discord ID found`;
      }
    } catch (err) {
      console.error("Error fetching NCX info:", err);
      message = `Welcome ${session.user.name ?? "Pilot"}! – (Error fetching NCXID)`;
    }
  }

  // 1) Fetch active week & default matches (this gives us the true active week)
  const [{ weekTab: activeWeek, matches: activeMatches }, indStats, streamSched, factionMap] =
    await Promise.all([
      fetchMatchupsDataCached(),      // active week
      fetchIndStatsDataCached(),
      fetchStreamScheduleCached(),
      fetchFactionMapCached(),
    ]);

  // 2) Read ?w=WEEK N and enforce "only up to active"
  const requestedWeekRaw = (sp?.w as string | undefined) || undefined;
  const reqNum = parseWeekNum(requestedWeekRaw);
  const activeNum = parseWeekNum(activeWeek);
  const selectedWeek =
    reqNum && activeNum && reqNum <= activeNum ? requestedWeekRaw : undefined;

  // 3) If a valid past week is requested, refetch matches for that week
  const { matches: matchesToUse, weekTab: weekLabelForPanel } = selectedWeek
    ? await fetchMatchupsDataCached(selectedWeek)
    : { matches: activeMatches, weekTab: activeWeek };

  return (
    <main className="min-h-screen overflow-visible bg-gradient-to-b from-[#0b0b16] via-[#1a1033] to-[#0b0b16] text-zinc-100">
      {/* ... your hero ... */}

      <section className="w-full px-4 pb-24">
        <div className="w-full max-w-[110rem] mx-auto">
          <HomeTabs
            currentWeekPanel={
              <CurrentWeekCard
                key="current-week"
                // 👇 keep the true active, and the selected (if any)
                activeWeek={activeWeek}
                selectedWeek={selectedWeek}
              />
            }
            matchupsPanel={
              <MatchupsPanel
                key="matchups"
                data={matchesToUse}
                // Show label of the currently displayed set (selected or active)
                weekLabel={weekLabelForPanel}
                // 👇 also pass the true active week so pills know the max
                activeWeek={activeWeek}
                scheduleWeek={streamSched.scheduleWeek}
                scheduleMap={streamSched.scheduleMap}
                indStats={indStats ?? []}
                factionMap={factionMap}
              />
            }
            standingsPanel={<StandingsPanel key="standings" />}
            indStatsPanel={<IndStatsPanel key="indstats" data={indStats ?? []} />}
            advStatsPanel={<AdvStatsPanelServer key="advstats" />}
            playersPanel={<PlayersPanelServer key="players" />}
            reportPanel={<ReportPanel key="report" />}
          />
        </div>
      </section>
    </main>
  );
}
