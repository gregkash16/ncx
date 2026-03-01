export const dynamic = "force-dynamic";

function currentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 7 ? `${year}${year + 1}` : `${year - 1}${year}`;
}

export async function GET() {
  const season = currentSeason();

  const scheduleRes = await fetch(
    `https://api-web.nhle.com/v1/club-schedule-season/BUF/${season}`,
    { cache: "no-store" }
  );

  const schedule = await scheduleRes.json();
  const games = schedule.games ?? [];

  const liveGame =
    games.find((g: any) => g.gameState === "LIVE") ??
    games[0];

  if (!liveGame) {
    return Response.json({ error: "No game found" });
  }

  const res = await fetch(
    `https://api-web.nhle.com/v1/gamecenter/${liveGame.id}/boxscore`,
    { cache: "no-store" }
  );

  const json = await res.json();

  return Response.json({
    gameId: liveGame.id,
    gameState: liveGame.gameState,
    response: json,
  });
}