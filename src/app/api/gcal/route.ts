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

async function fetchCalendarEvents(calendarId: string, key: string) {
  const now = new Date();
  const timeMin = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const url =
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events` +
    `?key=${encodeURIComponent(key)}` +
    `&singleEvents=true&orderBy=startTime` +
    `&timeMin=${encodeURIComponent(timeMin)}` +
    `&timeMax=${encodeURIComponent(timeMax)}` +
    `&timeZone=${encodeURIComponent(TIMEZONE)}` +
    `&maxResults=250`;

  const r = await fetch(url, { next: { revalidate: 60 } });
  if (!r.ok) return [];

  const data = await r.json();
  return (data.items ?? []).filter((e: any) => e.status !== "cancelled");
}

export async function GET() {
  const key = process.env.GOOGLE_CAL_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const batches = await Promise.all(
    CALENDARS.map(async (cal) => {
      const items = await fetchCalendarEvents(cal.id, key);
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

  const merged = batches.flat();
  merged.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  return NextResponse.json({ events: merged });
}