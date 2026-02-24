import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TIMEZONE = "America/New_York";

const CALENDARS = [
  { id: "greg@equatemedia.com", color: "#ff00cc", label: "Greg" },
  {
    id: "c_ed14f5995a544c9935ab6a0ad1e361e02768e5b7345909737c93dda1ee09fabc@group.calendar.google.com",
    color: "#8a2be2",
    label: "Shared",
  },
];

const ICAL_SOURCES = [
  {
    // webcal:// -> https://
    url: "https://p129-caldav.icloud.com/published/2/MTAwOTYwNjgxNjEwMDk2MABFvRuSy29sHSI0mscRdtKX7YK_-BkdZ8aEj56WcJsf",
    color: "#a855f7",
    label: "iCloud",
  },
];

// ---- time helpers ----
function todayKeyNY() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function tzDayKey(input: string) {
  // input is ISO dateTime or YYYY-MM-DD (all-day)
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const d = new Date(input);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function startEndOfTodayNY() {
  const now = new Date();
  const startNY = new Date(now.toLocaleString("en-US", { timeZone: TIMEZONE }));
  startNY.setHours(0, 0, 0, 0);
  const endNY = new Date(startNY);
  endNY.setHours(23, 59, 59, 999);
  return { startNY, endNY };
}

// ---- Google fetch ----
async function fetchGoogle(calendarId: string, key: string, timeMin: string, timeMax: string) {
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events` +
    `?key=${encodeURIComponent(key)}` +
    `&singleEvents=true&orderBy=startTime` +
    `&timeMin=${encodeURIComponent(timeMin)}` +
    `&timeMax=${encodeURIComponent(timeMax)}` +
    `&timeZone=${encodeURIComponent(TIMEZONE)}` +
    `&maxResults=250`;

  const r = await fetch(url, { next: { revalidate: 60 } });
  if (!r.ok) {
    const detail = await r.text();
    throw new Error(`Google API ${r.status}: ${detail.slice(0, 400)}`);
  }

  const data = await r.json();
  return (data.items ?? []).filter((e: any) => e.status !== "cancelled");
}

// ---- Minimal ICS parsing (no deps) ----
function unfoldIcsLines(text: string) {
  // RFC5545 line folding: lines starting with space/tab continue previous line
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if (!line) continue;
    if (/^[ \t]/.test(line) && out.length) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out;
}

function parseIcsDate(value: string): { iso: string; allDay: boolean } | null {
  // Common formats:
  // 1) YYYYMMDD (all-day)
  // 2) YYYYMMDDTHHMMSSZ (UTC)
  // 3) YYYYMMDDTHHMMSS (floating/local-ish)
  const v = value.trim();
  if (!v) return null;

  // all-day
  if (/^\d{8}$/.test(v)) {
    const y = v.slice(0, 4);
    const m = v.slice(4, 6);
    const d = v.slice(6, 8);
    return { iso: `${y}-${m}-${d}`, allDay: true };
  }

  // datetime
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;

  const [_, yy, mo, dd, hh, mi, ss, z] = m;
  const iso = z
    ? `${yy}-${mo}-${dd}T${hh}:${mi}:${ss}Z`
    : `${yy}-${mo}-${dd}T${hh}:${mi}:${ss}`; // floating time
  // If it's floating, JS Date will interpret in server tz; that’s not perfect.
  // Published iCloud feeds usually include Z or are consistent; for display this is acceptable.
  return { iso, allDay: false };
}

function parseVeventsFromIcs(text: string) {
  const lines = unfoldIcsLines(text);
  const events: Array<{
    uid: string;
    summary: string;
    dtstart: string;
    dtend?: string;
    allDay: boolean;
    location?: string;
  }> = [];

  let inEvent = false;
  let cur: any = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (cur?.dtstart) {
        events.push({
          uid: cur.uid ?? cur.dtstart,
          summary: cur.summary ?? "(No title)",
          dtstart: cur.dtstart,
          dtend: cur.dtend,
          allDay: Boolean(cur.allDay),
          location: cur.location ?? "",
        });
      }
      cur = null;
      continue;
    }
    if (!inEvent || !cur) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;

    const left = line.slice(0, idx);
    const value = line.slice(idx + 1);

    const key = left.split(";")[0].toUpperCase();

    if (key === "UID") cur.uid = value.trim();
    if (key === "SUMMARY") cur.summary = value.trim();
    if (key === "LOCATION") cur.location = value.trim();

    if (key === "DTSTART") {
      const parsed = parseIcsDate(value);
      if (parsed) {
        cur.dtstart = parsed.iso;
        cur.allDay = parsed.allDay;
      }
    }

    if (key === "DTEND") {
      const parsed = parseIcsDate(value);
      if (parsed) cur.dtend = parsed.iso;
    }
  }

  return events;
}

async function fetchIcsToday(url: string) {
  const r = await fetch(url, { next: { revalidate: 300 } });
  if (!r.ok) {
    const detail = await r.text();
    throw new Error(`ICS ${r.status}: ${detail.slice(0, 200)}`);
  }

  const text = await r.text();
  const vevents = parseVeventsFromIcs(text);
  const todayKey = todayKeyNY();

  // Keep only today in NY
  return vevents.filter((e) => tzDayKey(e.dtstart) === todayKey);
}

export async function GET() {
  try {
    const key = process.env.GOOGLE_CAL_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "Missing GOOGLE_CAL_API_KEY", events: [] }, { status: 500 });
    }

    const { startNY, endNY } = startEndOfTodayNY();
    const timeMin = startNY.toISOString();
    const timeMax = endNY.toISOString();

    // Google
    const googleBatches = await Promise.all(
      CALENDARS.map(async (cal) => {
        const items = await fetchGoogle(cal.id, key, timeMin, timeMax);
        return items.map((e: any) => ({
          id: `${cal.id}:${e.id}`,
          title: e.summary ?? "(No title)",
          start: e.start?.dateTime ?? e.start?.date,
          end: e.end?.dateTime ?? e.end?.date,
          allDay: Boolean(e.start?.date && !e.start?.dateTime),
          location: e.location ?? "",
          link: e.htmlLink ?? "",
          calendarLabel: cal.label,
          calendarColor: cal.color,
        }));
      })
    );

    // iCal
    const icsBatches = await Promise.all(
      ICAL_SOURCES.map(async (src) => {
        const items = await fetchIcsToday(src.url);
        return items.map((e) => ({
          id: `ics:${src.url}:${e.uid}`,
          title: e.summary,
          start: e.dtstart,
          end: e.dtend,
          allDay: e.allDay,
          location: e.location ?? "",
          link: "",
          calendarLabel: src.label,
          calendarColor: src.color,
        }));
      })
    );

    const merged = [...googleBatches.flat(), ...icsBatches.flat()];

    // Today only (extra safety)
    const todayKey = todayKeyNY();
    const filtered = merged.filter((e) => tzDayKey(e.start) === todayKey);

    filtered.sort((a, b) => {
      const aAll = a.allDay ? 0 : 1;
      const bAll = b.allDay ? 0 : 1;
      if (aAll !== bAll) return aAll - bAll;
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });

    return NextResponse.json({ events: filtered });
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message ?? err), events: [] },
      { status: 502 }
    );
  }
}