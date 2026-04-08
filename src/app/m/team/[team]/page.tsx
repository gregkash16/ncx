// src/app/m/team/[team]/page.tsx
import TeamSchedulePanel, {
  type TeamRosterPlayer,
} from "@/app/components/TeamSchedulePanel";
import {
  fetchIndStatsDataCached,
  fetchFactionMapCached,
  getDiscordMapCached,
  type IndRow,
} from "@/lib/googleSheets";

export const runtime = "nodejs";

function buildRoster(
  teamName: string,
  indStats: IndRow[],
  factionMap: Record<string, string> | null,
  discordMap: Record<string, any> | null
): TeamRosterPlayer[] {
  const ncxToDiscord: Record<string, string> = {};
  Object.entries(discordMap ?? {}).forEach(([discordId, payload]) => {
    const ncxid = String((payload as any)?.ncxid ?? "").trim();
    if (ncxid) ncxToDiscord[ncxid] = discordId;
  });

  return indStats
    .filter((r) => String(r.team ?? "").trim() === teamName)
    .map((r) => {
      const ncxid = String(r.ncxid ?? "").trim();
      const name = `${r.first ?? ""} ${r.last ?? ""}`.trim() || ncxid || "Unknown Pilot";
      const pickNum = Number(r.pick ?? 0);
      return {
        ncxid,
        name,
        faction: String(r.faction ?? "").trim() || null,
        discordId: ncxid ? ncxToDiscord[ncxid] ?? null : null,
        discordTag: null,
        isCaptain: pickNum === 0,
        wins: r.wins != null ? String(r.wins) : undefined,
        losses: r.losses != null ? String(r.losses) : undefined,
        points: r.points != null ? String(r.points) : undefined,
        plms: r.plms != null ? String(r.plms) : undefined,
        games: r.games != null ? String(r.games) : undefined,
        winPct: r.winPct != null ? String(r.winPct) : undefined,
        ppg: r.ppg != null ? String(r.ppg) : undefined,
        efficiency: r.efficiency != null ? String(r.efficiency) : undefined,
        war: r.war != null ? String(r.war) : undefined,
        h2h: r.h2h != null ? String(r.h2h) : undefined,
        potato: r.potato != null ? String(r.potato) : undefined,
        sos: r.sos != null ? String(r.sos) : undefined,
      };
    });
}

export default async function MobileTeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team } = await params;

  const [indStats, factionMap, discordMap] = await Promise.all([
    fetchIndStatsDataCached(),
    fetchFactionMapCached(),
    getDiscordMapCached(),
  ]);

  // We need the team name to build roster, but TeamSchedulePanel fetches it internally.
  // Build roster with whatever team slug decodes to.
  const decodedTeam = decodeURIComponent(team);
  const allStats = indStats ?? [];

  // Find the actual team name from ind stats that matches this slug
  const { teamSlug: slugFn } = await import("@/lib/slug");
  const matchedTeam = allStats.find(
    (r) => slugFn(String(r.team ?? "").trim()) === decodedTeam
  );
  const teamName = matchedTeam ? String(matchedTeam.team).trim() : "";
  const roster = teamName ? buildRoster(teamName, allStats, factionMap ?? null, discordMap ?? null) : undefined;

  return (
    <div className="py-4">
      <TeamSchedulePanel team={team} mode="mobile" roster={roster} />
    </div>
  );
}
