import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSheets } from "@/lib/googleSheets";
import { pool } from "@/lib/db";

/* ------------------------- helpers ------------------------- */
const ADMIN_DISCORD_ID = "349349801076195329" as const;

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "").trim().replace(/[<@!>]/g, "").replace(/\D/g, "");
}
function norm(v: unknown) {
  return String(v ?? "").trim();
}

async function getCaptainTeamsForDiscord(
  sheets: any,
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
    const disc = normalizeDiscordId(r?.[4]); // O
    if (team && disc === discordId) teams.push(team);
  }
  return teams;
}

/* ------------------------- GET /api/subs ------------------------- */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, reason: "NOT_AUTH" }, { status: 401 });
    }

    const raw = (session.user as any).discordId ?? (session.user as any).id;
    const discordId = normalizeDiscordId(raw);
    if (!discordId) {
      return NextResponse.json({ ok: false, reason: "NO_DISCORD_ID" }, { status: 400 });
    }

    const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
    const sheets = getSheets();

    const captainTeams = await getCaptainTeamsForDiscord(sheets, spreadsheetId, discordId);
    const isAdmin = discordId === ADMIN_DISCORD_ID;
    const isCaptain = captainTeams.length > 0;

    if (!isAdmin && !isCaptain) {
      return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
    }

    const [rows] = await pool.query<any[]>(
      `
      SELECT
        UPPER(s.NCXID) AS ncxid,
        dm.first_name AS first,
        dm.last_name AS last,
        CAST(dm.discord_id AS CHAR) AS discordId
        FROM Subs s
        JOIN discord_map dm
        ON UPPER(dm.ncxid) = UPPER(s.NCXID)
        ORDER BY CAST(s.NCXID AS UNSIGNED), dm.last_name, dm.first_name

      `
    );

    return NextResponse.json({ ok: true, subs: rows });
  } catch (e) {
    console.error("Subs GET error:", e);
    return NextResponse.json({ ok: false, reason: "SERVER_ERROR" }, { status: 500 });
  }
}
