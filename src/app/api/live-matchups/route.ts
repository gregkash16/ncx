// src/app/api/live-matchups/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import {
  endLiveMatchupRow,
  purgeExpiredLiveMatchups,
} from "@/lib/liveMatchups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_DISCORD_IDS = ["349349801076195329", "986330724212801557"] as const;

let ensured = false;
let ensuredClickLog = false;
let ensuredBanList = false;

async function ensureBanTable() {
  if (ensuredBanList) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS S9.live_bans (
      discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
      discord_name VARCHAR(255),
      banned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  ensuredBanList = true;
}

export async function isDiscordIdBanned(discordId: string): Promise<boolean> {
  if (!discordId) return false;
  if ((ADMIN_DISCORD_IDS as readonly string[]).includes(discordId)) return false;
  await ensureBanTable();
  const [rows] = await pool.query<any[]>(
    `SELECT 1 FROM S9.live_bans WHERE discord_id = ? LIMIT 1`,
    [discordId]
  );
  return Array.isArray(rows) && rows.length > 0;
}

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
      started_by_discord_id VARCHAR(32),
      discord_message_id VARCHAR(32),
      PRIMARY KEY (week_label, game)
    )
  `);
  // Add columns to existing tables created before these fields were tracked.
  for (const sql of [
    `ALTER TABLE S9.live_matchups ADD COLUMN started_by_discord_id VARCHAR(32)`,
    `ALTER TABLE S9.live_matchups ADD COLUMN discord_message_id VARCHAR(32)`,
  ]) {
    try {
      await pool.query(sql);
    } catch {
      // Column already exists — expected on all runs after the first.
    }
  }
  ensured = true;
}

async function ensureClickLogTable() {
  if (ensuredClickLog) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS railway.live (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      clicked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      discord_id VARCHAR(32) NOT NULL,
      discord_name VARCHAR(255),
      week_label VARCHAR(32),
      game VARCHAR(16),
      provider VARCHAR(32),
      stream_name VARCHAR(255),
      stream_url TEXT,
      is_new TINYINT(1) NOT NULL DEFAULT 0,
      INDEX idx_clicked_at (clicked_at),
      INDEX idx_discord_id (discord_id)
    )
  `);
  ensuredClickLog = true;
}

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "").trim().replace(/[<@!>]/g, "").replace(/\D/g, "");
}

export async function GET(request: Request) {
  try {
    await ensureTable();
    await purgeExpiredLiveMatchups();

    const { searchParams } = new URL(request.url);
    const week = searchParams.get("week");

    const sql = week
      ? `SELECT week_label, game, provider, stream_name, stream_url, started_at, started_by_discord_id
           FROM S9.live_matchups WHERE week_label = ?`
      : `SELECT week_label, game, provider, stream_name, stream_url, started_at, started_by_discord_id
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
      startedByDiscordId:
        r.started_by_discord_id != null
          ? String(r.started_by_discord_id)
          : null,
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
    const session = await getServerSession(authOptions);
    const discordId = normalizeDiscordId(
      (session?.user as any)?.discordId ?? (session?.user as any)?.id
    );
    if (!session?.user || !discordId) {
      return NextResponse.json(
        { error: "Sign in with Discord to go live" },
        { status: 401 }
      );
    }
    const discordName =
      (session.user as any)?.name != null
        ? String((session.user as any).name)
        : null;

    if (await isDiscordIdBanned(discordId)) {
      return NextResponse.json(
        {
          error: "You are banned from going live. Appeal to gregkash.",
          banned: true,
        },
        { status: 403 }
      );
    }

    await ensureTable();

    const body = await request.json();
    const weekLabel = String(body?.weekLabel ?? "").trim();
    const game = String(body?.game ?? "").trim();
    const provider = String(body?.provider ?? "").trim();
    const streamName =
      body?.streamName != null ? String(body.streamName).trim() : null;
    const streamUrl = String(body?.streamUrl ?? "").trim();
    const awayTeam = body?.awayTeam ? String(body.awayTeam).trim() : "";
    const homeTeam = body?.homeTeam ? String(body.homeTeam).trim() : "";
    const awayName = body?.awayName ? String(body.awayName).trim() : "";
    const homeName = body?.homeName ? String(body.homeName).trim() : "";
    const awayNcxId = body?.awayNcxId ? String(body.awayNcxId).trim().toUpperCase() : "";
    const homeNcxId = body?.homeNcxId ? String(body.homeNcxId).trim().toUpperCase() : "";

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

    const [existing] = await pool.query<any[]>(
      `SELECT started_by_discord_id FROM S9.live_matchups WHERE week_label = ? AND game = ?`,
      [weekLabel, game]
    );
    const isNew = !Array.isArray(existing) || existing.length === 0;
    if (!isNew) {
      const owner = existing[0]?.started_by_discord_id
        ? String(existing[0].started_by_discord_id)
        : null;
      // Allow legacy rows (no owner recorded) to be claimed by any signed-in user.
      if (owner && owner !== discordId) {
        return NextResponse.json(
          { error: "Only the user who started this stream can change it" },
          { status: 403 }
        );
      }
    }

    await pool.query(
      `INSERT INTO S9.live_matchups
         (week_label, game, provider, stream_name, stream_url, started_at, started_by_discord_id)
       VALUES (?, ?, ?, ?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE
         provider = VALUES(provider),
         stream_name = VALUES(stream_name),
         stream_url = VALUES(stream_url),
         started_at = NOW(),
         started_by_discord_id = VALUES(started_by_discord_id)`,
      [weekLabel, game, provider, streamName, streamUrl, discordId]
    );

    try {
      await ensureClickLogTable();
      await pool.query(
        `INSERT INTO railway.live
           (discord_id, discord_name, week_label, game, provider, stream_name, stream_url, is_new)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [discordId, discordName, weekLabel, game, provider, streamName, streamUrl, isNew ? 1 : 0]
      );
    } catch (e) {
      console.warn("⚠️ railway.live click log failed:", e);
    }

    if (isNew) {
      const webhook = process.env.DISCORD_LIVE_WEBHOOK_URL;
      if (webhook) {
        const roleIds: Record<string, string> = {};
        const wanted = [awayTeam, homeTeam].filter(Boolean);
        if (wanted.length) {
          try {
            const [teamRows] = await pool.query<any[]>(
              `SELECT team_name, CAST(team_id AS CHAR) AS team_id
                 FROM S9.teams
                WHERE UPPER(team_name) IN (?)`,
              [wanted.map((t) => t.toUpperCase())]
            );
            for (const r of teamRows ?? []) {
              roleIds[String(r.team_name).toUpperCase()] = String(r.team_id);
            }
          } catch (e) {
            console.warn("⚠️ team_id lookup failed:", e);
          }
        }

        const teamMention = (teamName: string) => {
          const id = roleIds[teamName.toUpperCase()];
          return id ? `<@&${id}>` : teamName;
        };

        const discordIds: Record<string, string> = {};
        const wantedNcx = [awayNcxId, homeNcxId].filter(Boolean);
        if (wantedNcx.length) {
          try {
            const [mapRows] = await pool.query<any[]>(
              `SELECT ncxid, discord_id
                 FROM S9.discord_map
                WHERE UPPER(ncxid) IN (?)`,
              [wantedNcx]
            );
            for (const r of mapRows ?? []) {
              if (r?.ncxid && r?.discord_id) {
                discordIds[String(r.ncxid).toUpperCase()] = String(r.discord_id);
              }
            }
          } catch (e) {
            console.warn("⚠️ discord_map lookup failed:", e);
          }
        }

        const playerLabel = (ncxid: string, name: string) => {
          const did = ncxid ? discordIds[ncxid] : "";
          if (did && name) return `<@${did}> (${name})`;
          if (did) return `<@${did}>`;
          return name;
        };

        const awayPlayer = playerLabel(awayNcxId, awayName);
        const homePlayer = playerLabel(homeNcxId, homeName);

        const awaySide =
          awayTeam && awayPlayer
            ? `${teamMention(awayTeam)} • ${awayPlayer}`
            : awayTeam
              ? teamMention(awayTeam)
              : awayPlayer || "Away";
        const homeSide =
          homeTeam && homePlayer
            ? `${homePlayer} • ${teamMention(homeTeam)}`
            : homeTeam
              ? teamMention(homeTeam)
              : homePlayer || "Home";
        const content =
          `🔴 **LIVE NOW** — ${weekLabel} — GAME ${game} — ${awaySide} vs ${homeSide} — ${streamUrl}`;
        try {
          // ?wait=true makes Discord respond with the message object so we
          // can capture its id for later deletion when the live ends.
          const sep = webhook.includes("?") ? "&" : "?";
          const res = await fetch(`${webhook}${sep}wait=true`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          });
          if (res.ok) {
            const msg = await res.json().catch(() => null);
            const msgId = msg?.id ? String(msg.id) : "";
            if (msgId) {
              try {
                await pool.query(
                  `UPDATE S9.live_matchups
                      SET discord_message_id = ?
                    WHERE week_label = ? AND game = ?`,
                  [msgId, weekLabel, game]
                );
              } catch (e) {
                console.warn("⚠️ saving discord_message_id failed:", e);
              }
            }
          }
        } catch (e) {
          console.warn("⚠️ Live webhook post failed:", e);
        }
      }

      // FCM: notify subscribers to either team's "Live" category.
      try {
        const { sendPushToCategory } = await import("@/lib/fcm");
        const awayLabel = [awayTeam, awayName].filter(Boolean).join(" — ");
        const homeLabel = [homeTeam, homeName].filter(Boolean).join(" — ");
        const onName = streamName?.trim() ? streamName : provider;
        const result = await sendPushToCategory(
          "live",
          [awayTeam, homeTeam].filter(Boolean),
          {
            title: "🔴 LIVE NOW",
            body: `${awayLabel} vs ${homeLabel} — on ${onName}`,
            url: "/m/current",
          },
          `live-matchups: ${weekLabel} G${game} ${awayTeam} v ${homeTeam}`
        );
        console.log(
          `[live-matchups] FCM sent=${result.sent}, failed=${result.failed}`
        );
      } catch (pushErr) {
        console.warn("⚠️ Live FCM push failed:", pushErr);
      }
    }

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
    const session = await getServerSession(authOptions);
    const discordId = normalizeDiscordId(
      (session?.user as any)?.discordId ?? (session?.user as any)?.id
    );
    if (!session?.user || !discordId) {
      return NextResponse.json(
        { error: "Sign in with Discord to end live" },
        { status: 401 }
      );
    }

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

    const isAdmin = (ADMIN_DISCORD_IDS as readonly string[]).includes(discordId);

    const [existing] = await pool.query<any[]>(
      `SELECT started_by_discord_id FROM S9.live_matchups WHERE week_label = ? AND game = ?`,
      [weekLabel, game]
    );
    if (Array.isArray(existing) && existing.length > 0 && !isAdmin) {
      const owner = existing[0]?.started_by_discord_id
        ? String(existing[0].started_by_discord_id)
        : null;
      // Allow legacy rows (no owner recorded) to be ended by any signed-in user.
      if (owner && owner !== discordId) {
        return NextResponse.json(
          { error: "Only the user who started this stream (or an admin) can end it" },
          { status: 403 }
        );
      }
    }

    await endLiveMatchupRow(weekLabel, game);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("DELETE /api/live-matchups error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: 500 }
    );
  }
}
