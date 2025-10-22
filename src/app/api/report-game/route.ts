// src/app/api/report-game/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSheets } from "@/lib/googleSheets";

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
  | {
      ok: false;
      reason: string;
    };

async function getNcxIdForDiscord(
  sheets: ReturnType<typeof getSheets>,
  spreadsheetId: string,
  discordId: string
) {
  console.log("🔍 Looking up NCXID for Discord ID:", discordId);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Discord_ID!A:D",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = res.data.values ?? [];
  console.log("📋 Discord_ID rows:", rows.length);

  const hit = rows.find((r) => normalizeDiscordId(r?.[3]) === discordId);
  if (!hit) {
    console.log("⚠️ No Discord match found in Discord_ID sheet.");
    return null;
  }

  const result = { ncxid: hit[0] ?? "", first: hit[1] ?? "", last: hit[2] ?? "" };
  console.log("✅ Found NCXID:", result);
  return result;
}

// ---------- GET /api/report-game ----------
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    console.log("👤 Session User:", session?.user);

    if (!session?.user) {
      console.log("⚠️ No session user found (not logged in)");
      return NextResponse.json<LookupResult>({ ok: false, reason: "NOT_AUTH" }, { status: 401 });
    }

    const raw = (session.user as any).discordId ?? (session.user as any).id;
    const discordId = normalizeDiscordId(raw);
    console.log("🆔 Normalized Discord ID:", discordId);

    if (!discordId) {
      console.log("❌ No valid Discord ID found in session");
      return NextResponse.json<LookupResult>({ ok: false, reason: "NO_DISCORD_ID" }, { status: 400 });
    }

    const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
    const sheets = getSheets();

    // 1️⃣ Get NCXID for this Discord
    const who = await getNcxIdForDiscord(sheets, spreadsheetId, discordId);
    if (!who?.ncxid) {
      console.log("⚠️ No NCXID found for this Discord user");
      return NextResponse.json<LookupResult>({ ok: false, reason: "NO_NCXID" }, { status: 404 });
    }

    console.log("✅ Player NCXID:", who.ncxid);

    // 2️⃣ Find active week
    const weekRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "SCHEDULE!U2",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const weekTab = norm(weekRes.data.values?.[0]?.[0]) || "WEEK 1";
    console.log("🗓️ Active Week Tab:", weekTab);

    // 3️⃣ Pull that week's matchups
    const dataRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${weekTab}!A2:Q120`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = dataRes.data.values ?? [];
    console.log("📊 Loaded week rows:", rows.length);

    // 4️⃣ Try to find a match row for this NCXID
    const candidates = rows
      .map((r, i) => {
        const rowIndex = i + 2;
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

        if (isMine) {
          console.log(
            `🎯 Found possible match row ${rowIndex}: Game ${game}, Away=${awayId}, Home=${homeId}, Scenario=${scenario}`
          );
        }

        return { isMine, unreported, row: r, rowIndex, game };
      })
      .filter((x) => x.isMine);

    if (candidates.length === 0) {
      console.log("❌ No game found for NCXID:", who.ncxid);
      return NextResponse.json<LookupResult>({ ok: false, reason: "NO_GAME_FOUND" }, { status: 404 });
    }

    const chosen = candidates.find((c) => c.unreported) ?? candidates[0];
    const r = chosen.row;

    console.log("✅ Selected row index:", chosen.rowIndex, "Game:", chosen.game);

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
    if (isNaN(Number(awayPts)) || isNaN(Number(homePts))) {
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

    // Find week tab again
    const weekRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "SCHEDULE!U2",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const weekTab = norm(weekRes.data.values?.[0]?.[0]) || "WEEK 1";

    // Confirm row belongs to this player
    const rowRange = `${weekTab}!A${rowIndex}:Q${rowIndex}`;
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
        {
          ok: false,
          reason: "ALREADY_FILLED",
          current: { awayPts: curAway, homePts: curHome, scenario: curScen },
        },
        { status: 409 }
      );
    }

    // Write new values
    const updates = [
      { range: `${weekTab}!G${rowIndex}`, values: [[String(awayPts)]] },
      { range: `${weekTab}!O${rowIndex}`, values: [[String(homePts)]] },
      { range: `${weekTab}!Q${rowIndex}`, values: [[cleanScenario]] },
    ];

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: updates,
      },
    });

    // Optional webhook
    const webhook = process.env.DISCORD_WEBHOOK_URL;
    if (webhook) {
      const gameNo = norm(row?.[0]);
      const awayName = norm(row?.[2]);
      const awayTeam = norm(row?.[3]);
      const homeName = norm(row?.[10]);
      const homeTeam = norm(row?.[11]);

      const discordId = normalizeDiscordId(raw); // you already have this variable above
        const mention = `<@${discordId}>`;

        const content =
        `✅ **Game Reported**\n` +
        `**Week:** ${weekTab}\n` +
        `**Game #:** ${gameNo}\n` +
        `**Away:** ${awayTeam} • ${awayName} — ${awayPts}\n` +
        `**Home:** ${homeTeam} • ${homeName} — ${homePts}\n` +
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

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("💥 Report POST error:", e);
    return NextResponse.json({ ok: false, reason: "SERVER_ERROR" }, { status: 500 });
  }
}
