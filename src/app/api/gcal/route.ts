// src/app/api/gcal/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    url: "https://p129-caldav.icloud.com/published/2/MTAwOTYwNjgxNjEwMDk2MABFvRuSy29sHSI0mscRdtKX7YK_-BkdZ8aEj56WcJsf",
    color: "#a855f7",
    label: "iCloud",
  },
];

/* ---------------- NY TIME HELPERS ---------------- */

function todayKeyNY() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function nyOffsetISO(forDate: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    timeZoneName: "shortOffset",
  }).formatToParts(forDate);

  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = tz.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
  if (!m) return "Z";

  const rawH = Number(m[1]);
  const sign = rawH >= 0 ? "+" : "-";
  const hh = String(Math.abs(rawH)).padStart(2, "0");
  const mm = String(Number(m[2] ?? "0")).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

function toComparableNYMs(input: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const dayKey = input;
    const noonUTC = new Date(`${dayKey}T12:00:00Z`);
    const offset = nyOffsetISO(noonUTC);
    const d = new Date(`${dayKey}T12:00:00${offset}`);
    return d.getTime();
  }

  if (/[zZ]$/.test(input) || /[+-]\d{2}:\d{2}$/.test(input)) {
    return new Date(input).getTime();
  }

  const m = input.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})$/);
  if (!m) return new Date(input).getTime();

  const dayKey = m[1];
  const timePart = m[2];
  const noonUTC = new Date(`${dayKey}T12:00:00Z`);
  const offset = nyOffsetISO(noonUTC);
  return new Date(`${dayKey}T${timePart}${offset}`).getTime();
}

function tzDayKey(input: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const ms = toComparableNYMs(input);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function nowNYMs() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: TIMEZONE })
  ).getTime();
}

function isPastEvent(e: { start: string; end?: string; allDay: boolean }) {
  if (e.allDay) return false;
  const now = nowNYMs();
  const cmp = toComparableNYMs(e.end ?? e.start);
  return !isNaN(cmp) && cmp < now;
}

/* ---------------- GOOGLE ---------------- */

async function fetchGoogle(calendarId: string, key: string, timeMin: string, timeMax: string) {
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events` +
    `?key=${encodeURIComponent(key)}` +
    `&singleEvents=true&orderBy=startTime` +
    `&timeMin=${encodeURIComponent(timeMin)}` +
    `&timeMax=${encodeURIComponent(timeMax)}` +
    `&timeZone=${encodeURIComponent(TIMEZONE)}` +
    `&maxResults=250`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Google API ${r.status}`);
  const data = await r.json();
  return (data.items ?? []).filter((e: any) => e.status !== "cancelled");
}

/* ---------------- ICS ---------------- */

function withCacheBust(url: string) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}cb=${Date.now()}`;
}

function unfoldIcsLines(text: string) {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if (!line) continue;
    if (/^[ \t]/.test(line) && out.length) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out;
}

function parseIcsDate(value: string) {
  const v = value.trim();
  if (!v) return null;

  if (/^\d{8}$/.test(v)) {
    const y = v.slice(0, 4);
    const m = v.slice(4, 6);
    const d = v.slice(6, 8);
    return { iso: `${y}-${m}-${d}`, allDay: true };
  }

  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;

  const [_, yy, mo, dd, hh, mi, ss, z] = m;
  const iso = z
    ? `${yy}-${mo}-${dd}T${hh}:${mi}:${ss}Z`
    : `${yy}-${mo}-${dd}T${hh}:${mi}:${ss}`;

  return { iso, allDay: false };
}

function parseVeventsFromIcs(text: string) {
  const lines = unfoldIcsLines(text);
  const events: any[] = [];
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
      if (cur?.dtstart) events.push(cur);
      cur = null;
      continue;
    }
    if (!inEvent || !cur) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;

    const key = line.slice(0, idx).split(";")[0].toUpperCase();
    const value = line.slice(idx + 1);

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
  const r = await fetch(withCacheBust(url), {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache, no-store, max-age=0",
      Pragma: "no-cache",
    },
  });

  if (!r.ok) throw new Error(`ICS ${r.status}`);

  const text = await r.text();
  const vevents = parseVeventsFromIcs(text);
  const todayKey = todayKeyNY();

  return vevents.filter((e) => tzDayKey(e.dtstart) === todayKey);
}

/* ---------------- ROUTE ---------------- */

export async function GET() {
  try {
    const key = process.env.GOOGLE_CAL_API_KEY;
    if (!key)
      return NextResponse.json({ events: [] }, { status: 500 });

    const dayKey = todayKeyNY();

    const googleBatches = await Promise.all(
      CALENDARS.map(async (cal) => {
        const noonUTC = new Date(`${dayKey}T12:00:00Z`);
        const offset = nyOffsetISO(noonUTC);
        const start = new Date(`${dayKey}T00:00:00${offset}`).toISOString();
        const end = new Date(`${dayKey}T23:59:59.999${offset}`).toISOString();

        const items = await fetchGoogle(cal.id, key, start, end);
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

    const icsBatches = await Promise.all(
      ICAL_SOURCES.map(async (src) => {
        const items = await fetchIcsToday(src.url);
        return items.map((e) => ({
          id: `ics:${src.url}:${e.uid}`,
          title: e.summary ?? "(No title)",
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

    const filtered = merged
      .filter((e) => tzDayKey(e.start) === dayKey)
      .filter((e) => !isPastEvent(e));

    filtered.sort((a, b) => {
      const aAll = a.allDay ? 0 : 1;
      const bAll = b.allDay ? 0 : 1;
      if (aAll !== bAll) return aAll - bAll;
      return toComparableNYMs(a.start) - toComparableNYMs(b.start);
    });

    return NextResponse.json(
      { events: filtered },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ events: [] }, { status: 502 });
  }
}