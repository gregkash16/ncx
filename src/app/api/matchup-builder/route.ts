// /api/matchup-builder  —  GET: return draft state + rosters for polling
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getSheets } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

/* ── helpers (mirrored from report-game) ── */

const ADMIN_DISCORD_IDS = ["349349801076195329", "986330724212801557"] as const;

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "").trim().replace(/[<@!>]/g, "").replace(/\D/g, "");
}
function norm(v: unknown) {
  return String(v ?? "").trim();
}
function teamKey(s: string): string {
  return String(s ?? "").trim().toUpperCase();
}

type SheetsClient = ReturnType<typeof getSheets>;

async function getCaptainTeamsForDiscord(
  sheets: SheetsClient,
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
    const team = norm(r?.[0]);
    const disc = normalizeDiscordId(r?.[4]);
    if (team && disc === discordId) teams.push(team);
  }
  return teams;
}

/* ── main ── */

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionId = session?.user
      ? normalizeDiscordId((session.user as any).discordId ?? (session.user as any).id)
      : "";
    const headerRaw = (req.headers.get("x-discord-id") ?? "").trim();
    const isAppleAuth = headerRaw.startsWith("apple-") && process.env.DEMO_MODE === "true";
    const headerId = isAppleAuth ? "" : normalizeDiscordId(headerRaw);
    const discordId = sessionId || headerId;
    if (!discordId && !isAppleAuth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const isAdmin = isAppleAuth || (ADMIN_DISCORD_IDS as readonly string[]).includes(discordId);

    const sheets = getSheets();
    const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
    const captainTeams = await getCaptainTeamsForDiscord(sheets, spreadsheetId, discordId);

    if (!isAdmin && captainTeams.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Week param (default to current week from DB)
    const weekParam = req.nextUrl.searchParams.get("week");
    let weekLabel: string;
    if (weekParam) {
      const m = weekParam.match(/week\s*(\d+)/i) || weekParam.match(/^(\d+)$/);
      weekLabel = m ? `WEEK ${parseInt(m[1], 10)}` : weekParam.toUpperCase();
    } else {
      const [cwRows] = await pool.query("SELECT week_label FROM S9.current_week LIMIT 1");
      const cw = (cwRows as any[])[0];
      weekLabel = cw?.week_label ?? "WEEK 1";
    }

    // Find the team schedule entry for this captain's team in this week
    const [schedRows] = await pool.query(
      "SELECT away_team, home_team FROM S9.team_schedule WHERE week_label = ?",
      [weekLabel]
    );
    const schedList = schedRows as any[];

    // Figure out which series this captain is involved in
    // Admin can specify away/home via query params
    const awayParam = req.nextUrl.searchParams.get("away");
    const homeParam = req.nextUrl.searchParams.get("home");

    let awayTeam: string | null = null;
    let homeTeam: string | null = null;

    if (awayParam && homeParam) {
      // Explicit params (admin or direct link)
      awayTeam = awayParam;
      homeTeam = homeParam;
    } else {
      // Auto-detect from captain's team
      for (const s of schedList) {
        const away = norm(s.away_team);
        const home = norm(s.home_team);
        if (
          captainTeams.some((t) => teamKey(t) === teamKey(away)) ||
          captainTeams.some((t) => teamKey(t) === teamKey(home))
        ) {
          awayTeam = away;
          homeTeam = home;
          break;
        }
      }
    }

    if (!awayTeam || !homeTeam) {
      // Return available weeks and series for this captain
      const allWeeks: string[] = [];
      const [weekRows] = await pool.query(
        "SELECT DISTINCT week_label FROM S9.team_schedule ORDER BY CAST(SUBSTRING(week_label, 6) AS UNSIGNED)"
      );
      for (const r of weekRows as any[]) allWeeks.push(r.week_label);

      // Return captain's series across all weeks
      const mySeries: any[] = [];
      for (const s of schedList) {
        const away = norm(s.away_team);
        const home = norm(s.home_team);
        if (
          isAdmin ||
          captainTeams.some((t) => teamKey(t) === teamKey(away)) ||
          captainTeams.some((t) => teamKey(t) === teamKey(home))
        ) {
          mySeries.push({ awayTeam: away, homeTeam: home });
        }
      }

      return NextResponse.json({
        needsSelection: true,
        weekLabel,
        allWeeks,
        mySeries,
        captainTeams,
        isAdmin,
      });
    }

    // Auth check: must be captain of one of the teams or admin
    const isAwayCaptain = captainTeams.some((t) => teamKey(t) === teamKey(awayTeam!));
    const isHomeCaptain = captainTeams.some((t) => teamKey(t) === teamKey(homeTeam!));

    if (!isAdmin && !isAwayCaptain && !isHomeCaptain) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get or create the draft series
    const [existingSeries] = await pool.query(
      "SELECT * FROM S9.matchup_draft_series WHERE week_label = ? AND away_team = ? AND home_team = ?",
      [weekLabel, awayTeam, homeTeam]
    );
    let series = (existingSeries as any[])[0];

    if (!series) {
      // Create series + 7 slot rows
      await pool.query(
        "INSERT INTO S9.matchup_draft_series (week_label, away_team, home_team) VALUES (?, ?, ?)",
        [weekLabel, awayTeam, homeTeam]
      );
      for (let slot = 1; slot <= 7; slot++) {
        await pool.query(
          "INSERT INTO S9.matchup_draft (week_label, away_team, home_team, slot) VALUES (?, ?, ?, ?)",
          [weekLabel, awayTeam, homeTeam, slot]
        );
      }
      const [newSeries] = await pool.query(
        "SELECT * FROM S9.matchup_draft_series WHERE week_label = ? AND away_team = ? AND home_team = ?",
        [weekLabel, awayTeam, homeTeam]
      );
      series = (newSeries as any[])[0];
    }

    // Get all 7 slots
    const [slotRows] = await pool.query(
      "SELECT * FROM S9.matchup_draft WHERE week_label = ? AND away_team = ? AND home_team = ? ORDER BY slot",
      [weekLabel, awayTeam, homeTeam]
    );
    const slots = slotRows as any[];

    // Get rosters from individual_stats + all_time_stats
    const [awayRosterRows] = await pool.query(
      `SELECT i.ncxid, i.first_name, i.last_name, i.faction,
              i.wins, i.losses, i.points, i.ppg, i.war, i.winper, i.games, i.plms,
              a.wins AS at_wins, a.losses AS at_losses, a.points AS at_points,
              a.adj_ppg AS at_adjPpg, a.win_pct AS at_winPct, a.games AS at_games, a.plms AS at_plms,
              a.championships AS at_championships
       FROM S9.individual_stats i
       LEFT JOIN S9.all_time_stats a ON a.ncxid = i.ncxid
       WHERE i.team = ? ORDER BY CAST(i.pick_no AS UNSIGNED)`,
      [awayTeam]
    );
    const [homeRosterRows] = await pool.query(
      `SELECT i.ncxid, i.first_name, i.last_name, i.faction,
              i.wins, i.losses, i.points, i.ppg, i.war, i.winper, i.games, i.plms,
              a.wins AS at_wins, a.losses AS at_losses, a.points AS at_points,
              a.adj_ppg AS at_adjPpg, a.win_pct AS at_winPct, a.games AS at_games, a.plms AS at_plms,
              a.championships AS at_championships
       FROM S9.individual_stats i
       LEFT JOIN S9.all_time_stats a ON a.ncxid = i.ncxid
       WHERE i.team = ? ORDER BY CAST(i.pick_no AS UNSIGNED)`,
      [homeTeam]
    );

    // Determine assigned players
    const assignedAwayIds = new Set(
      slots.filter((s: any) => s.away_ncxid).map((s: any) => s.away_ncxid)
    );
    const assignedHomeIds = new Set(
      slots.filter((s: any) => s.home_ncxid).map((s: any) => s.home_ncxid)
    );

    const formatRoster = (rows: any[], assignedSet: Set<string>) =>
      rows.map((r: any) => ({
        ncxid: r.ncxid,
        name: `${r.first_name} ${r.last_name}`.trim(),
        firstName: r.first_name,
        lastName: r.last_name,
        faction: r.faction,
        wins: r.wins,
        losses: r.losses,
        points: r.points,
        ppg: r.ppg,
        war: r.war,
        winPct: r.winper,
        games: r.games,
        plms: r.plms,
        assigned: assignedSet.has(r.ncxid),
        allTime: {
          wins: r.at_wins ?? 0,
          losses: r.at_losses ?? 0,
          points: r.at_points ?? 0,
          adjPpg: r.at_adjPpg ?? "—",
          winPct: r.at_winPct ?? "—",
          games: r.at_games ?? 0,
          plms: r.at_plms ?? 0,
          championships: r.at_championships ?? 0,
        },
      }));

    // Determine role and turn
    const myRole = isAdmin
      ? "admin"
      : isAwayCaptain
        ? "away_captain"
        : "home_captain";

    const currentSlot = slots.find(
      (s: any) => s.slot === series.current_slot
    );
    let isMyTurn = false;
    if (currentSlot && !series.finalized) {
      if (currentSlot.status === "awaiting_away" && (myRole === "away_captain" || myRole === "admin")) {
        isMyTurn = true;
      } else if (currentSlot.status === "awaiting_home" && (myRole === "home_captain" || myRole === "admin")) {
        isMyTurn = true;
      } else if (currentSlot.status === "awaiting_veto_window" && (myRole === "away_captain" || myRole === "admin")) {
        isMyTurn = true;
      }
    }

    // Get all weeks for the week selector
    const [weekRows] = await pool.query(
      "SELECT DISTINCT week_label FROM S9.team_schedule ORDER BY CAST(SUBSTRING(week_label, 6) AS UNSIGNED)"
    );
    const allWeeks = (weekRows as any[]).map((r: any) => r.week_label);

    return NextResponse.json({
      needsSelection: false,
      weekLabel,
      allWeeks,
      awayTeam,
      homeTeam,
      series: {
        currentSlot: series.current_slot,
        vetoUsed: !!series.veto_used,
        finalized: !!series.finalized,
        finalizedAt: series.finalized_at,
      },
      slots: slots.map((s: any) => ({
        slot: s.slot,
        awayNcxid: s.away_ncxid,
        awayName: s.away_name,
        homeNcxid: s.home_ncxid,
        homeName: s.home_name,
        status: s.status,
        vetoed: !!s.vetoed,
        vetoedHomeNcxid: s.vetoed_home_ncxid ?? null,
      })),
      awayRoster: formatRoster(awayRosterRows as any[], assignedAwayIds),
      homeRoster: formatRoster(homeRosterRows as any[], assignedHomeIds),
      myRole,
      isMyTurn,
      captainTeams,
      isAdmin,
    });
  } catch (err: any) {
    console.error("[matchup-builder GET]", err);
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 500 });
  }
}

/* ── DELETE: admin resets a specific series draft ── */

export async function DELETE(req: NextRequest) {
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
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { week, awayTeam, homeTeam } = body;
    if (!week || !awayTeam || !homeTeam) {
      return NextResponse.json({ error: "Missing week, awayTeam, or homeTeam" }, { status: 400 });
    }

    await pool.query(
      "DELETE FROM S9.matchup_draft WHERE week_label = ? AND away_team = ? AND home_team = ?",
      [week, awayTeam, homeTeam]
    );
    await pool.query(
      "DELETE FROM S9.matchup_draft_series WHERE week_label = ? AND away_team = ? AND home_team = ?",
      [week, awayTeam, homeTeam]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[matchup-builder DELETE]", err);
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 500 });
  }
}
