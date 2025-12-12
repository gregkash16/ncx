// src/app/api/match-capsule/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type MatchRow = {
  game?: string;
  awayName?: string; // PLAYER
  homeName?: string; // PLAYER
  awayTeam?: string; // TEAM
  homeTeam?: string; // TEAM
  awayPts?: string | number;
  homePts?: string | number;
  awayPLMS?: string | number;
  homePLMS?: string | number;
  scenario?: string;
};

type IndRow = {
  wins?: string | number;   // PLAYER record (per your current usage)
  losses?: string | number; // PLAYER record
  winPct?: string | number;
  sos?: string | number;
  potato?: string | number;
};

type TeamRecord = {
  wins?: string | number;   // TEAM record (optional if you wire it later)
  losses?: string | number; // TEAM record
};

type ListMeta = {
  // Only include if known.
  awayCount?: number | null;
  homeCount?: number | null;
  awayAverageInit?: number | null;
  homeAverageInit?: number | null;

  // Explicit “submitted” flags so the model never assumes.
  awayListSubmitted?: boolean | null;
  homeListSubmitted?: boolean | null;
};

function s(v: unknown) {
  return String(v ?? "").trim();
}
function n(v: unknown): number | null {
  const num = Number(String(v ?? "").trim());
  return Number.isFinite(num) ? num : null;
}

function rec(w?: any, l?: any): string | null {
  if (w == null || l == null) return null;
  const ws = s(w);
  const ls = s(l);
  if (!ws || !ls) return null;
  return `${ws}-${ls}`;
}

export async function POST(req: Request) {
  try {
    const enabled = process.env.NEXT_PUBLIC_MATCH_CAPSULES_AI === "1";
    if (!enabled) {
      return NextResponse.json(
        { error: "AI capsules are disabled." },
        { status: 403 }
      );
    }

    const apiKey = process.env.OPEN_AI_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Missing API key. Set OPEN_AI_KEY (or OPENAI_API_KEY) in your server env.",
        },
        { status: 500 }
      );
    }

    const body = (await req.json()) as {
      weekLabel?: string;
      row: MatchRow;

      // Player-season stats (current behavior in your panel)
      awaySeason?: IndRow | null;
      homeSeason?: IndRow | null;

      // Optional team records (wire later if you want)
      awayTeamRecord?: TeamRecord | null;
      homeTeamRecord?: TeamRecord | null;

      listMeta?: ListMeta | null;
      tone?: "neutral" | "buster";
    };

    if (!body?.row) {
      return NextResponse.json({ error: "Missing row." }, { status: 400 });
    }

    const row = body.row;
    const scenario = s(row.scenario);
    const isDone = Boolean(scenario);

    if (!isDone) {
      return NextResponse.json(
        { text: "No report yet — capsule not available." },
        { status: 200 }
      );
    }

    // Strongly separated labels
    const awayPlayer = s(row.awayName) || "Away Player";
    const homePlayer = s(row.homeName) || "Home Player";
    const awayTeam = s(row.awayTeam) || "Away Team";
    const homeTeam = s(row.homeTeam) || "Home Team";

    const awayPts = n(row.awayPts);
    const homePts = n(row.homePts);
    const awayPLMS = n(row.awayPLMS);
    const homePLMS = n(row.homePLMS);

    const awayPlayerRec = rec(body.awaySeason?.wins, body.awaySeason?.losses);
    const homePlayerRec = rec(body.homeSeason?.wins, body.homeSeason?.losses);

    const awayTeamRec = rec(
      body.awayTeamRecord?.wins,
      body.awayTeamRecord?.losses
    );
    const homeTeamRec = rec(
      body.homeTeamRecord?.wins,
      body.homeTeamRecord?.losses
    );

    const listMeta = body.listMeta ?? null;

    // IMPORTANT: only surface list/ships facts if explicitly known
    const awayListSubmitted =
      listMeta?.awayListSubmitted ?? (listMeta?.awayCount != null ? true : null);
    const homeListSubmitted =
      listMeta?.homeListSubmitted ?? (listMeta?.homeCount != null ? true : null);

    const tone = body.tone ?? "neutral";
    const style =
      tone === "buster"
        ? "Dry, sports-noir voice. Deadpan. Never rude. 2–3 sentences."
        : "Neutral sports recap voice. 2–3 sentences.";

    // Build facts with explicit labels so it can't confuse team vs player
    const factsLines = [
      `Week: ${s(body.weekLabel) || "—"}`,
      `Game: ${s(row.game) || "—"}`,
      `Scenario: ${scenario}`,
      `Away player: ${awayPlayer}`,
      `Away team: ${awayTeam}`,
      `Home player: ${homePlayer}`,
      `Home team: ${homeTeam}`,
      `Final score (away–home): ${awayPts ?? "—"}–${homePts ?? "—"}`,
      `PL/MS (away vs home): ${awayPLMS ?? "—"} vs ${homePLMS ?? "—"}`,
      `Player season records (away vs home): ${awayPlayerRec ?? "—"} vs ${homePlayerRec ?? "—"}`,
      `Team records (away vs home): ${awayTeamRec ?? "—"} vs ${homeTeamRec ?? "—"}`,
      `Lists submitted (away/home): ${awayListSubmitted == null ? "—" : awayListSubmitted ? "yes" : "no"} / ${homeListSubmitted == null ? "—" : homeListSubmitted ? "yes" : "no"}`,
      `Ship counts (away/home): ${listMeta?.awayCount ?? "—"} / ${listMeta?.homeCount ?? "—"}`,
      `Avg initiative (away/home): ${listMeta?.awayAverageInit ?? "—"} / ${listMeta?.homeAverageInit ?? "—"}`,
    ];

    const input = [
      `Write a VERY BRIEF matchup capsule.`,
      ``,
      `Hard rules (must follow):`,
      `- 2–3 sentences total.`,
      `- Use ONLY the FACTS below.`,
      `- DO NOT guess ships, list contents, maneuvers, dice, or “key moments”.`,
      `- DO NOT infer ship count from missing lists. If Ship counts are "—", do not mention ships at all.`,
      `- Always format as: "<Away player> of <Away team> ..." and "<Home player> of <Home team> ..." (player first, then team).`,
      `- If records are "—", omit them. Do not invent updated records.`,
      `- Describe the game margin only from the final score (close/nail-biter vs runaway).`,
      `- No emojis.`,
      ``,
      `Style: ${style}`,
      ``,
      `FACTS`,
      ...factsLines,
    ].join("\n");

    const client = new OpenAI({ apiKey });

    const resp = await client.responses.create({
      model: "gpt-4o-mini",
      input,
      temperature: 0.2,
      max_output_tokens: 120,
    });

    const text = (resp.output_text || "").trim();
    return NextResponse.json({ text: text || "No capsule generated." });
  } catch (err: any) {
    console.error("match-capsule error:", err);
    return NextResponse.json(
      { error: "Failed to generate capsule." },
      { status: 500 }
    );
  }
}
