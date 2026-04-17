import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

function normalizeNcxId(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function norm(v: unknown): string {
  return String(v ?? "").trim();
}

// Map database faction values to exact file names in public/factions/
const FACTION_NORMALIZE: Record<string, string> = {
  "cis": "CIS",
  "empire": "Empire",
  "first order": "First Order",
  "rebels": "Rebels",
  "republic": "Republic",
  "resistance": "Resistance",
  "scum": "Scum",
};

function normalizeFaction(v: string): string {
  return FACTION_NORMALIZE[v.trim().toLowerCase()] || v;
}

type RecentMatch = {
  season: "S8" | "S9";
  week: string;
  playerFaction: string;
  playerTeam: string;
  opponentName: string;
  opponentId: string;
  opponentFaction: string;
  opponentTeam: string;
  outcome: "W" | "L";
  playerPts: number;
  opponentPts: number;
};

type Nemesis = {
  opponentId: string;
  wins: number;
  losses: number;
};

type AllTimeStats = {
  wins: number;
  losses: number;
  points: number;
  plms: number;
  games: number;
  winPct: number;
  ppg: number;
  adjPpg: string;
  championships: string;
  seasons: (string | null)[];
};

type PlayerDetails = {
  ncxid: string;
  playerFaction: string;
  recentMatches: RecentMatch[];
  recordLast10: { wins: number; losses: number };
  factionWins: number;
  factionLosses: number;
  currentWinStreak: number;
  currentLossStreak: number;
  nemesis: Nemesis | null;
  allTimeStats: AllTimeStats | null;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ ncxid: string }> }
) {
  try {
    const { ncxid: rawNcxId } = await params;
    const ncxid = normalizeNcxId(rawNcxId);

    if (!ncxid.startsWith("NCX")) {
      return NextResponse.json({ error: "Invalid ncxid" }, { status: 400 });
    }

    // 1. Get current week from S9 to determine which faction field to use
    const [currentWeekRows] = await pool.query<any[]>(
      `SELECT week_label FROM S9.current_week LIMIT 1`
    );
    const currentWeekStr = norm(currentWeekRows?.[0]?.week_label || "WEEK 1");
    const currentWeekNum = parseInt(
      currentWeekStr.match(/\d+/)?.[0] || "1",
      10
    );

    // 2. Fetch faction info from both S9 and S8
    const [factionRowsS9] = await pool.query<any[]>(
      `SELECT faction_h, faction_i FROM S9.ncxid WHERE ncxid = ?`,
      [ncxid]
    );
    const [factionRowsS8] = await pool.query<any[]>(
      `SELECT faction_h, faction_i FROM S8.ncxid WHERE ncxid = ?`,
      [ncxid]
    );

    const factionRowS9 = factionRowsS9?.[0];
    const factionRowS8 = factionRowsS8?.[0];

    // Use S9 faction if available, otherwise S8 (since S9 may not have started)
    const playerFactionRaw = norm(
      currentWeekNum >= 5
        ? factionRowS9?.faction_i || factionRowS9?.faction_h || factionRowS8?.faction_i || factionRowS8?.faction_h || ""
        : factionRowS9?.faction_h || factionRowS9?.faction_i || factionRowS8?.faction_h || factionRowS8?.faction_i || ""
    );
    const playerFaction = normalizeFaction(playerFactionRaw);

    // 2. Fetch all matches - S9 first (descending), then S8 (descending)
    const [matchRowsS9] = await pool.query<any[]>(
      `
      SELECT
        week_label,
        game,
        awayId,
        homeId,
        awayTeam,
        homeTeam,
        awayPts,
        homePts
      FROM S9.weekly_matchups
      WHERE (awayId = ? OR homeId = ?)
        AND awayPts IS NOT NULL
        AND homePts IS NOT NULL
      ORDER BY
        CAST(SUBSTRING_INDEX(week_label, ' ', -1) AS UNSIGNED) DESC,
        CAST(game AS UNSIGNED) DESC
      `,
      [ncxid, ncxid]
    );

    const [matchRowsS8] = await pool.query<any[]>(
      `
      SELECT
        week_label,
        game,
        awayId,
        homeId,
        awayTeam,
        homeTeam,
        awayPts,
        homePts
      FROM S8.weekly_matchups
      WHERE (awayId = ? OR homeId = ?)
        AND awayPts IS NOT NULL
        AND homePts IS NOT NULL
      ORDER BY
        CAST(SUBSTRING_INDEX(week_label, ' ', -1) AS UNSIGNED) DESC,
        CAST(game AS UNSIGNED) DESC
      `,
      [ncxid, ncxid]
    );

    // Combine: S9 matches first (newest), then S8 matches
    const matchRows = [...(matchRowsS9 || []), ...(matchRowsS8 || [])];

    // 3. Process matches for recent list and streaks
    const recentMatches: RecentMatch[] = [];
    const matchResults: ("W" | "L")[] = [];

    // Build a map of opponent names from both databases
    const [allPlayersS9] = await pool.query<any[]>(
      `SELECT ncxid, first_name, last_name FROM S9.all_time_stats`
    );
    const [allPlayersS8] = await pool.query<any[]>(
      `SELECT ncxid, first_name, last_name FROM S8.all_time_stats`
    );

    const playerNames = new Map<string, string>();
    for (const p of [...(allPlayersS9 || []), ...(allPlayersS8 || [])]) {
      const id = norm(p.ncxid);
      const first = norm(p.first_name);
      const last = norm(p.last_name);
      const name = first && last ? `${first} ${last}` : first || last || id;
      if (!playerNames.has(id)) {
        playerNames.set(id, name);
      }
    }

    // Pre-fetch all opponent factions to avoid N+1 queries
    const oppIds = new Set<string>();
    for (const m of matchRows || []) {
      const isAway = norm(m.awayId) === ncxid;
      const opponentId = isAway ? norm(m.homeId) : norm(m.awayId);
      oppIds.add(opponentId);
    }

    const opponentFactionsMap = new Map<
      string,
      { faction_h?: string; faction_i?: string; season: "S8" | "S9" }
    >();

    for (const oppId of oppIds) {
      const [oppRowsS9] = await pool.query<any[]>(
        `SELECT faction_h, faction_i FROM S9.ncxid WHERE ncxid = ?`,
        [oppId]
      );
      const [oppRowsS8] = await pool.query<any[]>(
        `SELECT faction_h, faction_i FROM S8.ncxid WHERE ncxid = ?`,
        [oppId]
      );
      const s9Row = oppRowsS9?.[0];
      const s8Row = oppRowsS8?.[0];
      opponentFactionsMap.set(oppId, {
        faction_h: s9Row?.faction_h || s8Row?.faction_h,
        faction_i: s9Row?.faction_i || s8Row?.faction_i,
        season: s9Row ? "S9" : "S8",
      });
    }

    for (const m of matchRows || []) {
      const isAway = norm(m.awayId) === ncxid;
      const opponentId = isAway ? norm(m.homeId) : norm(m.awayId);
      const playerPts = Number(isAway ? m.awayPts : m.homePts) || 0;
      const opponentPts = Number(!isAway ? m.awayPts : m.homePts) || 0;

      // Skip unplayed matches (both sides 0 points)
      if (playerPts === 0 && opponentPts === 0) continue;

      const outcome: "W" | "L" = playerPts > opponentPts ? "W" : "L";

      matchResults.push(outcome);

      if (recentMatches.length < 5) {
        // Determine season based on which database it came from
        const isS9 = matchRowsS9?.some(
          (row) =>
            norm(row.awayId) === ncxid &&
            norm(row.homeId) === opponentId &&
            norm(row.week_label) === norm(m.week_label)
        ) ||
        matchRowsS9?.some(
          (row) =>
            norm(row.homeId) === ncxid &&
            norm(row.awayId) === opponentId &&
            norm(row.week_label) === norm(m.week_label)
        );
        const season: "S8" | "S9" = isS9 ? "S9" : "S8";

        const opponentName = playerNames.get(opponentId) || opponentId;

        // Get team names from the match
        const playerTeam = isAway ? norm(m.awayTeam) : norm(m.homeTeam);
        const opponentTeam = !isAway ? norm(m.awayTeam) : norm(m.homeTeam);

        // Parse week number (e.g. "WEEK 11" -> 11)
        const matchWeekMatch = norm(m.week_label).match(/\d+/);
        const matchWeekNum = matchWeekMatch ? parseInt(matchWeekMatch[0], 10) : 0;

        // Determine player's faction during THIS match
        let matchPlayerFaction = "";
        if (season === "S9") {
          matchPlayerFaction = normalizeFaction(matchWeekNum >= 5
            ? norm(factionRowS9?.faction_i || "")
            : norm(factionRowS9?.faction_h || ""));
        } else {
          matchPlayerFaction = normalizeFaction(matchWeekNum >= 5
            ? norm(factionRowS8?.faction_i || "")
            : norm(factionRowS8?.faction_h || ""));
        }

        // Get opponent faction from pre-fetched cache
        const oppFactionData = opponentFactionsMap.get(opponentId);
        let opponentFactionRaw = "";
        if (season === "S9") {
          opponentFactionRaw = norm(
            matchWeekNum >= 5
              ? oppFactionData?.faction_i || ""
              : oppFactionData?.faction_h || ""
          );
        } else {
          opponentFactionRaw = norm(
            matchWeekNum >= 5
              ? oppFactionData?.faction_i || ""
              : oppFactionData?.faction_h || ""
          );
        }
        const opponentFaction = normalizeFaction(opponentFactionRaw);

        recentMatches.push({
          season,
          week: norm(m.week_label),
          playerFaction: matchPlayerFaction,
          playerTeam,
          opponentName,
          opponentId,
          opponentFaction,
          opponentTeam,
          outcome,
          playerPts,
          opponentPts,
        });
      }
    }

    // 4. Calculate current streaks (from most recent game)
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    if (matchResults.length > 0) {
      const mostRecent = matchResults[0];
      for (const result of matchResults) {
        if (result === mostRecent) {
          if (mostRecent === "W") {
            currentWinStreak++;
          } else {
            currentLossStreak++;
          }
        } else {
          break; // Stop when streak breaks
        }
      }
    }

    // 5. Calculate Record Last 10
    let recordLast10 = { wins: 0, losses: 0 };
    for (let i = 0; i < Math.min(10, matchResults.length); i++) {
      if (matchResults[i] === "W") {
        recordLast10.wins++;
      } else {
        recordLast10.losses++;
      }
    }

    // 6. Calculate faction W/L - record while in CURRENT faction
    let factionWins = 0;
    let factionLosses = 0;

    for (const m of matchRows || []) {
      const isAway = norm(m.awayId) === ncxid;
      const playerPts = Number(isAway ? m.awayPts : m.homePts) || 0;
      const opponentPts = Number(!isAway ? m.awayPts : m.homePts) || 0;

      // Skip unplayed matches
      if (playerPts === 0 && opponentPts === 0) continue;

      const isWin = playerPts > opponentPts;

      // Determine season
      const isS9Match = matchRowsS9?.some(
        (row) =>
          norm(row.week_label) === norm(m.week_label) &&
          norm(row.game) === norm(m.game)
      );
      const season = isS9Match ? "S9" : "S8";

      // Parse week number (e.g. "WEEK 11" -> 11)
      const weekMatch = norm(m.week_label).match(/\d+/);
      const weekNum = weekMatch ? parseInt(weekMatch[0], 10) : 0;

      // Determine player's faction during THIS match
      let matchFaction = "";
      if (season === "S9") {
        matchFaction = normalizeFaction(weekNum >= 5
          ? norm(factionRowS9?.faction_i || "")
          : norm(factionRowS9?.faction_h || ""));
      } else {
        matchFaction = normalizeFaction(weekNum >= 5
          ? norm(factionRowS8?.faction_i || "")
          : norm(factionRowS8?.faction_h || ""));
      }

      // Only count if player was in CURRENT faction during this match
      if (matchFaction && matchFaction === playerFaction) {
        if (isWin) {
          factionWins++;
        } else {
          factionLosses++;
        }
      }
    }

    // 7. Calculate NEMESIS - opponent with worst record
    const opponentRecords = new Map<string, { wins: number; losses: number }>();

    for (const m of matchRows || []) {
      const isAway = norm(m.awayId) === ncxid;
      const opponentId = isAway ? norm(m.homeId) : norm(m.awayId);
      const playerPts = Number(isAway ? m.awayPts : m.homePts) || 0;
      const opponentPts = Number(!isAway ? m.awayPts : m.homePts) || 0;

      // Skip unplayed matches
      if (playerPts === 0 && opponentPts === 0) continue;

      const isWin = playerPts > opponentPts;

      const current = opponentRecords.get(opponentId) || { wins: 0, losses: 0 };
      if (isWin) {
        current.wins++;
      } else {
        current.losses++;
      }
      opponentRecords.set(opponentId, current);
    }

    let nemesis: Nemesis | null = null;
    if (opponentRecords.size > 0) {
      let mostLosses = -1;
      for (const [oppId, record] of opponentRecords.entries()) {
        // Find opponent with most losses (nemesis = who you've lost to the most)
        if (record.losses > mostLosses) {
          mostLosses = record.losses;
          nemesis = {
            opponentId: oppId,
            wins: record.wins,
            losses: record.losses,
          };
        }
      }
    }

    // 8. All-time career summary (matches desktop Players panel stats grid)
    const [allTimeRows] = await pool.query<any[]>(
      `SELECT wins, losses, points, plms, games, win_pct, ppg, adj_ppg,
              s1, s2, s3, s4, s5, s6, s7, s8, s9, championships
         FROM S9.all_time_stats
        WHERE ncxid = ?
        LIMIT 1`,
      [ncxid]
    );
    const at = allTimeRows?.[0];
    const allTimeStats: AllTimeStats | null = at
      ? {
          wins: Number(at.wins ?? 0),
          losses: Number(at.losses ?? 0),
          points: Number(at.points ?? 0),
          plms: Number(at.plms ?? 0),
          games: Number(at.games ?? 0),
          winPct: Number(at.win_pct ?? 0),
          ppg: Number(at.ppg ?? 0),
          adjPpg: norm(at.adj_ppg),
          championships: norm(at.championships),
          seasons: [
            at.s1 || null,
            at.s2 || null,
            at.s3 || null,
            at.s4 || null,
            at.s5 || null,
            at.s6 || null,
            at.s7 || null,
            at.s8 || null,
            at.s9 || null,
          ],
        }
      : null;

    const details: PlayerDetails = {
      ncxid,
      playerFaction,
      recentMatches,
      recordLast10,
      factionWins,
      factionLosses,
      currentWinStreak,
      currentLossStreak,
      nemesis,
      allTimeStats,
    };

    return NextResponse.json(details);
  } catch (err: any) {
    console.error("GET /api/players/[ncxid]/details error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load player details" },
      { status: 500 }
    );
  }
}
