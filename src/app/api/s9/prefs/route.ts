import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { google } from "googleapis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function norm(v: any) {
  return v != null ? String(v).trim() : "";
}

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/[<@!>]/g, "")
    .replace(/\D/g, "");
}

function isAdminSession(session: any): boolean {
  // 1) If your auth already injects admin flags, honor them
  if (session?.user?.role === "admin") return true;
  if (session?.user?.isAdmin === true) return true;

  // 2) Fallback: env var list of Discord IDs
  const rawSessionId = (session?.user as any)?.discordId ?? (session?.user as any)?.id;
  const discordId = normalizeDiscordId(rawSessionId);

  const env = process.env.ADMIN_DISCORD_IDS ?? "";
  const allow = new Set(
    env
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  return discordId ? allow.has(discordId) : false;
}

async function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!email || !keyRaw) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_KEY");
  }
  const key = keyRaw.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

async function findRowByNcxidInColF(
  sheets: any,
  spreadsheetId: string,
  ncxid: string
): Promise<number | null> {
  // We scan column F starting at row 2 (skip header)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Sheet1!F2:F",
  });

  const values: string[][] = (res.data.values ?? []) as any;
  const target = String(ncxid).trim();

  for (let i = 0; i < values.length; i++) {
    const cell = norm(values[i]?.[0]);
    if (cell === target) {
      // row number in sheet = i offset + 2
      return i + 2;
    }
  }
  return null;
}

async function triggerSeed() {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_URL?.startsWith("http")
      ? process.env.VERCEL_URL
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  const key = process.env.SEED_API_KEY;
  if (!key) throw new Error("Missing SEED_API_KEY");

  const url = `${baseUrl}/api/seed-mysql?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Seed failed: ${res.status} ${txt}`);
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, reason: "NOT_AUTH" }, { status: 401 });
    }

    const rawSessionId = (session.user as any).discordId ?? (session.user as any).id;
    const discordId = normalizeDiscordId(rawSessionId);
    if (!discordId) {
      return NextResponse.json({ ok: false, reason: "NO_DISCORD_ID" }, { status: 400 });
    }

    // discord_map lookup
    const [dmRows] = await pool.query<any[]>(
      `
      SELECT ncxid
      FROM discord_map
      WHERE CAST(discord_id AS CHAR) = ?
      LIMIT 1
      `,
      [discordId]
    );

    const ncxid = norm(dmRows?.[0]?.ncxid);
    const isAdmin = isAdminSession(session);

    // admin total count (from MySQL table)
    let totalSignups: number | undefined = undefined;
    if (isAdmin) {
      const [cntRows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS c FROM S9.signups`
      );
      totalSignups = Number(cntRows?.[0]?.c ?? 0);
    }

    if (!ncxid) {
      return NextResponse.json({ ok: true, found: false, isAdmin, totalSignups });
    }

    const [rows] = await pool.query<any[]>(
      `
      SELECT ncxid, first_name, last_name, pref_one, pref_two, pref_three
      FROM S9.signups
      WHERE ncxid = ?
      LIMIT 1
      `,
      [ncxid]
    );

    const r = rows?.[0];
    if (!r) {
      return NextResponse.json({ ok: true, found: false, isAdmin, totalSignups });
    }

    return NextResponse.json({
      ok: true,
      found: true,
      ncxid: norm(r.ncxid),
      first_name: norm(r.first_name),
      last_name: norm(r.last_name),
      pref_one: norm(r.pref_one),
      pref_two: norm(r.pref_two),
      pref_three: norm(r.pref_three),
      isAdmin,
      totalSignups,
    });
  } catch (err: any) {
    console.error("GET /api/s9/prefs error:", err);
    return NextResponse.json(
      { ok: false, reason: err?.message ?? "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, reason: "NOT_AUTH" }, { status: 401 });
    }

    const rawSessionId = (session.user as any).discordId ?? (session.user as any).id;
    const discordId = normalizeDiscordId(rawSessionId);
    if (!discordId) {
      return NextResponse.json({ ok: false, reason: "NO_DISCORD_ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const pref_one = norm(body.pref_one);
    const pref_two = norm(body.pref_two);
    const pref_three = norm(body.pref_three);

    const allowed = new Set([
      "REPUBLIC",
      "CIS",
      "REBELS",
      "EMPIRE",
      "RESISTANCE",
      "FIRST ORDER",
      "SCUM",
    ]);
    if (!allowed.has(pref_one) || !allowed.has(pref_two) || !allowed.has(pref_three)) {
      return NextResponse.json({ ok: false, reason: "BAD_PREF" }, { status: 400 });
    }

    // discord_map → ncxid
    const [dmRows] = await pool.query<any[]>(
      `
      SELECT ncxid
      FROM discord_map
      WHERE CAST(discord_id AS CHAR) = ?
      LIMIT 1
      `,
      [discordId]
    );

    const ncxid = norm(dmRows?.[0]?.ncxid);
    if (!ncxid) {
      return NextResponse.json({ ok: false, reason: "NO_NCXID" }, { status: 400 });
    }

    // must exist in S9.signups (per your requirement)
    const [existing] = await pool.query<any[]>(
      `SELECT ncxid FROM S9.signups WHERE ncxid = ? LIMIT 1`,
      [ncxid]
    );
    if (!existing?.[0]) {
      return NextResponse.json({ ok: false, reason: "NOT_SIGNED_UP" }, { status: 404 });
    }

    const spreadsheetId = process.env.S9_SIGN_UP_SHEET_ID;
    if (!spreadsheetId) throw new Error("Missing S9_SIGN_UP_SHEET_ID");

    // Write to Google Sheet (Sheet1 assumed)
    const sheets = await getSheetsClient();
    const rowNum = await findRowByNcxidInColF(sheets, spreadsheetId, ncxid);

    if (!rowNum) {
      return NextResponse.json({ ok: false, reason: "ROW_NOT_FOUND" }, { status: 404 });
    }

    // pref_one = J, pref_two = K, pref_three = L
    const range = `Sheet1!J${rowNum}:L${rowNum}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values: [[pref_one, pref_two, pref_three]],
      },
    });

    // Now re-seed MySQL so S9.signups table is updated
    await triggerSeed();

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("POST /api/s9/prefs error:", err);
    return NextResponse.json(
      { ok: false, reason: err?.message ?? "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
