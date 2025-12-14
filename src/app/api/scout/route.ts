// src/app/api/scout/route.ts
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Reuse the same ship icon map you already have in googleSheets.ts
const SHIP_ICON_MAP: Record<string, string> = {
  t65xwing: "x",
  tieininterceptor: "I",
  tieadvancedx1: "A",
  // ... (copy your full map here)
};

type XwsPilot = { id?: string; ship?: string };
type XwsListJson = { pilots?: XwsPilot[] };

function norm(v: unknown) {
  return String(v ?? "").trim();
}

function safeParseXws(jsonVal: unknown): XwsListJson | null {
  if (jsonVal == null) return null;
  if (typeof jsonVal === "object") return jsonVal as XwsListJson;

  if (typeof jsonVal === "string") {
    const raw = jsonVal.trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw) as XwsListJson;
    } catch {
      return null;
    }
  }
  return null;
}

function pickBestWorst(
  rows: Array<{
    scenario: string;
    games: number;
    wins: number;
    winPct: number;
    avgMov: number;
  }>,
  minGames = 2
) {
  const eligible = rows.filter((r) => r.games >= minGames);
  if (eligible.length === 0) return { best: null, worst: null };

  const best = [...eligible].sort((a, b) => {
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    return b.avgMov - a.avgMov;
  })[0];

  const worst = [...eligible].sort((a, b) => {
    if (a.winPct !== b.winPct) return a.winPct - b.winPct;
    return a.avgMov - b.avgMov;
  })[0];

  return { best, worst };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("ncxid");
  const ncxid = normalizeNcxId(raw);

    if (!ncxid.startsWith("NCX")) {
    return NextResponse.json({ error: "Invalid ncxid" }, { status: 400 });
    }


  console.log("SCOUT ncxid raw:", searchParams.get("ncxid"));

  const minGames = Number(searchParams.get("minGames") ?? "2") || 2;

  function normalizeNcxId(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  }

  // 1) Pull all completed games involving this player
  const [matchRows] = await pool.query<any[]>(
    `
    SELECT
      week_label,
      game,
      awayId,
      homeId,
      awayPts,
      homePts,
      scenario
    FROM weekly_matchups
    WHERE (awayId = ? OR homeId = ?)
      AND scenario IS NOT NULL
      AND TRIM(scenario) <> ''
    ORDER BY
      CAST(SUBSTRING_INDEX(week_label,' ', -1) AS UNSIGNED) ASC,
      CAST(game AS UNSIGNED) ASC
    `,
    [ncxid, ncxid]
  );

  // 2) Scenario aggregates (player-perspective)
  const byScenario = new Map<
    string,
    { games: number; wins: number; movSum: number }
  >();

  for (const r of matchRows) {
    const scenario = norm(r.scenario) || "Unknown";
    const isAway = norm(r.awayId) === ncxid;

    const awayPts = Number(norm(r.awayPts)) || 0;
    const homePts = Number(norm(r.homePts)) || 0;

    const pointsFor = isAway ? awayPts : homePts;
    const pointsAgainst = isAway ? homePts : awayPts;
    const mov = pointsFor - pointsAgainst;
    const win = mov > 0 ? 1 : 0;

    const cur = byScenario.get(scenario) ?? { games: 0, wins: 0, movSum: 0 };
    cur.games += 1;
    cur.wins += win;
    cur.movSum += mov;
    byScenario.set(scenario, cur);
  }

  const scenarioRows = Array.from(byScenario.entries()).map(([scenario, a]) => {
    const winPct = a.games ? (a.wins / a.games) * 100 : 0;
    const avgMov = a.games ? a.movSum / a.games : 0;
    return {
      scenario,
      games: a.games,
      wins: a.wins,
      losses: a.games - a.wins,
      winPct: Number(winPct.toFixed(1)),
      avgMov: Number(avgMov.toFixed(2)),
    };
  });

  scenarioRows.sort((a, b) => b.games - a.games);

  const { best, worst } = pickBestWorst(
    scenarioRows.map((r) => ({
      scenario: r.scenario,
      games: r.games,
      wins: r.wins,
      winPct: r.winPct,
      avgMov: r.avgMov,
    })),
    minGames
  );

  // 3) Ship/pilot usage via lists join on (week_label, game)
  const [listRows] = await pool.query<any[]>(
    `
    SELECT
      w.week_label,
      w.game,
      w.awayId,
      w.homeId,
      l.away_xws,
      l.home_xws
    FROM weekly_matchups w
    LEFT JOIN lists l
      ON l.week_label = w.week_label
     AND l.game = w.game
    WHERE (w.awayId = ? OR w.homeId = ?)
      AND w.scenario IS NOT NULL
      AND TRIM(w.scenario) <> ''
    `,
    [ncxid, ncxid]
  );

  const pilotCounts = new Map<string, { uses: number; ship?: string }>();

  for (const r of listRows) {
    const isAway = norm(r.awayId) === ncxid;
    const xwsRaw = isAway ? r.away_xws : r.home_xws;
    const parsed = safeParseXws(xwsRaw);
    if (!parsed?.pilots?.length) continue;

    for (const p of parsed.pilots) {
      const pid = norm(p.id);
      if (!pid) continue;

      const cur = pilotCounts.get(pid) ?? { uses: 0, ship: undefined };
      cur.uses += 1;
      if (!cur.ship && p.ship) cur.ship = norm(p.ship).toLowerCase();
      pilotCounts.set(pid, cur);
    }
  }

  // Optional: map pilot xws → name using railway.IDs (same as your existing approach)
  const [nameRows] = await pool.query<any[]>(
    `SELECT xws, name FROM railway.IDs`
  );
  const nameMap = new Map<string, string>();
  for (const r of nameRows) {
    const xws = norm(r.xws);
    if (!xws) continue;
    nameMap.set(xws, norm(r.name) || xws);
  }

  const topPilots = Array.from(pilotCounts.entries())
    .map(([pilotId, agg]) => {
      const shipGlyph =
        agg.ship && SHIP_ICON_MAP[agg.ship] ? SHIP_ICON_MAP[agg.ship] : "·";
      return {
        pilotId,
        pilotName: nameMap.get(pilotId) ?? pilotId,
        uses: agg.uses,
        shipGlyph,
      };
    })
    .sort((a, b) => b.uses - a.uses)
    .slice(0, 3);

  return NextResponse.json({
    ncxid,
    minGames,
    totals: {
      games: matchRows.length,
    },
    bestScenario: best,
    worstScenario: worst,
    scenarios: scenarioRows,
    topPilots,
  });
}
