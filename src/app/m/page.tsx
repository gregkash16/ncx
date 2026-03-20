// src/app/m/page.tsx
import HomeLanding from "../components/HomeLanding";
import { teamSlug } from "@/lib/slug";
import { getIOSServerSession } from "@/lib/getIOSServerSession";
import { getDiscordMapCached, fetchFactionMapCached, fetchIndStatsDataCached, type IndRow } from "@/lib/googleSheets";

export const revalidate = 60;

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/[<@!>]/g, "")
    .replace(/\D/g, "");
}

export default async function MobileHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  // --- DEV IMPERSONATION (development only) ---
  const devPassword = process.env.DEV_IMPERSONATION_PASSWORD;
  const isDevMode = process.env.NODE_ENV === "development";
  let devNcxId: string | null = null;

  if (isDevMode && devPassword) {
    const passParam = sp?.password as string | undefined;
    const ncxidParam = sp?.ncxid as string | undefined;
    if (passParam === devPassword && ncxidParam) {
      devNcxId = ncxidParam.toUpperCase();
    }
  }

  // --- Welcome banner (same logic as desktop, but simplified) ---
  const session = await getIOSServerSession();
  let message = "Please log in with your Discord.";
  let playerStats: IndRow | null = null;
  let targetNcxId: string | null = devNcxId;
  let loggedInNoNcxId = false;

  if (!devNcxId && session?.user) {
    try {
      const rawSessionId =
        (session.user as any).discordId ?? (session.user as any).id;
      const sessionId = normalizeDiscordId(rawSessionId);

      if (sessionId) {
        const discordMap = await getDiscordMapCached();
        const match = (discordMap as any)?.[sessionId];

        if (match) {
          const { ncxid, first, last } = match as any;
          targetNcxId = ncxid;
          message = `Welcome ${first} ${last}! – ${ncxid}`;
        } else {
          message = `Welcome ${session.user.name ?? "Pilot"}! – No NCXID Found.`;
          loggedInNoNcxId = true;
        }
      } else {
        message = `Welcome ${session.user.name ?? "Pilot"}! – No Discord ID found`;
        loggedInNoNcxId = true;
      }
    } catch (err) {
      console.error("Error fetching NCX info (mobile):", err);
      message = `Welcome ${session.user.name ?? "Pilot"}! – (Error fetching NCXID)`;
      loggedInNoNcxId = true;
    }
  } else if (devNcxId) {
    message = `[DEV] Impersonating ${devNcxId}`;
  }

  // Fetch player stats if we have an NCXID
  if (targetNcxId) {
    try {
      const indStats = await fetchIndStatsDataCached();
      playerStats = indStats.find((s) => s.ncxid === targetNcxId) ?? null;
    } catch (err) {
      console.error("Error fetching player stats:", err);
    }
  }

  // Factions for the matchup widget (by NCXID)
  const factionMap = await fetchFactionMapCached();

  return (
    <div className="space-y-8 py-4">
      <HomeLanding
        message={message}
        rulesHref="/m/rules"
        factionMap={factionMap ?? undefined}
        buildTeamHref={(team) =>
          `/m/team/${encodeURIComponent(teamSlug(team.filterValue))}`
        }
        hideTeamGrid={true}
        hideStreamerKit={true}
        podcastHref="/m/podcast"
      />

      {/* Player stats section or login/error prompt */}
      {playerStats ? (
        <div className="rounded-2xl border border-cyan-500/40 bg-zinc-900/70 p-6 shadow-xl">
          <h3 className="text-lg font-bold text-cyan-400 mb-4">Your Stats</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatItem label="Rank" value={playerStats.rank} />
            <StatItem label="Team" value={playerStats.team} />
            <StatItem label="Wins" value={playerStats.wins} />
            <StatItem label="Losses" value={playerStats.losses} />
            <StatItem label="Points" value={playerStats.points} />
            <StatItem label="PLMS" value={playerStats.plms} />
            <StatItem label="Games" value={playerStats.games} />
            <StatItem label="Win %" value={playerStats.winPct} />
            <StatItem label="PPG" value={playerStats.ppg} />
            <StatItem label="Efficiency" value={playerStats.efficiency} />
            <StatItem label="WAR" value={playerStats.war} />
            <StatItem label="H2H" value={playerStats.h2h} />
            <StatItem label="Potato" value={playerStats.potato} />
            <StatItem label="SoS" value={playerStats.sos} />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-purple-500/40 bg-zinc-900/70 p-6 shadow-xl text-center">
          <p className="text-zinc-300 font-medium">
            {loggedInNoNcxId
              ? "No NCXID Found"
              : "Please log in with Discord to view your stats"}
          </p>
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg bg-zinc-950/60 p-3 border border-zinc-700">
      <span className="text-xs font-semibold text-zinc-400 uppercase">{label}</span>
      <span className="text-sm font-bold text-zinc-100 mt-1">{value || "–"}</span>
    </div>
  );
}
