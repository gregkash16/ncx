/**
 * Mobile push notification endpoint
 * Handles Expo push tokens
 */

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS mobile_push_tokens (
      token      TEXT PRIMARY KEY,
      all_teams  BOOLEAN DEFAULT TRUE,
      teams      TEXT[]  DEFAULT '{}'::text[],
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

export async function POST(req: Request) {
  try {
    await ensureTable();

    const { token, prefs } = await req.json();

    if (!token) {
      return NextResponse.json(
        { ok: false, reason: "MISSING_TOKEN" },
        { status: 400 }
      );
    }

    const allTeams: boolean = !!prefs?.allTeams;
    const teams: string[] = Array.isArray(prefs?.teams) ? prefs.teams : [];
    const teamsJson = JSON.stringify(teams);

    await sql`
      INSERT INTO mobile_push_tokens (token, all_teams, teams)
      VALUES (
        ${token},
        ${allTeams},
        ARRAY(SELECT json_array_elements_text(${teamsJson}::json))
      )
      ON CONFLICT (token) DO UPDATE SET
        all_teams = EXCLUDED.all_teams,
        teams = EXCLUDED.teams,
        updated_at = CURRENT_TIMESTAMP
    `;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[mobile/push]", e);
    return NextResponse.json(
      { ok: false, reason: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureTable();

    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { ok: false, reason: "MISSING_TOKEN" },
        { status: 400 }
      );
    }

    await sql`DELETE FROM mobile_push_tokens WHERE token = ${token}`;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[mobile/push]", e);
    return NextResponse.json(
      { ok: false, reason: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
