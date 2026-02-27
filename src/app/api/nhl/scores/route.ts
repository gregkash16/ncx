import { NextResponse } from "next/server";

export const runtime = "nodejs";

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * Returns YYYY-MM-DD in America/New_York, with the "day" rolling over at 11:00 AM ET.
 * So 00:00–10:59 ET maps to yesterday; 11:00–23:59 maps to today.
 */
function nhlDateWith11amRollover(now = new Date()): string {
  // Convert "now" to parts in America/New_York without relying on server TZ
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const hour = Number(get("hour"));

  // Build a UTC date corresponding to the ET calendar day (midnight ET),
  // then subtract one day if before 11:00 ET.
  // We avoid DST pitfalls by using the calendar components we already extracted.
  const utcMidnightOfETDay = new Date(Date.UTC(y, m - 1, d));

  const effective = hour < 11
    ? new Date(utcMidnightOfETDay.getTime() - 24 * 60 * 60 * 1000)
    : utcMidnightOfETDay;

  // Format as YYYY-MM-DD
  const yyyy = effective.getUTCFullYear();
  const mm = String(effective.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(effective.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Optional override:
  // - date=YYYY-MM-DD forces a specific date
  // - else we compute "effective" date with 11am ET rollover
  const forcedDate = searchParams.get("date");
  const date =
    forcedDate && /^\d{4}-\d{2}-\d{2}$/.test(forcedDate)
      ? forcedDate
      : nhlDateWith11amRollover(new Date());

  const upstream = `https://api-web.nhle.com/v1/score/${date}`;

  try {
    const res = await fetch(upstream, {
      cache: "no-store",
      headers: {
        "User-Agent": "ncx-secret-nhl-scores",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return json(
        { ok: false, status: res.status, statusText: res.statusText, upstream, date },
        { status: 502 }
      );
    }

    const data = await res.json();
    return json({ ok: true, upstream, date, data });
  } catch (err) {
    return json(
      {
        ok: false,
        upstream,
        date,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}