// src/app/api/tts/report/route.ts
// Unadvertised report endpoint used by the TTS Reporter object.
// Accepts { game, awayPts, homePts, scenario, week?, awayList?, homeList?,
//          awayShipPts?, awayObjPts?, homeShipPts?, homeObjPts?, round? },
// looks up the sheet rowIndex from MySQL, then internally invokes the existing
// /api/report-game POST handler so all downstream side effects (Google Sheet
// write, FCM push, Discord webhook, series-clinch, live-matchups auto-clear)
// still fire as if a captain reported from the website.
// Split-point fields and round are logged to S9.adv_stats_t6 for later analysis
// but not forwarded to /api/report-game.
//
// No auth — TTS scripts are visible to anyone with the mod so a shared secret
// buys nothing. Endpoint is unadvertised; we trust players to report honestly.

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

async function readBody(
  request: NextRequest
): Promise<Record<string, string>> {
  // Accept JSON, url-encoded form, or multipart form — TTS's WebRequest.post
  // sends a url-encoded form by default.
  const ctype = (request.headers.get("content-type") || "").toLowerCase();
  try {
    if (ctype.includes("application/json")) {
      const j = await request.json();
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(j ?? {})) out[k] = String(v ?? "");
      return out;
    }
    // formData() handles both application/x-www-form-urlencoded and multipart.
    const fd = await request.formData();
    const out: Record<string, string> = {};
    fd.forEach((v, k) => {
      out[k] = typeof v === "string" ? v : "";
    });
    return out;
  } catch {
    // Last-ditch: read body text and try JSON.parse (some TTS builds send
    // the JSON string with no Content-Type header).
    try {
      const text = await request.text();
      if (text) {
        const j = JSON.parse(text);
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(j ?? {})) out[k] = String(v ?? "");
        return out;
      }
    } catch {
      /* ignore */
    }
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    const gameRaw = norm(body?.game);
    const awayPts = Number(body?.awayPts);
    const homePts = Number(body?.homePts);
    const scenario = norm(body?.scenario).toUpperCase();
    const weekRaw = norm(body?.week);
    const awayList = norm(body?.awayList);
    const homeList = norm(body?.homeList);
    const awayShipPts = Number(body?.awayShipPts) || 0;
    const awayObjPts = Number(body?.awayObjPts) || 0;
    const homeShipPts = Number(body?.homeShipPts) || 0;
    const homeObjPts = Number(body?.homeObjPts) || 0;
    const round = Number(body?.round) || 0;

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
        awayList,
        homeList,
        force: true,
      }),
    });

    const res = await reportGamePost(forwardReq);
    const forwarded = await res.json().catch(() => ({}));

    // Log to adv_stats_t6 only when every field is populated — round started,
    // both list URLs provided, and both sides have non-zero split points.
    // Partial data isn't useful for later analysis. Wrapped in try/catch so
    // any DB hiccup can't break the primary report flow above.
    const allFieldsFilled =
      round > 0 &&
      awayList !== "" &&
      homeList !== "" &&
      awayShipPts + awayObjPts > 0 &&
      homeShipPts + homeObjPts > 0;
    if (allFieldsFilled) {
      try {
        await pool.query(
          `INSERT INTO S9.adv_stats_t6
             (week_label, game, row_index, scenario, round,
              away_pts, home_pts,
              away_ship_pts, away_obj_pts,
              home_ship_pts, home_obj_pts,
              away_list, home_list)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            weekLabel, gameRaw, rowIndex, scenario, round,
            awayPts, homePts,
            awayShipPts, awayObjPts,
            homeShipPts, homeObjPts,
            awayList, homeList,
          ]
        );
      } catch (logErr: any) {
        console.error("adv_stats_t6 insert failed:", logErr?.message);
      }
    }

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
