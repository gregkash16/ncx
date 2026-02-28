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

    const gameId = game.id;

    const gameRes = await fetch(
      `https://api-web.nhle.com/v1/gamecenter/${gameId}/play-by-play`,
      { cache: "no-store" }
    );

    if (!gameRes.ok) {
      return Response.json({
        ok: false,
        error: "Gamecenter fetch failed",
      });
    }

    const gameData = await gameRes.json();

    // Pregame fallback
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
            faceoff: 0,
            pp: "0/0",
            pim: 0,
            blocked: 0,
          },
          opponent: {
            name: safeName(opponentTeam),
            score: opponentTeam?.score ?? 0,
            shots: 0,
            hits: 0,
            faceoff: 0,
            pp: "0/0",
            pim: 0,
            blocked: 0,
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
          shots: sabres?.teamStats?.sog ?? 0,
          hits: sabres?.teamStats?.hits ?? 0,
          faceoff:
            sabres?.teamStats?.faceoffWinningPctg ?? 0,
          pp: `${sabres?.powerPlay?.goals ?? 0}/${sabres?.powerPlay?.opportunities ?? 0}`,
          pim: sabres?.teamStats?.pim ?? 0,
          blocked:
            sabres?.teamStats?.blockedShots ?? 0,
        },
        opponent: {
          name: safeName(opponent),
          score: opponent?.score ?? 0,
          shots: opponent?.teamStats?.sog ?? 0,
          hits: opponent?.teamStats?.hits ?? 0,
          faceoff:
            opponent?.teamStats?.faceoffWinningPctg ??
            0,
          pp: `${opponent?.powerPlay?.goals ?? 0}/${opponent?.powerPlay?.opportunities ?? 0}`,
          pim: opponent?.teamStats?.pim ?? 0,
          blocked:
            opponent?.teamStats?.blockedShots ?? 0,
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