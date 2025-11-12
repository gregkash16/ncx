// /src/app/(desktop)/page.tsx
export const revalidate = 60;

import Image from "next/image";

// Components live in /src/app/components
import CurrentWeekCard from "../../components/CurrentWeekCard";
import StandingsPanel from "../../components/StandingsPanel";
import MatchupsPanel from "../../components/MatchupsPanel";
import IndStatsPanel from "../../components/IndStatsPanel";
import ReportPanel from "../../components/ReportPanel";
import PlayersPanelServer from "../../components/PlayersPanelServer";
import AdvStatsPanelServer from "../../components/AdvStatsPanelServer";
import TeamSchedulePanel from "../../components/TeamSchedulePanel";

import HomeTabs from "@/components/HomeTabs";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getDiscordMapCached,
  fetchMatchupsDataCached,
  fetchIndStatsDataCached,
  fetchStreamScheduleCached,
  fetchFactionMapCached,
  type MatchRow,
} from "@/lib/googleSheets";

function parseWeekNum(label: string | undefined | null): number | null {
  if (!label) return null;
  const m = label.trim().match(/week\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "").trim().replace(/[<@!>]/g, "").replace(/\D/g, "");
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  // 👇 read team param for Team tab
  const teamParam = (sp?.team as string | undefined) || undefined;
  const tabParam = (sp?.tab as string | undefined) || undefined;

  // Welcome banner
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
    } catch {
      message = `Welcome ${session.user.name ?? "Pilot"}! – (Error fetching NCXID)`;
    }
  }

  // Active week + data
  const [
    { weekTab: activeWeek, matches: activeMatches },
  , indStats
  , streamSched
  , factionMap
  ] = await Promise.all([
    fetchMatchupsDataCached(),
    fetchIndStatsDataCached(),
    fetchStreamScheduleCached(),
    fetchFactionMapCached(),
  ]);

  // Handle ?w=WEEK N (only up to active)
  const requestedWeekRaw = (sp?.w as string | undefined) || undefined;
  const reqNum = parseWeekNum(requestedWeekRaw);
  const activeNum = parseWeekNum(activeWeek);
  const selectedWeek =
    reqNum && activeNum && reqNum <= activeNum ? requestedWeekRaw : undefined;

  // Pull matches for selected week (or active)
  const { matches: matchesToUse, weekTab: weekLabelForPanel } = selectedWeek
    ? await fetchMatchupsDataCached(selectedWeek)
    : { matches: activeMatches, weekTab: activeWeek };

  // Attach Discord IDs by NCXID
  const discordMap = await getDiscordMapCached();
  const ncxToDiscord: Record<string, string> = {};
  for (const [discordId, payload] of Object.entries(discordMap ?? {})) {
    const ncxid = (payload as any)?.ncxid?.trim?.() ?? "";
    if (ncxid && /^\d{5,}$/.test(discordId)) {
      ncxToDiscord[ncxid] = discordId;
    }
  }
  const dataWithDiscord = matchesToUse.map((m) => ({
    ...m,
    awayDiscordId: m.awayId ? ncxToDiscord[m.awayId] ?? null : null,
    homeDiscordId: m.homeId ? ncxToDiscord[m.homeId] ?? null : null,
  })) as unknown as MatchRow[];

  return (
    <main className="min-h-screen overflow-visible bg-gradient-to-b from-[#0b0b16] via-[#1a1033] to-[#0b0b16] text-zinc-100">
      {/* HERO */}
      <section className="relative max-w-6xl mx-auto px-6 pt-24 pb-6 text-center">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,0,150,0.25),transparent_70%)] animate-pulse"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_120%,rgba(0,255,255,0.15),transparent_60%)] blur-3xl"></div>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 text-transparent bg-clip-text drop-shadow-[0_0_25px_rgba(255,0,255,0.25)]">
          DRAFT LEAGUE • SEASON 8
        </h1>
        <p className="text-zinc-300 text-lg font-medium">{message}</p>
      </section>

      {/* TABS + PANELS */}
      <section className="w-full px-4 pb-24">
        <div className="w-full max-w-[110rem] mx-auto">
          <HomeTabs
            currentWeekPanel={
              <CurrentWeekCard
                key="current-week"
                activeWeek={activeWeek}
                selectedWeek={selectedWeek}
              />
            }
            matchupsPanel={
              <MatchupsPanel
                key="matchups"
                data={dataWithDiscord}
                weekLabel={weekLabelForPanel}
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
            // 👇 THIS IS THE IMPORTANT PART
            teamPanel={
              teamParam ? (
                <TeamSchedulePanel key={`team-${teamParam}`} team={teamParam} />
              ) : undefined
            }
          />
        </div>
      </section>
    </main>
  );
}
