// src/app/api/report-game/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSheets } from "@/lib/googleSheets";
import { sql } from "@vercel/postgres";
import webpush from "web-push";

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "").trim().replace(/[<@!>]/g, "").replace(/\D/g, "");
}
function norm(v: unknown) {
  return String(v ?? "").trim();
}

type LookupResult =
  | {
      ok: true;
      weekTab: string;
      rowIndex: number;
      game: string;
      away: {
        id: string;
        name: string;
        team: string;
        wins: string;
        losses: string;
        pts: string;
        plms: string;
      };
      home: {
        id: string;
        name: string;
        team: string;
        wins: string;
        losses: string;
        pts: string;
        plms: string;
      };
      scenario: string;
      alreadyFilled: boolean;
    }
  | { ok: false; reason: string };

/* -------------------- Push helpers -------------------- */
let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  const subject = process.env.VAPID_MAILTO || "mailto:noreply@nickelcityxwing.com";
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error("Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars.");
  webpush.setVapidDetails(subject, pub, priv);
  vapidReady = true;
}

async function sendPushToAll(payload: { title: string; body: string; url: string }) {
  ensureVapid();
  const { rows } = await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions`;
  const subs = rows.map((r) => ({
    endpoint: r.endpoint,
    keys: { p256dh: r.p256dh, auth: r.auth },
  }));
  const msg = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s as any, msg);
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
        }
      }
    })
  );

  return subs.length;
}

// Filtered push sender — only notifies users who selected these teams
async function sendPushForTeams(teams: string[], payload: { title: string; body: string; url: string }) {
  ensureVapid();

  const teamsJson = JSON.stringify(
    teams.map((t) => (t ?? "").trim()).filter(Boolean)
  );

  const { rows } = await sql`
    SELECT endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE
      all_teams = TRUE
      OR EXISTS (
        SELECT 1
        FROM json_array_elements_text(${teamsJson}::json) j
        WHERE j = ANY(push_subscriptions.teams)
      )
  `;

  const subs = rows.map((r) => ({
    endpoint: r.endpoint,
    keys: { p256dh: r.p256dh, auth: r.auth },
  }));

  const msg = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s as any, msg);
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
        }
      }
    })
  );

  return subs.length;
}
/* ------------------------------------------------------ */

async function getNcxIdForDiscord(
  sheets: ReturnType<typeof getSheets>,
  spreadsheetId: string,
  discordId: string
) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Discord_ID!A:D",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = res.data.values ?? [];
  const hit = rows.find((r) => normalizeDiscordId(r?.[3]) === discordId);
  if (!hit) return null;

  return { ncxid: hit[0] ?? "", first: hit[1] ?? "", last: hit[2] ?? "" };
}

// ---------- GET /api/report-game ----------
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json<LookupResult>({ ok: false, reason: "NOT_AUTH" }, { status: 401 });
    }

    const raw = (session.user as any).discordId ?? (session.user as any).id;
    const discordId = normalizeDiscordId(raw);
    if (!discordId) {
      return NextResponse.json<LookupResult>({ ok: false, reason: "NO_DISCORD_ID" }, { status: 400 });
    }

    const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
    const sheets = getSheets();

    // 1) Find player by Discord
    const who = await getNcxIdForDiscord(sheets, spreadsheetId, discordId);
    if (!who?.ncxid) {
      return NextResponse.json<LookupResult>({ ok: false, reason: "NO_NCXID" }, { status: 404 });
    }

    // 2) Active week
    const weekRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "SCHEDULE!U2",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const weekTab = norm(weekRes.data.values?.[0]?.[0]) || "WEEK 1";

    // 3) Week rows
    const dataRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${weekTab}!A2:Q120`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = dataRes.data.values ?? [];

    // 4) Find user’s row(s)
    const candidates = rows
      .map((r, i) => {
        const rowIndex = i + 2; // header consumed
        const game = norm(r?.[0]);
        const awayId = norm(r?.[1]);
        const homeId = norm(r?.[9]);
        const awayPts = norm(r?.[6]);
        const homePts = norm(r?.[14]);
        const scenario = norm(r?.[16]);

        const isMine =
          awayId.toUpperCase() === who.ncxid.toUpperCase() ||
          homeId.toUpperCase() === who.ncxid.toUpperCase();

        const unreported = awayPts === "" && homePts === "" && scenario === "";

        return { isMine, unreported, row: r, rowIndex, game };
      })
      .filter((x) => x.isMine);

    if (candidates.length === 0) {
      return NextResponse.json<LookupResult>({ ok: false, reason: "NO_GAME_FOUND" }, { status: 404 });
    }

    const chosen = candidates.find((c) => c.unreported) ?? candidates[0];
    const r = chosen.row;

    const payload: LookupResult = {
      ok: true,
      weekTab,
      rowIndex: chosen.rowIndex,
      game: norm(r?.[0]),
      away: {
        id: norm(r?.[1]),
        name: norm(r?.[2]),
        team: norm(r?.[3]),
        wins: norm(r?.[4]),
        losses: norm(r?.[5]),
        pts: norm(r?.[6]),
        plms: norm(r?.[7]),
      },
      home: {
        id: norm(r?.[9]),
        name: norm(r?.[10]),
        team: norm(r?.[11]),
        wins: norm(r?.[12]),
        losses: norm(r?.[13]),
        pts: norm(r?.[14]),
        plms: norm(r?.[15]),
      },
      scenario: norm(r?.[16]),
      alreadyFilled: !(
        norm(r?.[6]) === "" && norm(r?.[14]) === "" && norm(r?.[16]) === ""
      ),
    };

    return NextResponse.json(payload);
  } catch (e) {
    console.error("💥 Lookup error:", e);
    return NextResponse.json<LookupResult>(
      { ok: false, reason: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

// ---------- POST /api/report-game ----------
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, reason: "NOT_AUTH" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { rowIndex, awayPts, homePts, scenario, force } = body ?? {};
    const cleanScenario = String(scenario ?? "").toUpperCase();

    const validScenarios = ["ANCIENT", "CHANCE", "ASSAULT", "SCRAMBLE", "SALVAGE"];
    if (!validScenarios.includes(cleanScenario)) {
      return NextResponse.json({ ok: false, reason: "BAD_SCENARIO" }, { status: 400 });
    }

    const a = Number(awayPts);
    const h = Number(homePts);
    if (!Number.isFinite(a) || !Number.isFinite(h)) {
      return NextResponse.json({ ok: false, reason: "BAD_SCORES" }, { status: 400 });
    }

    const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
    const sheets = getSheets();

    const raw = (session.user as any).discordId ?? (session.user as any).id;
    const discordId = normalizeDiscordId(raw);
    const who = await getNcxIdForDiscord(sheets, spreadsheetId, discordId);
    if (!who?.ncxid) {
      return NextResponse.json({ ok: false, reason: "NO_NCXID" }, { status: 404 });
    }

    // Active week
    const weekRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "SCHEDULE!U2",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const weekTab = norm(weekRes.data.values?.[0]?.[0]) || "WEEK 1";

    // Confirm the row belongs to this player
    const rowNum = Number(rowIndex);
    const rowRange = `${weekTab}!A${rowNum}:Q${rowNum}`;
    const rowRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rowRange,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const row = rowRes.data.values?.[0] ?? [];

    const awayId = norm(row?.[1]);
    const homeId = norm(row?.[9]);
    const mine = [awayId.toUpperCase(), homeId.toUpperCase()].includes(who.ncxid.toUpperCase());
    if (!mine) {
      return NextResponse.json({ ok: false, reason: "ROW_NOT_YOURS" }, { status: 403 });
    }

    const curAway = norm(row?.[6]);
    const curHome = norm(row?.[14]);
    const curScen = norm(row?.[16]);
    const alreadyFilled = !(curAway === "" && curHome === "" && curScen === "");
    if (alreadyFilled && !force) {
      return NextResponse.json(
        { ok: false, reason: "ALREADY_FILLED", current: { awayPts: curAway, homePts: curHome, scenario: curScen } },
        { status: 409 }
      );
    }

    // Write: numbers as numbers, scenario as text
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: `${weekTab}!G${rowNum}`, values: [[a]] }, // Away score
          { range: `${weekTab}!O${rowNum}`, values: [[h]] }, // Home score
          { range: `${weekTab}!Q${rowNum}`, values: [[cleanScenario]] }, // Scenario
        ],
      },
    });

    // Optional: enforce number formatting
    try {
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const weekSheet = spreadsheet.data.sheets?.find((s) => s.properties?.title === weekTab);
      const sheetId = weekSheet?.properties?.sheetId;

      if (sheetId != null) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: { sheetId, startRowIndex: rowNum - 1, endRowIndex: rowNum, startColumnIndex: 6, endColumnIndex: 7 },
                  cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "0" } } },
                  fields: "userEnteredFormat.numberFormat",
                },
              },
              {
                repeatCell: {
                  range: { sheetId, startRowIndex: rowNum - 1, endRowIndex: rowNum, startColumnIndex: 14, endColumnIndex: 15 },
                  cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "0" } } },
                  fields: "userEnteredFormat.numberFormat",
                },
              },
            ],
          },
        });
      }
    } catch (fmtErr) {
      console.warn("⚠️ Formatting skipped/failed:", fmtErr);
    }

    // ---- Streamer.bot overlay push (mirrors Discord bot) ----
    try {
      const sbUrl = process.env.STREAMERBOT_URL;
      const sbActionId = process.env.STREAMERBOT_ACTION_ID;

      if (sbUrl && sbActionId) {
        const awayName  = norm(row?.[2]);   // C: Away player name
        const awayTeam  = norm(row?.[3]);   // D: Away team
        const homeName  = norm(row?.[10]);  // K: Home player name
        const homeTeam  = norm(row?.[11]);  // L: Home team

        const payload = {
          action: { id: sbActionId, name: "Score Update" },
          args: {
            away: `${awayName} - ${awayTeam} - ${a}`,
            home: `${homeName} - ${homeTeam} - ${h}`,
          },
        };

        await fetch(sbUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        console.warn("Streamer.bot env not set; skipping overlay call.");
      }
    } catch (e) {
      console.warn("⚠️ Streamer.bot overlay call failed:", e);
    }

    // Optional Discord webhook
    const webhook = process.env.DISCORD_WEBHOOK_URL;
    if (webhook) {
      const gameNo = norm(row?.[0]);
      const awayName = norm(row?.[2]);
      const awayTeam = norm(row?.[3]);
      const homeName = norm(row?.[10]);
      const homeTeam = norm(row?.[11]);
      const mention = `<@${discordId}>`;

      const content =
        `✅ **Game Reported**\n` +
        `**Week:** ${weekTab}\n` +
        `**Game #:** ${gameNo}\n` +
        `**Away:** ${awayTeam} • ${awayName} — ${a}\n` +
        `**Home:** ${homeTeam} • ${homeName} — ${h}\n` +
        `**Scenario:** ${cleanScenario}\n` +
        `**By:** ${mention} (${who.ncxid} - ${who.first} ${who.last})`;

      try {
        await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
      } catch (e) {
        console.warn("⚠️ Webhook post failed:", e);
      }
    }

    // ---- Push: title = Game #, body = Teams + score ----
    let pushed = 0;
    try {
      const gameNo   = norm(row?.[0]);   // e.g., "12"
      const awayName = norm(row?.[2]);
      const awayTeam = norm(row?.[3]);   // team (not faction)
      const homeName = norm(row?.[10]);
      const homeTeam = norm(row?.[11]);  // team (not faction)

      const title    = `Game ${gameNo}`;
      const bodyText = `${awayName} - ${awayTeam} ${a} — ${h} ${homeTeam} - ${homeName}`;
      const url      = `/matchups?game=${encodeURIComponent(gameNo)}`;

      // Filtered push by selected teams
      pushed = await sendPushForTeams([awayTeam, homeTeam], { title, body: bodyText, url });
    } catch (pushErr) {
      console.warn("⚠️ Push send failed:", pushErr);
    }

    return NextResponse.json({ ok: true, pushed });
  } catch (e) {
    console.error("💥 Report POST error:", e);
    return NextResponse.json({ ok: false, reason: "SERVER_ERROR" }, { status: 500 });
  }
}
