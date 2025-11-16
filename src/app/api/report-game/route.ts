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

const ADMIN_DISCORD_ID = "349349801076195329" as const;

type Role = "player" | "captain" | "admin";

type GameRow = {
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
  isMyGame: boolean;
  canEditAwayId: boolean;
  canEditHomeId: boolean;
};

type LookupResult =
  | {
      ok: true;
      weekTab: string;
      role: Role;
      games: GameRow[];
    }
  | { ok: false; reason: string };

/* ------------------------- Push helpers ------------------------- */
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
async function sendPushForTeams(
  teams: string[],
  payload: { title: string; body: string; url: string }
) {
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
/* --------------------------------------------------------------- */

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

/**
 * Captain lookup from NCXID!K2:O25
 * K = team name, O = captain Discord ID
 */
async function getCaptainTeamsForDiscord(
  sheets: ReturnType<typeof getSheets>,
  spreadsheetId: string,
  discordId: string
): Promise<string[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "NCXID!K2:O25",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = res.data.values ?? [];
  const teams: string[] = [];

  for (const r of rows) {
    const team = norm(r?.[0]); // K
    const disc = normalizeDiscordId(r?.[4]); // O (K..O => index 4)
    if (team && disc === discordId) {
      teams.push(team);
    }
  }
  return teams;
}

function teamKey(s: string): string {
  return String(s ?? "").trim().toUpperCase();
}

/**
 * Decide role for this Discord ID.
 * - Admin: hard-coded
 * - Captain: appears in NCXID!K2:O25
 * - Player: has an NCXID mapping
 */
function resolveRole(
  discordId: string,
  who: { ncxid: string; first: string; last: string } | null,
  captainTeams: string[]
): Role | null {
  if (discordId === ADMIN_DISCORD_ID) return "admin";
  if (captainTeams.length > 0) return "captain";
  if (who?.ncxid) return "player";
  return null;
}

/* --------------------------- GET /report-game ------------------------- */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json<LookupResult>({ ok: false, reason: "NOT_AUTH" }, { status: 401 });
    }

    const raw = (session.user as any).discordId ?? (session.user as any).id;
    const discordId = normalizeDiscordId(raw);
    if (!discordId) {
      return NextResponse.json<LookupResult>(
        { ok: false, reason: "NO_DISCORD_ID" },
        { status: 400 }
      );
    }

    const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
    const sheets = getSheets();

    const [who, captainTeams] = await Promise.all([
      getNcxIdForDiscord(sheets, spreadsheetId, discordId),
      getCaptainTeamsForDiscord(sheets, spreadsheetId, discordId),
    ]);

    const role = resolveRole(discordId, who, captainTeams);
    if (!role) {
      // No admin, no captain entry, no NCXID map
      return NextResponse.json<LookupResult>(
        { ok: false, reason: "NO_NCXID" },
        { status: 404 }
      );
    }

    const myNcxid = (who?.ncxid ?? "").toUpperCase();
    const captainTeamKeys = captainTeams.map(teamKey);

    // 1) Active week
    const weekRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "SCHEDULE!U2",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const weekTab = norm(weekRes.data.values?.[0]?.[0]) || "WEEK 1";

    // 2) Week rows
    const dataRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${weekTab}!A2:Q120`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = dataRes.data.values ?? [];

    const games: GameRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowIndex = i + 2; // header consumed

    const gameCell = norm(r?.[0]); // A
    const awayId = norm(r?.[1]); // B
    const awayName = norm(r?.[2]); // C
    const awayTeam = norm(r?.[3]); // D
    const awayW = norm(r?.[4]); // E
    const awayL = norm(r?.[5]); // F
    const awayPts = norm(r?.[6]); // G
    const awayPlms = norm(r?.[7]); // H
    const homeId = norm(r?.[9]); // J
    const homeName = norm(r?.[10]); // K
    const homeTeam = norm(r?.[11]); // L
    const homeW = norm(r?.[12]); // M
    const homeL = norm(r?.[13]); // N
    const homePts = norm(r?.[14]); // O
    const homePlms = norm(r?.[15]); // P
    const scenario = norm(r?.[16]); // Q

    // 🔹 Only keep rows where Game is a real number (e.g. "1", "12")
    const gameNumber = parseInt(gameCell, 10);
    const hasNumericGame =
      Number.isFinite(gameNumber) && gameCell.trim() !== "";

    if (!hasNumericGame || (!awayTeam && !homeTeam)) continue;

    // Use the numeric string as the canonical game value
    const game = String(gameNumber);


    if (!game || (!awayTeam && !homeTeam)) continue;


      const alreadyFilled = !(awayPts === "" && homePts === "" && scenario === "");

      const awayIdU = awayId.toUpperCase();
      const homeIdU = homeId.toUpperCase();
      const isMyGame =
        !!myNcxid && (awayIdU === myNcxid || homeIdU === myNcxid);

      const awayTeamKey = teamKey(awayTeam);
      const homeTeamKey = teamKey(homeTeam);

      const canEditAwayId =
        role === "admin" ||
        (role === "captain" && captainTeamKeys.includes(awayTeamKey));
      const canEditHomeId =
        role === "admin" ||
        (role === "captain" && captainTeamKeys.includes(homeTeamKey));

      // Determine if THIS row is manageable for this role
      let canManage = false;
      if (role === "admin") {
        canManage = true;
      } else if (role === "captain") {
        const onMyTeam =
          captainTeamKeys.includes(awayTeamKey) ||
          captainTeamKeys.includes(homeTeamKey);
        canManage = onMyTeam || isMyGame;
      } else {
        // player
        canManage = isMyGame;
      }

      if (!canManage) continue;

      games.push({
        rowIndex,
        game,
        away: {
          id: awayId,
          name: awayName,
          team: awayTeam,
          wins: awayW,
          losses: awayL,
          pts: awayPts,
          plms: awayPlms,
        },
        home: {
          id: homeId,
          name: homeName,
          team: homeTeam,
          wins: homeW,
          losses: homeL,
          pts: homePts,
          plms: homePlms,
        },
        scenario,
        alreadyFilled,
        isMyGame,
        canEditAwayId,
        canEditHomeId,
      });
    }

    if (games.length === 0) {
      return NextResponse.json<LookupResult>(
        { ok: false, reason: "NO_GAME_FOUND" },
        { status: 404 }
      );
    }

    // Sort: my own game(s) first, then by game number
    const sortedGames = [...games].sort((a, b) => {
      const myDiff = (b.isMyGame ? 1 : 0) - (a.isMyGame ? 1 : 0);
      if (myDiff !== 0) return myDiff;
      const ga = parseInt(a.game, 10);
      const gb = parseInt(b.game, 10);
      if (Number.isFinite(ga) && Number.isFinite(gb)) return ga - gb;
      return a.game.localeCompare(b.game);
    });

    const payload: LookupResult = {
      ok: true,
      weekTab,
      role,
      games: sortedGames,
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

/* --------------------------- POST /report-game ------------------------ */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, reason: "NOT_AUTH" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      rowIndex,
      awayPts,
      homePts,
      scenario,
      force,
      newAwayId,
      newHomeId,
    } = body ?? {};

    const cleanScenario = String(scenario ?? "").toUpperCase();
    const hasScoreInputs =
      awayPts !== undefined &&
      homePts !== undefined &&
      cleanScenario.trim() !== "";

    // If scores are being provided, validate them + scenario
    let a: number | undefined;
    let h: number | undefined;
    if (hasScoreInputs) {
      const validScenarios = ["ANCIENT", "CHANCE", "ASSAULT", "SCRAMBLE", "SALVAGE"];
      if (!validScenarios.includes(cleanScenario)) {
        return NextResponse.json(
          { ok: false, reason: "BAD_SCENARIO" },
          { status: 400 }
        );
      }

      a = Number(awayPts);
      h = Number(homePts);
      if (!Number.isFinite(a) || !Number.isFinite(h)) {
        return NextResponse.json(
          { ok: false, reason: "BAD_SCORES" },
          { status: 400 }
        );
      }
    }

    const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
    const sheets = getSheets();

    const raw = (session.user as any).discordId ?? (session.user as any).id;
    const discordId = normalizeDiscordId(raw);

    const [who, captainTeams] = await Promise.all([
      getNcxIdForDiscord(sheets, spreadsheetId, discordId),
      getCaptainTeamsForDiscord(sheets, spreadsheetId, discordId),
    ]);

    const role = resolveRole(discordId, who, captainTeams);
    if (!role) {
      return NextResponse.json(
        { ok: false, reason: "NO_NCXID" },
        { status: 404 }
      );
    }
    const myNcxid = (who?.ncxid ?? "").toUpperCase();
    const captainTeamKeys = captainTeams.map(teamKey);

    // Active week
    const weekRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "SCHEDULE!U2",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const weekTab = norm(weekRes.data.values?.[0]?.[0]) || "WEEK 1";

    // Confirm the row exists
    const rowNum = Number(rowIndex);
    const rowRange = `${weekTab}!A${rowNum}:Q${rowNum}`;
    const rowRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rowRange,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const row = rowRes.data.values?.[0] ?? [];

    const gameNo = norm(row?.[0]); // A
    const awayId = norm(row?.[1]); // B
    const awayName = norm(row?.[2]); // C
    const awayTeam = norm(row?.[3]); // D
    const homeId = norm(row?.[9]); // J
    const homeName = norm(row?.[10]); // K
    const homeTeam = norm(row?.[11]); // L

    const awayTeamKey = teamKey(awayTeam);
    const homeTeamKey = teamKey(homeTeam);

    // Permission: who is allowed to report this row?
    let canReport = false;
    if (role === "admin") {
      canReport = true;
    } else if (role === "captain") {
      const onMyTeam =
        captainTeamKeys.includes(awayTeamKey) ||
        captainTeamKeys.includes(homeTeamKey);
      const awayIdU = awayId.toUpperCase();
      const homeIdU = homeId.toUpperCase();
      const isMyGame =
        !!myNcxid && (awayIdU === myNcxid || homeIdU === myNcxid);
      canReport = onMyTeam || isMyGame;
    } else {
      // player
      const awayIdU = awayId.toUpperCase();
      const homeIdU = homeId.toUpperCase();
      canReport =
        !!myNcxid && (awayIdU === myNcxid || homeIdU === myNcxid);
    }

    if (!canReport) {
      return NextResponse.json(
        { ok: false, reason: "ROW_NOT_YOURS" },
        { status: 403 }
      );
    }

    const curAway = norm(row?.[6]);
    const curHome = norm(row?.[14]);
    const curScen = norm(row?.[16]);
    const alreadyFilled = !(curAway === "" && curHome === "" && curScen === "");
    if (alreadyFilled && !force) {
      return NextResponse.json(
        {
          ok: false,
          reason: "ALREADY_FILLED",
          current: { awayPts: curAway, homePts: curHome, scenario: curScen },
        },
        { status: 409 }
      );
    }

    // Build batch updates
    const batchData: { range: string; values: any[][] }[] = [];

    // Scores + scenario (if provided)
    if (hasScoreInputs && a !== undefined && h !== undefined) {
      batchData.push(
        { range: `${weekTab}!G${rowNum}`, values: [[a]] }, // Away score
        { range: `${weekTab}!O${rowNum}`, values: [[h]] }, // Home score
        { range: `${weekTab}!Q${rowNum}`, values: [[cleanScenario]] } // Scenario
      );
    }

    // NCXID updates (captain/admin only, depending on side)
    const newAwayIdStr =
      typeof newAwayId === "string" ? newAwayId.trim() : undefined;
    const newHomeIdStr =
      typeof newHomeId === "string" ? newHomeId.trim() : undefined;

    const canEditAwayId =
      role === "admin" ||
      (role === "captain" && captainTeamKeys.includes(awayTeamKey));
    const canEditHomeId =
      role === "admin" ||
      (role === "captain" && captainTeamKeys.includes(homeTeamKey));

    if (newAwayIdStr !== undefined && canEditAwayId && newAwayIdStr !== awayId) {
      batchData.push({
        range: `${weekTab}!B${rowNum}`,
        values: [[newAwayIdStr]],
      });
    }

    if (newHomeIdStr !== undefined && canEditHomeId && newHomeIdStr !== homeId) {
      batchData.push({
        range: `${weekTab}!J${rowNum}`,
        values: [[newHomeIdStr]],
      });
    }

    // If nothing actually changed, just say OK
    if (batchData.length === 0) {
      return NextResponse.json({ ok: true, pushed: 0 });
    }

    // Write all changes
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: batchData,
      },
    });

    // Optional: enforce number formatting for scores (if we touched them)
    if (hasScoreInputs) {
      try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const weekSheet = spreadsheet.data.sheets?.find(
          (s) => s.properties?.title === weekTab
        );
        const sheetId = weekSheet?.properties?.sheetId;

        if (sheetId != null) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  repeatCell: {
                    range: {
                      sheetId,
                      startRowIndex: rowNum - 1,
                      endRowIndex: rowNum,
                      startColumnIndex: 6,
                      endColumnIndex: 7,
                    },
                    cell: {
                      userEnteredFormat: {
                        numberFormat: { type: "NUMBER", pattern: "0" },
                      },
                    },
                    fields: "userEnteredFormat.numberFormat",
                  },
                },
                {
                  repeatCell: {
                    range: {
                      sheetId,
                      startRowIndex: rowNum - 1,
                      endRowIndex: rowNum,
                      startColumnIndex: 14,
                      endColumnIndex: 15,
                    },
                    cell: {
                      userEnteredFormat: {
                        numberFormat: { type: "NUMBER", pattern: "0" },
                      },
                    },
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
    }

    // ---- Streamer.bot overlay + Discord + push only if scores were updated ----
    let pushed = 0;

    if (hasScoreInputs && a !== undefined && h !== undefined) {
      // Streamer.bot overlay push (mirrors Discord bot)
      try {
        const sbUrl = process.env.STREAMERBOT_URL;
        const sbActionId = process.env.STREAMERBOT_ACTION_ID;

        if (sbUrl && sbActionId) {
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

      // Discord webhook
      const webhook = process.env.DISCORD_WEBHOOK_URL;
      if (webhook) {
        const mention = `<@${discordId}>`;
        const content =
          `✅ **Game Reported**\n` +
          `**Week:** ${weekTab}\n` +
          `**Game #:** ${gameNo}\n` +
          `**Away:** ${awayTeam} • ${awayName} — ${a}\n` +
          `**Home:** ${homeTeam} • ${homeName} — ${h}\n` +
          `**Scenario:** ${cleanScenario}\n` +
          `**By:** ${mention} (${who?.ncxid ?? ""} - ${who?.first ?? ""} ${
            who?.last ?? ""
          })`;

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

      // Push notifications (filtered by teams)
      try {
        const title = `Game ${gameNo}`;
        const bodyText = `${awayName} - ${awayTeam} ${a} — ${h} ${homeTeam} - ${homeName}`;
        const url = `/matchups?game=${encodeURIComponent(gameNo)}`;

        pushed = await sendPushForTeams([awayTeam, homeTeam], {
          title,
          body: bodyText,
          url,
        });
      } catch (pushErr) {
        console.warn("⚠️ Push send failed:", pushErr);
      }
    }

    return NextResponse.json({ ok: true, pushed });
  } catch (e) {
    console.error("💥 Report POST error:", e);
    return NextResponse.json(
      { ok: false, reason: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
