// src/app/api/push/apns-save/route.ts
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS apns_subscriptions (
      device_token TEXT PRIMARY KEY,
      all_teams    BOOLEAN DEFAULT TRUE,
      teams        TEXT[] DEFAULT '{}'::text[]
    )
  `;
}

export async function GET(req: Request) {
  try {
    await ensureTable();

    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { prefs: { allTeams: true, teams: [] } },
        { status: 400 }
      );
    }

    const result = await sql`
      SELECT all_teams, teams FROM apns_subscriptions WHERE device_token = ${token}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ prefs: { allTeams: true, teams: [] } });
    }

    const row = result.rows[0];
    return NextResponse.json({
      prefs: {
        allTeams: !!row.all_teams,
        teams: Array.isArray(row.teams) ? row.teams : [],
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTable();

    const { deviceToken, prefs } = await req.json();

    if (!deviceToken) {
      return NextResponse.json(
        { ok: false, reason: "MISSING_TOKEN" },
        { status: 400 }
      );
    }

    const allTeams: boolean = !!prefs?.allTeams;
    const teams: string[] = Array.isArray(prefs?.teams) ? prefs.teams : [];
    const teamsJson = JSON.stringify(teams);

    await sql`
      INSERT INTO apns_subscriptions (device_token, all_teams, teams)
      VALUES (
        ${deviceToken},
        ${allTeams},
        ARRAY(SELECT json_array_elements_text(${teamsJson}::json))
      )
      ON CONFLICT (device_token) DO UPDATE SET
        all_teams = EXCLUDED.all_teams,
        teams = ARRAY(SELECT json_array_elements_text(${teamsJson}::json))
    `;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, reason: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureTable();

    let deviceToken: string | undefined;
    try {
      const body = await req.json();
      deviceToken = body?.deviceToken;
    } catch {
      /* ignore parse errors */
    }
    if (!deviceToken) {
      const url = new URL(req.url);
      deviceToken = url.searchParams.get("token") ?? undefined;
    }

    if (deviceToken) {
      await sql`DELETE FROM apns_subscriptions WHERE device_token = ${deviceToken}`;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, reason: "SERVER_ERROR" }, { status: 500 });
  }
}
