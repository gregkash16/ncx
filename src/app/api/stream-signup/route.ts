import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getSheets } from "@/lib/googleSheets";
import { rebuildStreamDiscordPost } from "@/lib/streamDiscord";

async function syncDiscord(week: string) {
  try {
    await rebuildStreamDiscordPost(week);
  } catch (err) {
    console.error("stream-signup: Discord rebuild failed:", err);
  }
}

const ADMIN_DISCORD_IDS = ["349349801076195329", "986330724212801557"];
const SPREADSHEET_ID = "1x4_rfPq-fPnJ2IT6WbNzBxVmomqU36fU24pnKuPaObw";

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/[<@!>]/g, "")
    .replace(/\D/g, "");
}

function isAdmin(discordId: string): boolean {
  return ADMIN_DISCORD_IDS.includes(discordId);
}

/**
 * Read the setup week from Google Sheets SCHEDULE!J3.
 *
 * Cached in-memory for 60s because this cell is independent from current_week
 * (it's the *signup* week, which can be ahead of the active match week) and
 * isn't synced by seed-mysql — so we have to keep the Sheets read, but we
 * don't need to do it on every GET.
 */
type SetupWeekCache = { value: string; ts: number };
const SETUP_WEEK_TTL_MS = 60_000;
const globalForSetupWeek = globalThis as unknown as {
  __ncxSetupWeekCache?: SetupWeekCache;
};

async function getSetupWeek(): Promise<string> {
  const now = Date.now();
  const cached = globalForSetupWeek.__ncxSetupWeekCache;
  if (cached && now - cached.ts < SETUP_WEEK_TTL_MS) {
    return cached.value;
  }

  let value: string;
  try {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "SCHEDULE!J3",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const raw = String(res.data.values?.[0]?.[0] ?? "").trim();
    if (!raw) value = "WEEK 1";
    else if (/^\d+$/.test(raw)) value = `WEEK ${raw}`;
    else value = raw.toUpperCase();
  } catch (err) {
    console.error("Failed to read setup week from sheet, falling back to DB:", err);
    const [weekRows] = await pool.query<any[]>(
      `SELECT week_label FROM S9.current_week LIMIT 1`
    );
    value = weekRows?.[0]?.week_label || "WEEK 1";
  }

  globalForSetupWeek.__ncxSetupWeekCache = { value, ts: now };
  return value;
}

/* ─── GET: fetch signups for current (or specified) week ─── */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const currentWeek = await getSetupWeek();
    const week = searchParams.get("week") || currentWeek;

    // Fetch signups for the week
    const [signups] = await pool.query<any[]>(
      `SELECT id, week_label, slot_day, slot_game, ncxid, opponent_ncxid, created_at
       FROM S9.stream_signups
       WHERE week_label = ?
       ORDER BY slot_day ASC, slot_game ASC`,
      [week]
    );

    // Collect all ncxids to enrich with player info
    const allIds = new Set<string>();
    for (const s of signups ?? []) {
      if (s.ncxid) allIds.add(s.ncxid);
      if (s.opponent_ncxid) allIds.add(s.opponent_ncxid);
    }

    let playerMap: Record<string, any> = {};
    if (allIds.size > 0) {
      const placeholders = [...allIds].map(() => "?").join(",");
      const [players] = await pool.query<any[]>(
        `SELECT ncxid, first_name, last_name, team, faction,
                wins, losses, points, plms, games, winper, ppg, efficiency, war
         FROM S9.individual_stats
         WHERE ncxid IN (${placeholders})`,
        [...allIds]
      );
      for (const p of players ?? []) {
        playerMap[String(p.ncxid)] = {
          ncxid: String(p.ncxid),
          name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
          team: String(p.team ?? "").trim(),
          faction: String(p.faction ?? "").trim(),
          wins: String(p.wins ?? "0"),
          losses: String(p.losses ?? "0"),
          points: String(p.points ?? "0"),
          plms: String(p.plms ?? "0"),
          games: String(p.games ?? "0"),
          winPct: String(p.winper ?? "0"),
          ppg: String(p.ppg ?? "0"),
          efficiency: String(p.efficiency ?? "0"),
          war: String(p.war ?? "0"),
        };
      }
    }

    // Check caller identity for admin flag
    // Native app auth: accept x-discord-id header as fallback
    const nativeDiscordId = request.headers.get("x-discord-id");
    const session = nativeDiscordId ? null : await getServerSession(authOptions);
    const discordId = nativeDiscordId
      ? normalizeDiscordId(nativeDiscordId)
      : normalizeDiscordId(
          (session?.user as any)?.discordId ?? (session?.user as any)?.id
        );
    const admin = discordId ? isAdmin(discordId) : false;

    // Resolve caller's NCXID
    let callerNcxid: string | null = null;
    if (discordId) {
      const [dmRows] = await pool.query<any[]>(
        `SELECT ncxid FROM S9.discord_map WHERE discord_id = ? LIMIT 1`,
        [discordId]
      );
      callerNcxid = dmRows?.[0]?.ncxid ? String(dmRows[0].ncxid) : null;
    }

    // Check if caller already has a signup this week
    let callerSignup: any = null;
    if (callerNcxid) {
      const existing = (signups ?? []).find(
        (s: any) => String(s.ncxid) === callerNcxid
      );
      if (existing) callerSignup = existing;
    }

    // Fetch matchups for this week
    const [matchups] = await pool.query<any[]>(
      `SELECT game, awayId, awayName, awayTeam, homeId, homeName, homeTeam, scenario
       FROM S9.weekly_matchups
       WHERE week_label = ?
       ORDER BY game ASC`,
      [week]
    );

    // Build lookups: ncxid -> matchup game number, and ncxid -> { awayId, homeId }
    const ncxidToGame: Record<string, string> = {};
    const ncxidToMatchup: Record<string, { awayId: string; homeId: string }> = {};
    for (const m of matchups ?? []) {
      const g = String(m.game);
      const away = String(m.awayId);
      const home = String(m.homeId);
      if (away) { ncxidToGame[away] = g; ncxidToMatchup[away] = { awayId: away, homeId: home }; }
      if (home) { ncxidToGame[home] = g; ncxidToMatchup[home] = { awayId: away, homeId: home }; }
    }

    return NextResponse.json({
      currentWeek,
      week,
      signups: (signups ?? []).map((s: any) => {
        const signerNcxid = String(s.ncxid);
        const oppNcxid = s.opponent_ncxid ? String(s.opponent_ncxid) : null;
        // Always resolve away (left) and home (right) from the matchup data
        const matchInfo = ncxidToMatchup[signerNcxid];
        let awayNcxid: string;
        let homeNcxid: string | null;
        if (matchInfo) {
          awayNcxid = matchInfo.awayId;
          homeNcxid = matchInfo.homeId;
        } else {
          // Fallback: keep original order
          awayNcxid = signerNcxid;
          homeNcxid = oppNcxid;
        }
        return {
          id: s.id,
          weekLabel: s.week_label,
          slotDay: s.slot_day,
          slotGame: s.slot_game,
          ncxid: awayNcxid,
          opponentNcxid: homeNcxid,
          createdAt: s.created_at,
          matchupGame: ncxidToGame[signerNcxid] || null,
          player: playerMap[awayNcxid] || null,
          opponent: homeNcxid ? playerMap[homeNcxid] || null : null,
        };
      }),
      callerNcxid,
      callerSignup: callerSignup
        ? {
            slotDay: callerSignup.slot_day,
            slotGame: callerSignup.slot_game,
          }
        : null,
      isAdmin: admin,
      matchups: (matchups ?? []).map((m: any) => ({
        game: String(m.game),
        awayId: String(m.awayId ?? ""),
        awayName: String(m.awayName ?? ""),
        awayTeam: String(m.awayTeam ?? "").trim(),
        homeId: String(m.homeId ?? ""),
        homeName: String(m.homeName ?? ""),
        homeTeam: String(m.homeTeam ?? "").trim(),
        scenario: String(m.scenario ?? ""),
      })),
    });
  } catch (err: any) {
    console.error("GET /api/stream-signup error:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to fetch stream signups" },
      { status: 500 }
    );
  }
}

/* ─── POST: sign up for a slot ─── */
export async function POST(request: NextRequest) {
  try {
    // Native app auth: accept x-discord-id header as fallback
    const nativeDiscordId = request.headers.get("x-discord-id");
    const session = nativeDiscordId ? null : await getServerSession(authOptions);

    if (!session?.user && !nativeDiscordId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const discordId = nativeDiscordId
      ? normalizeDiscordId(nativeDiscordId)
      : normalizeDiscordId(
          (session!.user as any).discordId ?? (session!.user as any).id
        );
    if (!discordId) {
      return NextResponse.json(
        { error: "No Discord ID found" },
        { status: 400 }
      );
    }

    // Resolve NCXID
    const [dmRows] = await pool.query<any[]>(
      `SELECT ncxid FROM S9.discord_map WHERE discord_id = ? LIMIT 1`,
      [discordId]
    );
    const ncxid = dmRows?.[0]?.ncxid ? String(dmRows[0].ncxid) : null;
    if (!ncxid) {
      return NextResponse.json(
        { error: "No NCXID linked to your Discord account" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { slotDay, slotGame } = body;

    if (!["tuesday", "thursday"].includes(slotDay) || ![1, 2].includes(slotGame)) {
      return NextResponse.json(
        { error: "Invalid slot_day or slot_game" },
        { status: 400 }
      );
    }

    // Get current week from setup sheet
    const currentWeek = await getSetupWeek();

    // Find this player's matchup for the week
    const [matchRows] = await pool.query<any[]>(
      `SELECT game, awayId, homeId
       FROM S9.weekly_matchups
       WHERE week_label = ? AND (awayId = ? OR homeId = ?)
       LIMIT 1`,
      [currentWeek, ncxid, ncxid]
    );

    if (!matchRows || matchRows.length === 0) {
      return NextResponse.json(
        { error: "You don't have a matchup scheduled this week" },
        { status: 400 }
      );
    }

    const match = matchRows[0];
    const opponentNcxid =
      String(match.awayId) === ncxid
        ? String(match.homeId)
        : String(match.awayId);

    // Insert (unique constraints handle conflicts)
    await pool.query(
      `INSERT INTO S9.stream_signups (week_label, slot_day, slot_game, ncxid, opponent_ncxid)
       VALUES (?, ?, ?, ?, ?)`,
      [currentWeek, slotDay, slotGame, ncxid, opponentNcxid]
    );

    await syncDiscord(currentWeek);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") {
      const msg = String(err.message ?? "");
      if (msg.includes("uq_player_week")) {
        return NextResponse.json(
          { error: "You've already signed up for a stream slot this week" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "That slot is already taken" },
        { status: 409 }
      );
    }
    console.error("POST /api/stream-signup error:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to sign up" },
      { status: 500 }
    );
  }
}

/* ─── PUT: admin assign a matchup to a slot ─── */
export async function PUT(request: NextRequest) {
  try {
    // Native app auth: accept x-discord-id header as fallback
    const nativeDiscordId = request.headers.get("x-discord-id");
    const session = nativeDiscordId ? null : await getServerSession(authOptions);

    if (!session?.user && !nativeDiscordId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const discordId = nativeDiscordId
      ? normalizeDiscordId(nativeDiscordId)
      : normalizeDiscordId(
          (session!.user as any).discordId ?? (session!.user as any).id
        );
    if (!isAdmin(discordId)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await request.json();
    const { slotDay, slotGame, gameNumber } = body;

    if (!["tuesday", "thursday"].includes(slotDay) || ![1, 2].includes(slotGame)) {
      return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
    }
    if (!gameNumber) {
      return NextResponse.json({ error: "Missing game number" }, { status: 400 });
    }

    const currentWeek = await getSetupWeek();

    // Find the matchup by game number
    const [matchRows] = await pool.query<any[]>(
      `SELECT game, awayId, homeId
       FROM S9.weekly_matchups
       WHERE week_label = ? AND game = ?
       LIMIT 1`,
      [currentWeek, String(gameNumber)]
    );

    if (!matchRows || matchRows.length === 0) {
      return NextResponse.json(
        { error: `No matchup found for game #${gameNumber}` },
        { status: 400 }
      );
    }

    const match = matchRows[0];
    const awayId = String(match.awayId);
    const homeId = String(match.homeId);

    // Delete any existing signup for this slot or for either player this week
    await pool.query(
      `DELETE FROM S9.stream_signups
       WHERE week_label = ? AND (
         (slot_day = ? AND slot_game = ?)
         OR ncxid = ? OR ncxid = ?
         OR opponent_ncxid = ? OR opponent_ncxid = ?
       )`,
      [currentWeek, slotDay, slotGame, awayId, homeId, awayId, homeId]
    );

    // Insert the admin-assigned signup (use away player as the primary)
    await pool.query(
      `INSERT INTO S9.stream_signups (week_label, slot_day, slot_game, ncxid, opponent_ncxid)
       VALUES (?, ?, ?, ?, ?)`,
      [currentWeek, slotDay, slotGame, awayId, homeId]
    );

    await syncDiscord(currentWeek);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("PUT /api/stream-signup error:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to assign game" },
      { status: 500 }
    );
  }
}

/* ─── DELETE: admin remove a signup ─── */
export async function DELETE(request: NextRequest) {
  try {
    // Native app auth: accept x-discord-id header as fallback
    const nativeDiscordId = request.headers.get("x-discord-id");
    const session = nativeDiscordId ? null : await getServerSession(authOptions);

    if (!session?.user && !nativeDiscordId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const discordId = nativeDiscordId
      ? normalizeDiscordId(nativeDiscordId)
      : normalizeDiscordId(
          (session!.user as any).discordId ?? (session!.user as any).id
        );
    if (!isAdmin(discordId)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing signup id" }, { status: 400 });
    }

    await pool.query(`DELETE FROM S9.stream_signups WHERE id = ?`, [id]);

    const currentWeek = await getSetupWeek();
    await syncDiscord(currentWeek);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("DELETE /api/stream-signup error:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to delete signup" },
      { status: 500 }
    );
  }
}
