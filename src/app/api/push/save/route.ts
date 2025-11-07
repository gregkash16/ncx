// src/app/api/push/save/route.ts
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint  TEXT PRIMARY KEY,
      p256dh    TEXT NOT NULL,
      auth      TEXT NOT NULL,
      all_teams BOOLEAN DEFAULT TRUE,
      teams     TEXT[]   DEFAULT '{}'::text[]
    )
  `;
}

export async function GET() {
  try {
    await ensureTable();
    // Without user<->endpoint mapping, return a neutral default.
    return NextResponse.json({ prefs: { allTeams: true, teams: [] } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTable();

    const { subscription, prefs } = await req.json();
    const endpoint: string | undefined = subscription?.endpoint;
    const p256dh: string | undefined = subscription?.keys?.p256dh;
    const auth: string | undefined   = subscription?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ ok: false, reason: "BAD_SUB" }, { status: 400 });
    }

    const allTeams: boolean = !!prefs?.allTeams;
    const teams: string[]   = Array.isArray(prefs?.teams) ? prefs.teams : [];

    // Pass the array as JSON, convert to text[] in SQL:
    const teamsJson = JSON.stringify(teams);

    await sql`
      INSERT INTO push_subscriptions (endpoint, p256dh, auth, all_teams, teams)
      VALUES (
        ${endpoint},
        ${p256dh},
        ${auth},
        ${allTeams},
        ARRAY(SELECT json_array_elements_text(${teamsJson}::json))
      )
      ON CONFLICT (endpoint) DO UPDATE SET
        p256dh    = EXCLUDED.p256dh,
        auth      = EXCLUDED.auth,
        all_teams = EXCLUDED.all_teams,
        teams     = ARRAY(SELECT json_array_elements_text(${teamsJson}::json))
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

    // Optional: allow deleting a specific endpoint via body or query
    let endpoint: string | undefined;
    try {
      const body = await req.json();
      endpoint = body?.endpoint;
    } catch {
      /* ignore parse errors */
    }
    if (!endpoint) {
      const url = new URL(req.url);
      endpoint = url.searchParams.get("endpoint") ?? undefined;
    }

    if (endpoint) {
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, reason: "SERVER_ERROR" }, { status: 500 });
  }
}
