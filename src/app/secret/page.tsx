// src/app/secret/page.tsx
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CalEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  location?: string;
  link?: string;
  calendarLabel: string;
  calendarColor: string;
};

const TIMEZONE = "America/New_York";

/* ---------------- NY TIME HELPERS ---------------- */

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

function toNYDate(input: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;

  if (/[zZ]$/.test(input) || /[+-]\d{2}:\d{2}$/.test(input)) {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  const m = input.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})$/);
  if (!m) {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  const dayKey = m[1];
  const timePart = m[2];
  const noonUTC = new Date(`${dayKey}T12:00:00Z`);
  const offset = nyOffsetISO(noonUTC);
  const d = new Date(`${dayKey}T${timePart}${offset}`);
  return isNaN(d.getTime()) ? null : d;
}

function tzDayKey(input: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const d = toNYDate(input) ?? new Date(input);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function formatDayLabel(dayKey: string) {
  const d = new Date(`${dayKey}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  })
    .format(d)
    .toUpperCase();
}

function formatTime(e: Pick<CalEvent, "allDay" | "start">) {
  if (e.allDay) return "ALL DAY";

  const d = toNYDate(e.start) ?? new Date(e.start);
  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  })
    .format(d)
    .toUpperCase();
}

/* ---------------- DATA ---------------- */

async function getBaseUrlFromHeaders() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) return "http://localhost:3000";
  return `${proto}://${host}`;
}

async function getEvents(): Promise<CalEvent[]> {
  const base = await getBaseUrlFromHeaders();
  const res = await fetch(`${base}/api/gcal`, { cache: "no-store" });

  if (!res.ok) return [];

  const data = (await res.json()) as { events?: CalEvent[] };
  return data.events ?? [];
}

/* ---------------- PAGE ---------------- */

export default async function SecretPage() {
  const events = await getEvents();

  const grouped: Record<string, CalEvent[]> = {};
  for (const e of events) {
    const key = tzDayKey(e.start);
    (grouped[key] ??= []).push(e);
  }

  const sortedDays = Object.keys(grouped).sort();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: 36,
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {sortedDays.length === 0 ? (
          <div
            style={{
              fontSize: 32,
              fontWeight: 900,
              letterSpacing: 2,
              background: "linear-gradient(90deg, #ff00cc, #8a2be2)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              opacity: 0.9,
            }}
          >
            NO EVENTS TODAY
          </div>
        ) : (
          sortedDays.map((dayKey, idx) => (
            <section key={dayKey}>
              {idx !== 0 && (
                <div
                  style={{
                    height: 2,
                    background: "linear-gradient(90deg, #ff00cc, #8a2be2)",
                    margin: "28px 0",
                    opacity: 0.6,
                  }}
                />
              )}

              <div
                style={{
                  fontSize: 40,
                  fontWeight: 900,
                  letterSpacing: 1.5,
                  marginBottom: 16,
                  lineHeight: 1.05,
                  background: "linear-gradient(90deg, #ff00cc, #8a2be2)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {formatDayLabel(dayKey)}
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                {grouped[dayKey].map((e) => (
                  <div
                    key={e.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "140px 1fr",
                      gap: 18,
                      alignItems: "center",
                      padding: "12px 16px",
                      background: "#0b0b0b",
                      borderRadius: 12,
                      borderLeft: `4px solid ${e.calendarColor}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        opacity: 0.95,
                        color: "#c084fc",
                      }}
                    >
                      {formatTime(e)}
                    </div>

                    <div style={{ display: "grid", gap: 6 }}>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 650,
                          lineHeight: 1.15,
                        }}
                      >
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
                          <span style={{ fontSize: 12, opacity: 0.65 }}>
                            {e.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}