// src/app/api/tts/report/route.ts
// Unadvertised report endpoint used by the TTS Reporter object.
// Accepts { game, awayPts, homePts, scenario, week? } keyed by shared secret,
// looks up the sheet rowIndex from MySQL, then internally invokes the existing
// /api/report-game POST handler so all downstream side effects (Google Sheet
// write, FCM push, Discord webhook, series-clinch, live-matchups auto-clear)
// still fire exactly as if a captain reported from the website.

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { POST as reportGamePost } from "@/app/api/report-game/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_SPOOF_DISCORD_ID = "349349801076195329"; // gregkash — always admin

function norm(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeWeekLabel(label: string): string {
  const s = (label ?? "").trim();
  if (!s) return "";
  const m1 = s.match(/week\s*(\d+)/i);
  if (m1) return `WEEK ${parseInt(m1[1], 10)}`;
  const num = Number(s);
  if (Number.isInteger(num) && num > 0) return `WEEK ${num}`;
  return s.toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.TTS_REPORTER_SECRET;
    if (!secret) {
      return NextResponse.json(
        { ok: false, reason: "NOT_CONFIGURED" },
        { status: 500 }
      );
    }
    if (request.headers.get("x-tts-secret") !== secret) {
      return NextResponse.json(
        { ok: false, reason: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const gameRaw = norm(body?.game);
    const awayPts = Number(body?.awayPts);
    const homePts = Number(body?.homePts);
    const scenario = norm(body?.scenario).toUpperCase();
    const weekRaw = norm(body?.week);

    if (!gameRaw) {
      return NextResponse.json(
        { ok: false, reason: "MISSING_GAME" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(awayPts) || !Number.isFinite(homePts)) {
      return NextResponse.json(
        { ok: false, reason: "BAD_SCORES" },
        { status: 400 }
      );
    }
    const valid = ["ANCIENT", "CHANCE", "ASSAULT", "SCRAMBLE", "SALVAGE"];
    if (!valid.includes(scenario)) {
      return NextResponse.json(
        { ok: false, reason: "BAD_SCENARIO" },
        { status: 400 }
      );
    }

    let weekLabel = normalizeWeekLabel(weekRaw);
    if (!weekLabel) {
      const [cw] = await pool.query<any[]>(
        "SELECT week_label FROM S9.current_week LIMIT 1"
      );
      weekLabel = norm(cw?.[0]?.week_label) || "WEEK 1";
    }

    const [rows] = await pool.query<any[]>(
      `SELECT row_index FROM S9.weekly_matchups
        WHERE week_label = ? AND game = ? LIMIT 1`,
      [weekLabel, gameRaw]
    );
    const rowIndex =
      Array.isArray(rows) && rows.length > 0
        ? Number(rows[0]?.row_index) || 0
        : 0;
    if (!rowIndex) {
      return NextResponse.json(
        { ok: false, reason: "NO_ROW", weekLabel, game: gameRaw },
        { status: 404 }
      );
    }

    // Forward to /api/report-game POST as a synthetic admin request.
    // The handler reads rowIndex + scenario + scores and handles everything
    // downstream. force=true overwrites any prior report for the same row.
    const forwardUrl = new URL("/api/report-game", request.url);
    const forwardReq = new NextRequest(forwardUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-discord-id": ADMIN_SPOOF_DISCORD_ID,
      },
      body: JSON.stringify({
        rowIndex,
        awayPts,
        homePts,
        scenario,
        force: true,
      }),
    });

    const res = await reportGamePost(forwardReq);
    const forwarded = await res.json().catch(() => ({}));
    return NextResponse.json(
      { ok: res.ok, upstream: forwarded, weekLabel, game: gameRaw, rowIndex },
      { status: res.status }
    );
  } catch (err: any) {
    console.error("POST /api/tts/report error:", err);
    return NextResponse.json(
      { ok: false, reason: "SERVER_ERROR", message: err?.message },
      { status: 500 }
    );
  }
}
