// Cache the rendered page for 60s so we don't re-hit Sheets every request
export const revalidate = 60;

import Image from "next/image";
import CurrentWeekCard from "./components/CurrentWeekCard";
import StandingsPanel from "./components/StandingsPanel";
import MatchupsPanel from "./components/MatchupsPanel";
import IndStatsPanel from "./components/IndStatsPanel";
import ReportPanel from "./components/ReportPanel";
import HomeTabs from "./components/HomeTabs";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getDiscordMapCached,
  fetchMatchupsDataCached,
  fetchIndStatsDataCached,
  fetchStreamScheduleCached,
} from "@/lib/googleSheets";

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/[<@!>]/g, "")
    .replace(/\D/g, "");
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  let message = "Please log in with your Discord.";

  if (session?.user) {
    try {
      const rawSessionId =
        (session.user as any).discordId ?? (session.user as any).id;
      const sessionId = normalizeDiscordId(rawSessionId);

      if (sessionId) {
        // ✅ cached Discord map to avoid hammering Sheets
        const discordMap = await getDiscordMapCached();
        const match = discordMap[sessionId];  // ← instead of .get(sessionId)

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

  // Server fetches for tabs (concurrent, cached)
  const [{ weekTab, matches }, indStats, streamSched] = await Promise.all([
    fetchMatchupsDataCached(),   // SCHEDULE!U2 + WEEK!A2:Q120 (cached 60s)
    fetchIndStatsDataCached(),   // INDIVIDUAL!A2:V (cached 5m)
    fetchStreamScheduleCached(), // Stream sheet M3 + A2:I (cached 5m, fail-soft)
  ]);

  return (
    <main className="min-h-screen overflow-visible bg-gradient-to-b from-[#0b0b16] via-[#1a1033] to-[#0b0b16] text-zinc-100">
      {/* Subtle animated glow background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,0,150,0.25),transparent_70%)] animate-pulse"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_120%,rgba(0,255,255,0.15),transparent_60%)] blur-3xl"></div>
      </div>

      {/* HERO (kept at max-w-6xl) */}
      <section className="relative max-w-6xl mx-auto px-6 pt-24 pb-6 text-center">
        <div className="flex flex-col items-center space-y-6">
          <Image
            src="/logo.png"
            alt="NCX Draft League Season 8"
            width={240}
            height={240}
            priority
            className="drop-shadow-[0_0_30px_rgba(255,0,150,0.5)] hover:scale-105 transition-transform duration-500"
          />

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 text-transparent bg-clip-text drop-shadow-[0_0_25px_rgba(255,0,255,0.25)]">
            DRAFT LEAGUE • SEASON 8
          </h1>

          <p className="text-zinc-300 text-lg font-medium">{message}</p>
        </div>
      </section>

      {/* TABS + PANELS (WIDE, OUTSIDE HERO) */}
      <section className="w-full px-4 pb-24">
        <div className="w-full max-w-[110rem] mx-auto">
          <HomeTabs
            currentWeekPanel={<CurrentWeekCard key="current-week" />}
            matchupsPanel={
              <MatchupsPanel
                key="matchups"
                data={matches}
                weekLabel={weekTab}
                scheduleWeek={streamSched.scheduleWeek} // M3 from stream sheet
                scheduleMap={streamSched.scheduleMap}   // { "13": { day, slot }, ... }
              />
            }
            standingsPanel={<StandingsPanel key="standings" />}
            indStatsPanel={<IndStatsPanel key="indstats" data={indStats ?? []} />}
            reportPanel={<ReportPanel key="report" />}
          />
        </div>
      </section>
    </main>
  );
}
