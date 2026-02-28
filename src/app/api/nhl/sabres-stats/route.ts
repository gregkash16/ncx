export const dynamic = "force-dynamic";

function currentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 7 ? `${year}${year + 1}` : `${year - 1}${year}`;
}

function safeName(obj: any) {
  return (
    obj?.team?.name?.default ||
    obj?.name?.default ||
    obj?.team?.commonName?.default ||
    obj?.commonName?.default ||
    obj?.abbrev ||
    "Unknown"
  );
}

function statValue(team: any, key: string) {
  if (!Array.isArray(team?.teamStats)) return 0;
  const found = team.teamStats.find(
    (s: any) => s.category === key
  );
  return found?.value ?? 0;
}

export async function GET() {
  try {
    const season = currentSeason();

    const res = await fetch(
      `https://api-web.nhle.com/v1/club-schedule-season/BUF/${season}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      return Response.json({ ok: false, error: "Schedule fetch failed" });
    }

    const schedule = await res.json();
    const games = schedule.games ?? [];

    if (!games.length) {
      return Response.json({ ok: false, error: "No games found" });
    }

    const now = new Date();

    let game =
      games.find((g: any) => g.gameState === "LIVE") ||
      games.find((g: any) => {
        const d = new Date(g.startTimeUTC);
        return d.toDateString() === now.toDateString();
      }) ||
      [...games]
        .filter((g: any) => g.gameState === "OFF")
        .sort(
          (a: any, b: any) =>
            new Date(b.startTimeUTC).getTime() -
            new Date(a.startTimeUTC).getTime()
        )[0];

    if (!game) {
      return Response.json({
        ok: false,
        error: "No suitable Sabres game found",
      });
    }

    const gameRes = await fetch(
      `https://api-web.nhle.com/v1/gamecenter/${game.id}/play-by-play`,
      { cache: "no-store" }
    );

    if (!gameRes.ok) {
      return Response.json({
        ok: false,
        error: "Gamecenter fetch failed",
      });
    }

    const gameData = await gameRes.json();

    if (!gameData.boxscore) {
      const sabresIsHome = game.homeTeam?.abbrev === "BUF";
      const sabresTeam = sabresIsHome
        ? game.homeTeam
        : game.awayTeam;
      const opponentTeam = sabresIsHome
        ? game.awayTeam
        : game.homeTeam;

      return Response.json({
        ok: true,
        data: {
          sabres: {
            name: safeName(sabresTeam),
            score: sabresTeam?.score ?? 0,
            shots: 0,
            hits: 0,
            blocked: 0,
            faceoff: 0,
            pim: 0,
            pp: "0/0",
          },
          opponent: {
            name: safeName(opponentTeam),
            score: opponentTeam?.score ?? 0,
            shots: 0,
            hits: 0,
            blocked: 0,
            faceoff: 0,
            pim: 0,
            pp: "0/0",
          },
          goals: [],
        },
      });
    }

    const home = gameData.boxscore.teams.home;
    const away = gameData.boxscore.teams.away;

    const sabresIsHome = home?.team?.abbrev === "BUF";
    const sabres = sabresIsHome ? home : away;
    const opponent = sabresIsHome ? away : home;

    const goals = (gameData.goals ?? []).map((g: any) => ({
      team: g.teamAbbrev,
      scorer: g.scoringPlayerName,
      assists: [
        g.assist1PlayerName,
        g.assist2PlayerName,
      ].filter(Boolean),
      period: `P${g.periodDescriptor?.number ?? ""}`,
      time: g.timeInPeriod,
      strength: g.strength,
    }));

    return Response.json({
      ok: true,
      data: {
        sabres: {
          name: safeName(sabres),
          score: sabres?.score ?? 0,
          shots: statValue(sabres, "sog"),
          hits: statValue(sabres, "hits"),
          blocked: statValue(sabres, "blockedShots"),
          faceoff: statValue(sabres, "faceoffWinningPctg"),
          pim: statValue(sabres, "pim"),
          pp: `${sabres?.powerPlay?.goals ?? 0}/${sabres?.powerPlay?.opportunities ?? 0}`,
        },
        opponent: {
          name: safeName(opponent),
          score: opponent?.score ?? 0,
          shots: statValue(opponent, "sog"),
          hits: statValue(opponent, "hits"),
          blocked: statValue(opponent, "blockedShots"),
          faceoff: statValue(opponent, "faceoffWinningPctg"),
          pim: statValue(opponent, "pim"),
          pp: `${opponent?.powerPlay?.goals ?? 0}/${opponent?.powerPlay?.opportunities ?? 0}`,
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