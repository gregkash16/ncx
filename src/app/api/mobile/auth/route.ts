/**
 * POST /api/mobile/auth
 * Exchange Discord access token for NCX mobile JWT
 *
 * Body: { discordAccessToken: string }
 * Returns: { token: string, user: { discordId, name, avatar, ncxid } }
 */

import { NextResponse } from "next/server";
import { createMobileJWT } from "@/lib/mobileAuth";
import { pool } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { discordAccessToken } = body;

    if (!discordAccessToken || typeof discordAccessToken !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid discordAccessToken" },
        { status: 400 }
      );
    }

    // Validate token with Discord API
    const discordRes = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${discordAccessToken}`,
      },
    });

    if (!discordRes.ok) {
      return NextResponse.json(
        { error: "Invalid Discord token" },
        { status: 401 }
      );
    }

    const discordUser = await discordRes.json();
    const discordId = discordUser.id;
    const name = discordUser.global_name ?? discordUser.username;
    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png`
      : null;

    // Look up NCXID from discord_map table
    let ncxid: string | null = null;
    try {
      const [rows] = await pool.query<any[]>(
        "SELECT ncxid FROM discord_map WHERE discord_id = ?",
        [discordId]
      );
      if (rows.length > 0) {
        ncxid = rows[0].ncxid;
      }
    } catch {
      // If query fails, just proceed without NCXID
    }

    // Create JWT
    const token = createMobileJWT(discordId, ncxid);

    return NextResponse.json({
      token,
      user: {
        discordId,
        name,
        avatar,
        ncxid,
      },
    });
  } catch (e) {
    console.error("[mobile/auth] POST error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
