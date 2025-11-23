// /src/app/(desktop)/page.tsx
// Cache the rendered page for 60s so we don't re-hit Sheets every request
export const revalidate = 60;

import { Suspense } from "react";

// components live at /src/app/components relative to (desktop)
import CurrentWeekCard from "../components/CurrentWeekCard";
import StandingsPanel from "../components/StandingsPanel";
import MatchupsPanel from "../components/MatchupsPanel";
import IndStatsPanel from "../components/IndStatsPanel";
import ReportPanel from "../components/ReportPanel";
import PlayersPanelServer from "../components/PlayersPanelServer";
import AdvStatsPanelServer from "../components/AdvStatsPanelServer";
import TeamSchedulePanel, {
  TeamRosterPlayer,
  TeamAdvStats,
} from "../components/TeamSchedulePanel";
import HomeTabs from "../components/HomeTabs";
import DesktopNavTabs from "../components/DesktopNavTabs";
import HomeLanding from "../components/HomeLanding";
import PlayoffsPanel from "../components/PlayoffsPanel";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getDiscordMapCached,
  fetchMatchupsDataCached,
  fetchIndStatsDataCached,
  fetchStreamScheduleCached,
  fetchFactionMapCached,
  fetchAdvStatsCached,
  type MatchRow,
  type IndRow,
} from "@/lib/googleSheets";
import { teamSlug } from "@/lib/slug";

function parseWeekNum(label: string | undefined | null): number | null {
  if (!label) return null;
  const m = label.trim().match(/week\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "").trim().replace(/[<@!>]/g, "").replace(/\D/g, "");
}

/**
 * Given ?team=<slug> and the IndStats rows, try to recover the
 * canonical team display name (e.g. "KDB", "NERF HERDERS").
 */
function resolveTeamNameFromParam(
  teamParam: string | undefined,
  indStats: IndRow[] | null | undefined
): string | undefined {
  if (!teamParam || !indStats || indStats.length === 0) return undefined;

  const target = teamParam.toLowerCase();
  const teams = Array.from(
    new Set(indStats.map((r) => String(r.team ?? "").trim()).filter(Boolean))
  );

  for (const name of teams) {
    if (teamSlug(name).toLowerCase() === target) {
      return name;
    }
  }

  return undefined;
}

/**
 * Build a roster array for a given team name using IndStats,
 * factionMap, and ncx → discord mappings.
 */
function buildTeamRoster(
  teamName: string | undefined,
  indStats: IndRow[] | null | undefined,
  factionMap: Record<string, string> | null | undefined,
  ncxToDiscord: Record<string, string>
): TeamRosterPlayer[] | undefined {
  if (!teamName || !indStats || indStats.length === 0) return undefined;

  const rowsForTeam = indStats.filter(
    (r) => String(r.team ?? "").trim() === teamName
  );
  if (rowsForTeam.length === 0) return undefined;

  const roster: TeamRosterPlayer[] = rowsForTeam.map((row) => {
    const ncxid = String(row.ncxid ?? "").trim();
    const first = String(row.first ?? "").trim();
    const last = String(row.last ?? "").trim();
    const nameFromStats = `${first} ${last}`.trim();

    const pickedName =
      nameFromStats || (ncxid ? `NCX ${ncxid}` : "Unknown Pilot");

    const discordId = ncxid ? ncxToDiscord[ncxid] ?? null : null;
    const faction = String(row.faction ?? "").trim() || null;

    const player: TeamRosterPlayer = {
      ncxid,
      name: pickedName,
      faction,
      discordId,
      discordTag: null,

      // Individual stats (all as strings for display)
      wins: row.wins != null ? String(row.wins) : undefined,
      losses: row.losses != null ? String(row.losses) : undefined,
      points: row.points != null ? String(row.points) : undefined,
      plms: row.plms != null ? String(row.plms) : undefined,
      games: row.games != null ? String(row.games) : undefined,
      winPct: row.winPct != null ? String(row.winPct) : undefined,
      ppg: row.ppg != null ? String(row.ppg) : undefined,
      efficiency: row.efficiency != null ? String(row.efficiency) : undefined,
      war: row.war != null ? String(row.war) : undefined,
      h2h: row.h2h != null ? String(row.h2h) : undefined,
      potato: row.potato != null ? String(row.potato) : undefined,
      sos: row.sos != null ? String(row.sos) : undefined,
    };

    return player;
  });

  return roster;
}

/** Map a raw AdvStats Table1 row (array) into a TeamAdvStats object. */
function mapAdvTable1Row(raw: any[]): TeamAdvStats {
  const s = (v: unknown) => (v ?? "").toString().trim();
  return {
    team: s(raw[0]),
    totalGames: s(raw[1]),
    avgWins: s(raw[2]),
    avgLoss: s(raw[3]),
    avgPoints: s(raw[4]),
    avgPlms: s(raw[5]),
    avgGames: s(raw[6]),
    avgWinPct: s(raw[7]),
    avgPpg: s(raw[8]),
    avgEfficiency: s(raw[9]),
    avgWar: s(raw[10]),
    avgH2h: s(raw[11]),
    avgPotato: s(raw[12]),
    avgSos: s(raw[13]),
  };
}

// NOTE: searchParams is a Promise in Next 15 server components
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  // Read team param for the Team tab (slug like "kdb")
  const teamParam = (sp?.team as string | undefined) || undefined;

  // --- Welcome banner (Discord -> NCXID lookup, cached) ---
  const session = await getServerSession(authOptions);
  let message = "Please log in with your Discord.";

  if (session?.user) {
    try {
      const rawSessionId =
        (session.user as any).discordId ?? (session.user as any).id;
      const sessionId = normalizeDiscordId(rawSessionId);

      if (sessionId) {
        const discordMap = await getDiscordMapCached();
        const match = (discordMap as any)[sessionId];
        if (match) {
          const { ncxid, first, last } = match as any;
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

  // 1) Get the true active week + default matches + stats
  const [
    { weekTab: activeWeek, matches: activeMatches },
    indStats,
    streamSched,
    factionMap,
    advStatsRaw,
  ] = await Promise.all([
    fetchMatchupsDataCached(), // active week (cached 60s)
    fetchIndStatsDataCached(), // cached 5m
    fetchStreamScheduleCached(), // cached 5m
    fetchFactionMapCached(), // tiny in-memory cache + live read
    fetchAdvStatsCached(), // advanced stats (same source as AdvStatsPanelServer)
  ]);

  // 2) Read ?w=WEEK N and enforce "only up to active"
  const requestedWeekRaw = (sp?.w as string | undefined) || undefined;
  const reqNum = parseWeekNum(requestedWeekRaw);
  const activeNum = parseWeekNum(activeWeek);
  const selectedWeek =
    reqNum && activeNum && reqNum <= activeNum ? requestedWeekRaw : undefined;

  // 3) If a valid past week is requested, fetch that week’s matches (cached by week key)
  const {
    matches: matchesToUse,
    weekTab: weekLabelForPanel,
  }: { matches: MatchRow[]; weekTab: string } = selectedWeek
    ? await fetchMatchupsDataCached(selectedWeek)
    : { matches: activeMatches, weekTab: activeWeek };

  // Attach Discord IDs by NCXID (for Matchups + roster DM links)
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

  // --- Build roster for the Team tab (if teamParam is present) ---
  const teamNameFromStats = resolveTeamNameFromParam(
    teamParam,
    indStats ?? []
  );
  const teamRoster = buildTeamRoster(
    teamNameFromStats,
    indStats ?? [],
    factionMap,
    ncxToDiscord
  );

  // --- Pull this team's advanced stats row from AdvStats Table1 ---
  let teamAdvStats: TeamAdvStats | undefined;
  if (teamNameFromStats && advStatsRaw?.t1) {
    const t1 = advStatsRaw.t1 as any[];
    const rawRow = t1.find(
      (r) => (r?.[0] ?? "").toString().trim() === teamNameFromStats
    );
    if (rawRow) {
      teamAdvStats = mapAdvTable1Row(rawRow as any[]);
    }
  }

  return (
    <main className="min-h-screen overflow-visible bg-gradient-to-b from-[#0b0b16] via-[#1a1033] to-[#0b0b16] text-zinc-100">
      {/* HERO */}
      <section className="relative max-w-6xl mx-auto px-6 pt-24 pb-6 text-center">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,0,150,0.25),transparent_70%)] animate-pulse" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_120%,rgba(0,255,255,0.15),transparent_60%)] blur-3xl" />
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 text-transparent bg-clip-text drop-shadow-[0_0_25px_rgba(255,0,255,0.25)]">
          DRAFT LEAGUE • SEASON 8
        </h1>
        <div>
          <p className="text-zinc-300 text-lg font-medium">{message}</p>
        </div>
      </section>

      {/* TABS + PANELS */}
      <section className="w-full px-4 pb-24">
        <div className="w-full max-w-[110rem] mx-auto">
          {/* Desktop tab buttons (header bar) */}
          <Suspense fallback={null}>
            <DesktopNavTabs />
          </Suspense>

          <HomeTabs
            hideButtons
            homePanel={<HomeLanding message={message} />}
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
            /* Provide the Team tab when ?team= is present */
            teamPanel={
              teamParam ? (
                <TeamSchedulePanel
                  key={`team-${teamParam}`}
                  team={teamParam}
                  mode="desktop"
                  roster={teamRoster}
                  teamAdvStats={teamAdvStats}
                />
              ) : undefined
            }
            playoffsPanel={<PlayoffsPanel key="playoffs" />} 
          />
        </div>
      </section>
    </main>
  );
}
