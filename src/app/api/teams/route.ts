import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  try {
    const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!.replace(/\\n/g, "\n");

    if (!spreadsheetId || !clientEmail || !privateKey) {
      throw new Error("Missing Google Sheets environment variables");
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "NCXID!K2:K25",
      valueRenderOption: "FORMATTED_VALUE",
    });

    const rows = res.data.values?.flat().filter((v) => !!v) ?? [];
    const teams = [...new Set(rows.map((v) => String(v).trim()))];

    return NextResponse.json({ ok: true, teams });
  } catch (err) {
    console.error("❌ Error fetching teams:", err);
    return NextResponse.json({ ok: false, error: "Failed to load team list" }, { status: 500 });
  }
}
