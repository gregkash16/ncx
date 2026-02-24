export const runtime = "nodejs";

type CalEvent = {
  id: string;
  title: string;
  start: string; // ISO or YYYY-MM-DD
  end?: string;
  allDay: boolean;
  location?: string;
  link?: string;
  calendarLabel: string;
  calendarColor: string;
};

const TIMEZONE = "America/New_York";

const CALENDARS = [
  { id: "greg@equatemedia.com", color: "#ff00cc", label: "Greg" },
  {
    id: "c_ed14f5995a544c9935ab6a0ad1e361e02768e5b7345909737c93dda1ee09fabc@group.calendar.google.com",
    color: "#8a2be2",
    label: "Shared",
  },
];

function formatDayLabel(dateStr: string) {
  // dateStr is YYYY-MM-DD
  const d = new Date(`${dateStr}T00:00:00`);
  return d
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase(); // "FEB 24"
}

function formatTime(e: CalEvent) {
  if (e.allDay) return "ALL DAY";
  const d = new Date(e.start);
  return d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .toUpperCase();
}

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

async function getEvents(): Promise<CalEvent[]> {
  const key = process.env.GOOGLE_CAL_API_KEY;
  if (!key) return [];

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

  // Sort by start time (all-day YYYY-MM-DD sorts fine as ISO-ish)
  merged.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Get today's date in America/New_York
    const now = new Date();
    const todayNY = new Date(
    now.toLocaleString("en-US", { timeZone: TIMEZONE })
    );
    const todayKey = todayNY.toISOString().split("T")[0];

    // Keep only events that match today
    return merged.filter((e) => {
    const d = new Date(e.start);
    const ny = new Date(
        d.toLocaleString("en-US", { timeZone: TIMEZONE })
    );
    const key = ny.toISOString().split("T")[0];
    return key === todayKey;
    });
    }

export default async function SecretPage() {
  const events = await getEvents();

  // Group events by day (YYYY-MM-DD in America/New_York)
  const grouped: Record<string, CalEvent[]> = {};

  for (const e of events) {
    // Convert to NY date key for grouping
    const d = new Date(e.start);
    const ny = new Date(
      d.toLocaleString("en-US", { timeZone: TIMEZONE })
    );
    const key = ny.toISOString().split("T")[0]; // YYYY-MM-DD
    (grouped[key] ??= []).push(e);
  }

  const sortedDays = Object.keys(grouped).sort();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: 50,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {sortedDays.length === 0 && (
          <div style={{ opacity: 0.7 }}>No upcoming events.</div>
        )}

        {sortedDays.map((dayKey, idx) => (
          <section key={dayKey}>
            {/* Divider between days */}
            {idx !== 0 && (
              <div
                style={{
                  height: 2,
                  background: "linear-gradient(90deg, #ff00cc, #8a2be2)",
                  margin: "50px 0",
                  opacity: 0.6,
                }}
              />
            )}

            {/* Date Label */}
            <div
              style={{
                fontSize: 54,
                fontWeight: 900,
                letterSpacing: 4,
                marginBottom: 28,
                background: "linear-gradient(90deg, #ff00cc, #8a2be2)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {formatDayLabel(dayKey)}
            </div>

            {/* Events */}
            <div style={{ display: "grid", gap: 18 }}>
              {grouped[dayKey].map((e) => (
                <div
                  key={e.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 1fr",
                    gap: 24,
                    alignItems: "center",
                    padding: "14px 18px",
                    background: "#0b0b0b",
                    borderRadius: 12,
                    borderLeft: `4px solid ${e.calendarColor}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      opacity: 0.95,
                      color: "#c084fc",
                    }}
                  >
                    {formatTime(e)}
                  </div>

                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.15 }}>
                      {e.title}
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 12,
                          letterSpacing: 1,
                          opacity: 0.75,
                          textTransform: "uppercase",
                        }}
                      >
                        {e.calendarLabel}
                      </span>

                      {e.location && (
                        <span style={{ fontSize: 12, opacity: 0.65 }}>{e.location}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}