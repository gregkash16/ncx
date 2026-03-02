import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      ...(init?.headers ?? {}),
    },
  });
}

function aggregateTeamStats(team: any) {
  if (!team) {
    return { hits: 0, blocked: 0, pim: 0 };
  }

  const skaters = [...(team.forwards ?? []), ...(team.defense ?? [])];

  const hits = skaters.reduce((s: number, p: any) => s + (p.hits ?? 0), 0);
  const blocked = skaters.reduce(
    (s: number, p: any) => s + (p.blockedShots ?? 0),
    0
  );
  const pim = skaters.reduce((s: number, p: any) => s + (p.pim ?? 0), 0);

  return { hits, blocked, pim };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get("gameId") || "";

  if (!/^\d+$/.test(gameId)) {
    return json({ ok: false, error: "Missing or invalid gameId" }, { status: 400 });
  }

  const landingUrl = `https://api-web.nhle.com/v1/gamecenter/${gameId}/landing`;
  const boxUrl = `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`;

  try {
    const [landingRes, boxRes] = await Promise.all([
      fetch(landingUrl, { cache: "no-store" }),
      fetch(boxUrl, { cache: "no-store" }),
    ]);

    const landing = landingRes.ok ? await landingRes.json() : null;
    const box = boxRes.ok ? await boxRes.json() : null;

    if (!landing?.homeTeam || !landing?.awayTeam) {
      return json(
        {
          ok: false,
          error: "Landing structure invalid",
          landingStatus: landingRes.status,
          boxStatus: boxRes.status,
        },
        { status: 502 }
      );
    }

    const home = landing.homeTeam;
    const away = landing.awayTeam;

    const boxStats = box?.playerByGameStats;
    const homeBox = boxStats?.homeTeam;
    const awayBox = boxStats?.awayTeam;

    const homeAgg = aggregateTeamStats(homeBox);
    const awayAgg = aggregateTeamStats(awayBox);

    const goals: any[] = [];
    const scoringPeriods = landing.summary?.scoring ?? [];

    scoringPeriods.forEach((period: any) => {
      (period.goals ?? []).forEach((goal: any) => {
        goals.push({
          team: goal.teamAbbrev?.default ?? null,
          scorer: goal.name?.default ?? null,
          assists: goal.assists?.map((a: any) => a.name?.default) ?? [],
          period: `P${period.periodDescriptor?.number ?? ""}`,
          time: goal.timeInPeriod ?? null,
          strength: goal.strength ?? null,
        });
      });
    });

    return json({
      ok: true,
      refreshSeconds: landing.gameState === "LIVE" ? 30 : 300,
      data: {
        gameId: Number(gameId),
        gameState: landing.gameState,
        startTimeUTC: landing.startTimeUTC,
        period: landing.periodDescriptor?.number ?? null,
        periodType: landing.periodDescriptor?.periodType ?? null,
        timeRemaining: landing.clock?.timeRemaining ?? null,
        running: landing.clock?.running ?? false,
        inIntermission: landing.clock?.inIntermission ?? false,

        home: {
          abbrev: home.abbrev ?? null,
          name:
            home.commonName?.default ??
            home.name?.default ??
            home.abbrev ??
            "HOME",
          score: home.score ?? 0,
          shots: home.sog ?? 0,
          hits: homeAgg.hits,
          blocked: homeAgg.blocked,
          pim: homeAgg.pim,
          logo: home.logo ?? null,
        },

        away: {
          abbrev: away.abbrev ?? null,
          name:
            away.commonName?.default ??
            away.name?.default ??
            away.abbrev ??
            "AWAY",
          score: away.score ?? 0,
          shots: away.sog ?? 0,
          hits: awayAgg.hits,
          blocked: awayAgg.blocked,
          pim: awayAgg.pim,
          logo: away.logo ?? null,
        },

        goals,
      },
    });
  } catch (err) {
    return json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}