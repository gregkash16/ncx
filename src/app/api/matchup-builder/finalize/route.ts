// POST /api/matchup-builder/finalize  —  Home captain finalizes, writes to Sheet, triggers seed
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getSheets } from "@/lib/googleSheets";
import { getCaptainTeams } from "@/lib/captains";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";

const ADMIN_DISCORD_IDS = ["349349801076195329", "986330724212801557"] as const;

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "").trim().replace(/[<@!>]/g, "").replace(/\D/g, "");
}
function teamKey(s: string): string { return String(s ?? "").trim().toUpperCase(); }

async function triggerSeed() {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const key = process.env.SEED_API_KEY;
  if (!key) throw new Error("Missing SEED_API_KEY");

  const url = `${baseUrl}/api/seed-mysql?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Seed failed: ${res.status} ${txt}`);
  }
}

export async function POST(req: NextRequest) {
  const conn = await pool.getConnection();
  try {
    const session = await getServerSession(authOptions);
    const sessionId = session?.user
      ? normalizeDiscordId((session.user as any).discordId ?? (session.user as any).id)
      : "";
    const headerRaw = (req.headers.get("x-discord-id") ?? "").trim();
    const isAppleAuth = headerRaw.startsWith("apple-") && process.env.DEMO_MODE === "true";
    const headerId = isAppleAuth ? "" : normalizeDiscordId(headerRaw);
    const discordId = sessionId || headerId;
    if (!discordId && !isAppleAuth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const isAdmin = isAppleAuth || (ADMIN_DISCORD_IDS as readonly string[]).includes(discordId);
    const captainTeams = await getCaptainTeams(discordId);

    const body = await req.json();
    const { week, awayTeam, homeTeam } = body;

    const isHomeCaptain = captainTeams.some((t) => teamKey(t) === teamKey(homeTeam));
    if (!isHomeCaptain && !isAdmin) {
      return NextResponse.json({ error: "Only home captain can finalize" }, { status: 403 });
    }

    await conn.beginTransaction();

    const [seriesRows] = await conn.query(
      "SELECT * FROM S9.matchup_draft_series WHERE week_label = ? AND away_team = ? AND home_team = ? FOR UPDATE",
      [week, awayTeam, homeTeam]
    );
    const series = (seriesRows as any[])[0];
    if (!series) { await conn.rollback(); return NextResponse.json({ error: "Draft not found" }, { status: 404 }); }
    if (series.finalized) { await conn.rollback(); return NextResponse.json({ error: "Already finalized" }, { status: 400 }); }

    // Verify all 7 slots are locked
    const [slotRows] = await conn.query(
      "SELECT * FROM S9.matchup_draft WHERE week_label = ? AND away_team = ? AND home_team = ? ORDER BY slot",
      [week, awayTeam, homeTeam]
    );
    const slots = slotRows as any[];
    const allLocked = slots.length === 7 && slots.every((s: any) => s.status === "locked");
    if (!allLocked) {
      await conn.rollback();
      return NextResponse.json({ error: "Not all slots are locked" }, { status: 400 });
    }

    // Find the 7 game numbers in weekly_matchups for this series
    const [gameRows] = await conn.query(
      `SELECT game FROM S9.weekly_matchups
       WHERE week_label = ? AND awayTeam = ? AND homeTeam = ?
       ORDER BY CAST(game AS UNSIGNED) ASC`,
      [week, awayTeam, homeTeam]
    );
    const games = (gameRows as any[]).map((r: any) => parseInt(r.game, 10));

    if (games.length !== 7) {
      await conn.rollback();
      return NextResponse.json(
        { error: `Expected 7 games in weekly_matchups, found ${games.length}` },
        { status: 500 }
      );
    }

    // Write to Google Sheet
    // Read the sheet to find actual row numbers by matching game number in column A
    const weekTab = week; // e.g. "WEEK 7"

    const sheets = getSheets();
    const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;

    const sheetRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${weekTab}!A2:A120`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const sheetRows = sheetRes.data.values ?? [];

    // Build a map: game number string -> sheet row number (1-indexed, A2 = row 2)
    const gameToRow: Record<string, number> = {};
    for (let i = 0; i < sheetRows.length; i++) {
      const cellVal = String(sheetRows[i]?.[0] ?? "").trim();
      if (cellVal) {
        gameToRow[cellVal] = i + 2; // i=0 is row 2 (A2)
      }
    }

    const batchData: { range: string; values: any[][] }[] = [];

    for (let i = 0; i < 7; i++) {
      const slot = slots[i];
      const gameNum = games[i];
      const rowNum = gameToRow[String(gameNum)];

      if (!rowNum) {
        console.error(`[finalize] Game ${gameNum} not found in sheet column A`);
        continue;
      }

      batchData.push(
        { range: `${weekTab}!B${rowNum}`, values: [[slot.away_ncxid]] },
        { range: `${weekTab}!J${rowNum}`, values: [[slot.home_ncxid]] },
      );
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: batchData,
      },
    });

    // Mark as finalized
    await conn.query(
      "UPDATE S9.matchup_draft_series SET finalized = 1, finalized_at = NOW() WHERE id = ?",
      [series.id]
    );

    await conn.commit();

    // Trigger seed sync (fire and forget, but log errors)
    try {
      await triggerSeed();
    } catch (seedErr) {
      console.error("[matchup-builder/finalize] Seed sync failed:", seedErr);
    }

    // Push notification — "Matchups for AWAY vs HOME have been set for WEEK X"
    try {
      const weekNum = week.replace(/^WEEK\s*/i, "");
      const teamsJson = JSON.stringify(
        [awayTeam, homeTeam].map((t: string) => (t ?? "").trim()).filter(Boolean)
      );

      await sql`
        CREATE TABLE IF NOT EXISTS fcm_subscriptions (
          device_token TEXT PRIMARY KEY,
          all_teams BOOLEAN DEFAULT TRUE,
          teams TEXT[] DEFAULT '{}'
        )
      `;

      const { rows: fcmRows } = await sql`
        SELECT device_token
        FROM fcm_subscriptions
        WHERE
          all_teams = TRUE
          OR EXISTS (
            SELECT 1
            FROM json_array_elements_text(${teamsJson}::json) j
            WHERE j = ANY(fcm_subscriptions.teams)
          )
      `;

      console.log(`[matchup-builder/finalize] FCM: found ${fcmRows.length} matching subscriptions`);

      if (fcmRows.length > 0) {
        const { sendFCMToDevices } = await import("@/lib/fcm");
        const result = await sendFCMToDevices(
          fcmRows.map((r) => r.device_token),
          {
            title: "Matchups Set",
            body: `Matchups for ${awayTeam} vs ${homeTeam} have been set for WEEK ${weekNum}`,
            url: "/",
          },
          {
            category: "matchup_builder",
            trigger: `matchup-builder/finalize: WEEK ${weekNum} ${awayTeam} vs ${homeTeam}`,
          }
        );
        console.log(`[matchup-builder/finalize] FCM: sent=${result.sent}, failed=${result.failed}`);
      } else {
        const { logPushNotification } = await import("@/lib/pushLog");
        await logPushNotification({
          category: "matchup_builder",
          title: "Matchups Set",
          body: `Matchups for ${awayTeam} vs ${homeTeam} have been set for WEEK ${weekNum}`,
          trigger: `matchup-builder/finalize: WEEK ${weekNum} ${awayTeam} vs ${homeTeam}`,
          recipientCount: 0,
          sent: 0,
          failed: 0,
        });
      }
    } catch (pushErr) {
      console.warn("[matchup-builder/finalize] Push notification failed:", pushErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    await conn.rollback();
    console.error("[matchup-builder/finalize]", err);
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 500 });
  } finally {
    conn.release();
  }
}
