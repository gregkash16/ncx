// src/app/api/live-matchups/route.ts
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let ensured = false;

async function ensureTable() {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS S9.live_matchups (
      week_label VARCHAR(32) NOT NULL,
      game VARCHAR(16) NOT NULL,
      provider VARCHAR(32) NOT NULL,
      stream_name VARCHAR(255),
      stream_url TEXT NOT NULL,
      started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (week_label, game)
    )
  `);
  ensured = true;
}

async function purgeExpired() {
  await pool.query(
    `DELETE FROM S9.live_matchups WHERE started_at < NOW() - INTERVAL 2 HOUR`
  );
}

export async function GET(request: Request) {
  try {
    await ensureTable();
    await purgeExpired();

    const { searchParams } = new URL(request.url);
    const week = searchParams.get("week");

    const sql = week
      ? `SELECT week_label, game, provider, stream_name, stream_url, started_at
           FROM S9.live_matchups WHERE week_label = ?`
      : `SELECT week_label, game, provider, stream_name, stream_url, started_at
           FROM S9.live_matchups`;

    const [rows] = await pool.query<any[]>(sql, week ? [week] : []);

    const live = (rows ?? []).map((r: any) => ({
      weekLabel: String(r.week_label),
      game: String(r.game),
      provider: String(r.provider),
      streamName: r.stream_name != null ? String(r.stream_name) : null,
      streamUrl: String(r.stream_url),
      startedAt:
        r.started_at instanceof Date
          ? r.started_at.toISOString()
          : String(r.started_at),
    }));

    return NextResponse.json({ live });
  } catch (err: any) {
    console.error("GET /api/live-matchups error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureTable();

    const body = await request.json();
    const weekLabel = String(body?.weekLabel ?? "").trim();
    const game = String(body?.game ?? "").trim();
    const provider = String(body?.provider ?? "").trim();
    const streamName =
      body?.streamName != null ? String(body.streamName).trim() : null;
    const streamUrl = String(body?.streamUrl ?? "").trim();

    if (!weekLabel || !game || !provider || !streamUrl) {
      return NextResponse.json(
        { error: "Missing weekLabel, game, provider, or streamUrl" },
        { status: 400 }
      );
    }

    if (!/^https?:\/\//i.test(streamUrl)) {
      return NextResponse.json(
        { error: "streamUrl must start with http(s)://" },
        { status: 400 }
      );
    }

    await pool.query(
      `INSERT INTO S9.live_matchups
         (week_label, game, provider, stream_name, stream_url, started_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         provider = VALUES(provider),
         stream_name = VALUES(stream_name),
         stream_url = VALUES(stream_url),
         started_at = NOW()`,
      [weekLabel, game, provider, streamName, streamUrl]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("POST /api/live-matchups error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureTable();

    const { searchParams } = new URL(request.url);
    const weekLabel = searchParams.get("weekLabel");
    const game = searchParams.get("game");

    if (!weekLabel || !game) {
      return NextResponse.json(
        { error: "Missing weekLabel or game" },
        { status: 400 }
      );
    }

    await pool.query(
      `DELETE FROM S9.live_matchups WHERE week_label = ? AND game = ?`,
      [weekLabel, game]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("DELETE /api/live-matchups error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: 500 }
    );
  }
}
