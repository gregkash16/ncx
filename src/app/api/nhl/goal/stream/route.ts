// /src/app/api/nhl/goal/stream/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NHL_BASE = "https://api-web.nhle.com/v1";
const TEAM = "BUF";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getCurrentSabresGameId(): Promise<number | null> {
  const r = await fetch(`${NHL_BASE}/club-schedule/${TEAM}/week/now`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!r.ok) return null;
  const data = await r.json();

  const games: any[] =
    data?.games ?? data?.gameWeek?.flatMap((d: any) => d?.games ?? []) ?? [];

  const live = games.find((g) => ["LIVE", "CRIT"].includes(g?.gameState));
  if (live?.id) return Number(live.id);

  const upcoming = games.find((g) => g?.gameState === "FUT");
  if (upcoming?.id) return Number(upcoming.id);

  const notFinal = games.find((g) => g?.gameState && g.gameState !== "OFF");
  if (notFinal?.id) return Number(notFinal.id);

  return null;
}

type GoalEvent = {
  gameId: number;
  goalId: number | string;
  period?: number;
  timeInPeriod?: string;
  scorer?: string;
  strength?: string;
};

async function fetchLatestBufGoal(gameId: number): Promise<GoalEvent | null> {
  const r = await fetch(`${NHL_BASE}/gamecenter/${gameId}/play-by-play`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!r.ok) return null;

  const pbp = await r.json();
  const plays: any[] = pbp?.plays ?? pbp?.gameEvents ?? [];

  const bufGoals = plays.filter((p) => {
    const isGoal =
      p?.typeDescKey === "goal" ||
      p?.typeCode === "GOAL" ||
      p?.eventTypeId === "GOAL";
    const team =
      p?.details?.eventOwnerTeamAbbrev ??
      p?.teamAbbrev ??
      p?.details?.teamAbbrev;
    return isGoal && team === TEAM;
  });

  if (bufGoals.length === 0) return null;

  const last = bufGoals[bufGoals.length - 1];
  return {
    gameId,
    goalId:
      last?.eventId ??
      last?.id ??
      `${last?.periodDescriptor?.number}-${last?.timeInPeriod}`,
    period: last?.periodDescriptor?.number,
    timeInPeriod: last?.timeInPeriod,
    scorer:
      last?.details?.scoringPlayerName ??
      last?.details?.scorerPlayerName ??
      last?.details?.scoringPlayer?.name,
    strength: last?.details?.strength,
  };
}

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      let gameId: number | null = null;

      // Key behavior:
      // - On first successful check ("initialized"), we set baseline to current latest goal (if any)
      // - We DO NOT emit on connect/refresh
      // - After initialized, if a new goal appears, we emit it (including if no goal existed initially)
      let initialized = false;
      let lastSeenGoalKey: string | null = null;

      send("hello", { team: TEAM });

      while (true) {
        if ((req as any).signal?.aborted) break;

        try {
          if (!gameId) {
            gameId = await getCurrentSabresGameId();
            send("status", { gameId });
          }

          if (gameId) {
            const latest = await fetchLatestBufGoal(gameId);
            const key = latest ? `${latest.gameId}:${latest.goalId}` : null;

            if (!initialized) {
              // baseline on first successful poll (no emit)
              lastSeenGoalKey = key;
              initialized = true;
            } else {
              // after baseline, emit only on changes
              if (key && key !== lastSeenGoalKey) {
                send("goal", latest);
                lastSeenGoalKey = key;
              }
            }
          }
        } catch (e: any) {
          send("error", { message: e?.message ?? "unknown" });
        }

        await sleep(2500);
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}