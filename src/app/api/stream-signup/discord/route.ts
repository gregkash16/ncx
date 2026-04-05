import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getSheets } from "@/lib/googleSheets";

const ADMIN_DISCORD_IDS = ["349349801076195329", "986330724212801557"];
const SPREADSHEET_ID = "1x4_rfPq-fPnJ2IT6WbNzBxVmomqU36fU24pnKuPaObw";
const DISCORD_CHANNEL_ID = "1143366394466013184";
const BOT_TOKEN = process.env.CL4W_BOT_TOKEN ?? "";

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/[<@!>]/g, "")
    .replace(/\D/g, "");
}

function isAdmin(discordId: string): boolean {
  return ADMIN_DISCORD_IDS.includes(discordId);
}

async function getSetupWeek(): Promise<string> {
  try {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "SCHEDULE!J3",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const raw = String(res.data.values?.[0]?.[0] ?? "").trim();
    if (!raw) return "WEEK 1";
    if (/^\d+$/.test(raw)) return `WEEK ${raw}`;
    return raw.toUpperCase();
  } catch {
    const [weekRows] = await pool.query<any[]>(
      `SELECT week_label FROM S9.current_week LIMIT 1`
    );
    return weekRows?.[0]?.week_label || "WEEK 1";
  }
}

async function discordFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return res;
}

async function clearChannel() {
  // Fetch messages in batches and bulk delete
  let hasMore = true;
  while (hasMore) {
    const res = await discordFetch(
      `/channels/${DISCORD_CHANNEL_ID}/messages?limit=100`
    );
    if (!res.ok) break;
    const messages = await res.json();
    if (!messages || messages.length === 0) {
      hasMore = false;
      break;
    }

    // Bulk delete only works for messages < 14 days old
    const messageIds = messages.map((m: any) => m.id);

    if (messageIds.length === 1) {
      await discordFetch(
        `/channels/${DISCORD_CHANNEL_ID}/messages/${messageIds[0]}`,
        { method: "DELETE" }
      );
    } else if (messageIds.length > 1) {
      await discordFetch(
        `/channels/${DISCORD_CHANNEL_ID}/messages/bulk-delete`,
        {
          method: "POST",
          body: JSON.stringify({ messages: messageIds }),
        }
      );
    }

    if (messages.length < 100) hasMore = false;

    // Small delay to respect rate limits
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function postMessage(content: string) {
  const res = await discordFetch(`/channels/${DISCORD_CHANNEL_ID}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, allowed_mentions: { parse: ["users", "roles"] } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord post failed: ${res.status} ${text}`);
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const discordId = normalizeDiscordId(
      (session.user as any).discordId ?? (session.user as any).id
    );
    if (!isAdmin(discordId)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    if (!BOT_TOKEN) {
      return NextResponse.json(
        { error: "CL4W_BOT_TOKEN not configured" },
        { status: 500 }
      );
    }

    const currentWeek = await getSetupWeek();

    // Fetch signups
    const [signups] = await pool.query<any[]>(
      `SELECT slot_day, slot_game, ncxid, opponent_ncxid
       FROM S9.stream_signups
       WHERE week_label = ?
       ORDER BY slot_day ASC, slot_game ASC`,
      [currentWeek]
    );

    // Collect ncxids for lookups
    const allNcxids = new Set<string>();
    for (const s of signups ?? []) {
      if (s.ncxid) allNcxids.add(String(s.ncxid));
      if (s.opponent_ncxid) allNcxids.add(String(s.opponent_ncxid));
    }

    // Lookup discord IDs for players
    let ncxToDiscord: Record<string, string> = {};
    if (allNcxids.size > 0) {
      const ph = [...allNcxids].map(() => "?").join(",");
      const [rows] = await pool.query<any[]>(
        `SELECT ncxid, discord_id FROM S9.discord_map WHERE ncxid IN (${ph})`,
        [...allNcxids]
      );
      for (const r of rows ?? []) {
        ncxToDiscord[String(r.ncxid)] = String(r.discord_id);
      }
    }

    // Lookup player teams from individual_stats
    let ncxToTeam: Record<string, string> = {};
    if (allNcxids.size > 0) {
      const ph = [...allNcxids].map(() => "?").join(",");
      const [rows] = await pool.query<any[]>(
        `SELECT ncxid, team FROM S9.individual_stats WHERE ncxid IN (${ph})`,
        [...allNcxids]
      );
      for (const r of rows ?? []) {
        ncxToTeam[String(r.ncxid)] = String(r.team ?? "").trim().toUpperCase();
      }
    }

    // Lookup team role IDs (cast to char to avoid JS precision loss)
    const [teams] = await pool.query<any[]>(
      `SELECT team_name, CAST(team_id AS CHAR) as team_id FROM S9.teams`
    );
    const teamToRoleId: Record<string, string> = {};
    for (const t of teams ?? []) {
      teamToRoleId[String(t.team_name).trim().toUpperCase()] = String(t.team_id);
    }

    // Lookup matchup game numbers
    const [matchups] = await pool.query<any[]>(
      `SELECT game, awayId, homeId FROM S9.weekly_matchups WHERE week_label = ?`,
      [currentWeek]
    );
    const ncxToGameSide: Record<string, { game: string; side: "away" | "home" }> = {};
    const gameMatchup: Record<string, { awayId: string; homeId: string }> = {};
    for (const m of matchups ?? []) {
      const g = String(m.game);
      const away = String(m.awayId);
      const home = String(m.homeId);
      ncxToGameSide[away] = { game: g, side: "away" };
      ncxToGameSide[home] = { game: g, side: "home" };
      gameMatchup[g] = { awayId: away, homeId: home };
    }

    // Build message
    function playerMention(ncxid: string): string {
      const did = ncxToDiscord[ncxid];
      return did ? `<@${did}>` : ncxid;
    }

    function teamMention(ncxid: string): string {
      const team = ncxToTeam[ncxid];
      if (!team) return "";
      const roleId = teamToRoleId[team];
      return roleId ? `<@&${roleId}>` : team;
    }

    function formatSlot(signup: any): string {
      const signerNcxid = String(signup.ncxid);
      const oppNcxid = String(signup.opponent_ncxid);

      // Figure out who is away (first) and who is home (last)
      const info = ncxToGameSide[signerNcxid];
      let awayNcxid: string;
      let homeNcxid: string;

      if (info?.side === "home") {
        awayNcxid = oppNcxid;
        homeNcxid = signerNcxid;
      } else {
        awayNcxid = signerNcxid;
        homeNcxid = oppNcxid;
      }

      const gameNum = info?.game ?? "?";
      return `**GAME ${signup.slot_game}:** ${playerMention(awayNcxid)} ( ${teamMention(awayNcxid)} ) vs ${playerMention(homeNcxid)} ( ${teamMention(homeNcxid)} )  •  Week Game #${gameNum}`;
    }

    const tuesday = (signups ?? []).filter((s: any) => s.slot_day === "tuesday");
    const thursday = (signups ?? []).filter((s: any) => s.slot_day === "thursday");

    let msg = `# 📺 STREAM SCHEDULE — ${currentWeek}\n\n`;

    msg += `## TUESDAY\n`;
    if (tuesday.length === 0) {
      msg += `*No games scheduled*\n`;
    } else {
      for (const s of tuesday) {
        msg += `${formatSlot(s)}\n`;
      }
    }

    msg += `\n## THURSDAY\n`;
    if (thursday.length === 0) {
      msg += `*No games scheduled*\n`;
    } else {
      for (const s of thursday) {
        msg += `${formatSlot(s)}\n`;
      }
    }

    msg += `\n*Game 1 starts at 6:30 PM ET*`;

    // Clear channel and post
    await clearChannel();
    await postMessage(msg);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("POST /api/stream-signup/discord error:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to update Discord" },
      { status: 500 }
    );
  }
}
