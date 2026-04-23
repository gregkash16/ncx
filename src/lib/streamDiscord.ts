import { pool } from "@/lib/db";

const DISCORD_CHANNEL_ID = "1143366394466013184";
const BOT_TOKEN = process.env.CL4W_BOT_TOKEN ?? "";

async function discordFetch(path: string, options: RequestInit = {}) {
  return fetch(`https://discord.com/api/v10${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

async function clearChannel() {
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

/**
 * Clear the stream channel and repost the current schedule for `week`.
 * Throws if BOT_TOKEN missing or Discord calls fail.
 */
export async function rebuildStreamDiscordPost(week: string): Promise<void> {
  if (!BOT_TOKEN) {
    throw new Error("CL4W_BOT_TOKEN not configured");
  }

  const [signups] = await pool.query<any[]>(
    `SELECT slot_day, slot_game, ncxid, opponent_ncxid
     FROM S9.stream_signups
     WHERE week_label = ?
     ORDER BY slot_day ASC, slot_game ASC`,
    [week]
  );

  const allNcxids = new Set<string>();
  for (const s of signups ?? []) {
    if (s.ncxid) allNcxids.add(String(s.ncxid));
    if (s.opponent_ncxid) allNcxids.add(String(s.opponent_ncxid));
  }

  const ncxToDiscord: Record<string, string> = {};
  const ncxToTeam: Record<string, string> = {};
  if (allNcxids.size > 0) {
    const ph = [...allNcxids].map(() => "?").join(",");
    const [dmRows] = await pool.query<any[]>(
      `SELECT ncxid, discord_id FROM S9.discord_map WHERE ncxid IN (${ph})`,
      [...allNcxids]
    );
    for (const r of dmRows ?? []) {
      ncxToDiscord[String(r.ncxid)] = String(r.discord_id);
    }
    const [statRows] = await pool.query<any[]>(
      `SELECT ncxid, team FROM S9.individual_stats WHERE ncxid IN (${ph})`,
      [...allNcxids]
    );
    for (const r of statRows ?? []) {
      ncxToTeam[String(r.ncxid)] = String(r.team ?? "").trim().toUpperCase();
    }
  }

  const [teams] = await pool.query<any[]>(
    `SELECT team_name, CAST(team_id AS CHAR) as team_id FROM S9.teams`
  );
  const teamToRoleId: Record<string, string> = {};
  for (const t of teams ?? []) {
    teamToRoleId[String(t.team_name).trim().toUpperCase()] = String(t.team_id);
  }

  const [matchups] = await pool.query<any[]>(
    `SELECT game, awayId, homeId FROM S9.weekly_matchups WHERE week_label = ?`,
    [week]
  );
  const ncxToGameSide: Record<string, { game: string; side: "away" | "home" }> = {};
  for (const m of matchups ?? []) {
    const g = String(m.game);
    const away = String(m.awayId);
    const home = String(m.homeId);
    ncxToGameSide[away] = { game: g, side: "away" };
    ncxToGameSide[home] = { game: g, side: "home" };
  }

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

  let msg = `# 📺 STREAM SCHEDULE — ${week}\n\n`;

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

  await clearChannel();
  await postMessage(msg);
}
