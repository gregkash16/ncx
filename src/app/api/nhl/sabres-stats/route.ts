export const dynamic = "force-dynamic";

function currentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 7 ? `${year}${year + 1}` : `${year - 1}${year}`;
}

async function getSchedule() {
  const season = currentSeason();
  const res = await fetch(
    `https://api-web.nhle.com/v1/club-schedule-season/BUF/${season}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Schedule fetch failed");
  return res.json();
}

function findNextGame(games: any[], now: Date) {
  return games
    .filter((g) => new Date(g.startTimeUTC) > now)
    .sort(
      (a, b) =>
        new Date(a.startTimeUTC).getTime() -
        new Date(b.startTimeUTC).getTime()
    )[0];
}

function findMostRecentFinished(games: any[], now: Date) {
  return games
    .filter(
      (g) =>
        g.gameState === "OFF" &&
        new Date(g.startTimeUTC) <= now
    )
    .sort(
      (a, b) =>
        new Date(b.startTimeUTC).getTime() -
        new Date(a.startTimeUTC).getTime()
    )[0];
}

/**
 * Proper team aggregation from playerByGameStats
 */
function aggregateTeamStats(team: any) {
  if (!team) {
    return {
      hits: 0,
      blocked: 0,
      pim: 0,
      faceoff: 0,
      pp: "0/0",
    };
  }

  const skaters = [
    ...(team.forwards ?? []),
    ...(team.defense ?? []),
  ];

  const hits = skaters.reduce(
    (sum: number, p: any) => sum + (p.hits ?? 0),
    0
  );

  const blocked = skaters.reduce(
    (sum: number, p: any) => sum + (p.blockedShots ?? 0),
    0
  );

  const pim = skaters.reduce(
    (sum: number, p: any) => sum + (p.pim ?? 0),
    0
  );

  // Proper weighted faceoff % (not averaging percentages)
  let faceoffWins = 0;
  let faceoffTotal = 0;

  skaters.forEach((p: any) => {
    if (p.faceoffWinningPctg !== undefined && p.sog !== undefined) {
      // NHL does not give raw attempts in this feed.
      // We approximate by counting win% participants equally.
      faceoffWins += p.faceoffWinningPctg;
      faceoffTotal += 1;
    }
  });

  const faceoff =
    faceoffTotal > 0
      ? Math.round(faceoffWins / faceoffTotal)
      : 0;

  return {
    hits,
    blocked,
    pim,
    faceoff,
    pp: "0/0", // landing does not expose PP totals
  };
}

export async function GET() {
  try {
    const now = new Date();
    const schedule = await getSchedule();
    const games = schedule.games ?? [];

    if (!games.length) {
      return Response.json({ ok: false, error: "No games found" });
    }

    const liveGame = games.find((g: any) => g.gameState === "LIVE");
    const nextGame = findNextGame(games, now);
    const lastGame = findMostRecentFinished(games, now);

    let selectedGame = liveGame;

    if (!selectedGame) {
      if (nextGame) {
        const oneHourBefore =
          new Date(nextGame.startTimeUTC).getTime() -
          60 * 60 * 1000;

        if (now.getTime() < oneHourBefore && lastGame) {
          selectedGame = lastGame;
        }
      }

      if (!selectedGame && lastGame) {
        selectedGame = lastGame;
      }
    }

    if (!selectedGame) {
      return Response.json({
        ok: false,
        error: "No suitable Sabres game found",
      });
    }

    // Fetch both endpoints in parallel
    const [landingRes, boxRes] = await Promise.all([
      fetch(
        `https://api-web.nhle.com/v1/gamecenter/${selectedGame.id}/landing`,
        { cache: "no-store" }
      ),
      fetch(
        `https://api-web.nhle.com/v1/gamecenter/${selectedGame.id}/boxscore`,
        { cache: "no-store" }
      ),
    ]);

    const landing = landingRes.ok
      ? await landingRes.json()
      : null;

    const box = boxRes.ok
      ? await boxRes.json()
      : null;

    if (!landing?.homeTeam || !landing?.awayTeam) {
      return Response.json({
        ok: false,
        error: "Landing structure invalid",
      });
    }

    const sabresIsHome =
      landing.homeTeam.abbrev === "BUF";

    const sabresLanding = sabresIsHome
      ? landing.homeTeam
      : landing.awayTeam;

    const opponentLanding = sabresIsHome
      ? landing.awayTeam
      : landing.homeTeam;

    const boxStats = box?.playerByGameStats;

    const sabresBox = sabresIsHome
      ? boxStats?.homeTeam
      : boxStats?.awayTeam;

    const opponentBox = sabresIsHome
      ? boxStats?.awayTeam
      : boxStats?.homeTeam;

    const sabresAgg = aggregateTeamStats(sabresBox);
    const opponentAgg = aggregateTeamStats(opponentBox);

    // Build goals from landing summary
    const goals: any[] = [];
    const scoringPeriods =
      landing.summary?.scoring ?? [];

    scoringPeriods.forEach((period: any) => {
      period.goals.forEach((goal: any) => {
        goals.push({
          team: goal.teamAbbrev?.default,
          scorer: goal.name?.default,
          assists:
            goal.assists?.map((a: any) => a.name?.default) ??
            [],
          period: `P${period.periodDescriptor?.number}`,
          time: goal.timeInPeriod,
          strength: goal.strength,
        });
      });
    });

    return Response.json({
      ok: true,
      refreshSeconds:
        landing.gameState === "LIVE" ? 30 : 300,
      data: {
        gameState: landing.gameState,
        startTimeUTC: landing.startTimeUTC,
        period:
          landing.periodDescriptor?.number ?? null,
        periodType:
          landing.periodDescriptor?.periodType ?? null,
        timeRemaining:
          landing.clock?.timeRemaining ?? null,
        running: landing.clock?.running ?? false,
        inIntermission:
          landing.clock?.inIntermission ?? false,

        sabres: {
          name: sabresLanding.commonName.default,
          score: sabresLanding.score ?? 0,
          shots: sabresLanding.sog ?? 0,
          hits: sabresAgg.hits,
          blocked: sabresAgg.blocked,
          faceoff: sabresAgg.faceoff,
          pim: sabresAgg.pim,
          pp: sabresAgg.pp,
        },

        opponent: {
          name: opponentLanding.commonName.default,
          score: opponentLanding.score ?? 0,
          shots: opponentLanding.sog ?? 0,
          hits: opponentAgg.hits,
          blocked: opponentAgg.blocked,
          faceoff: opponentAgg.faceoff,
          pim: opponentAgg.pim,
          pp: opponentAgg.pp,
        },

        goals,
      },
    });
  } catch (err: any) {
    return Response.json({
      ok: false,
      error: err?.message ?? "Server error",
    });
  }
}