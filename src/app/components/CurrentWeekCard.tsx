// Server Component: no 'use client'
import Link from "next/link";
import { getSheets } from "@/lib/googleSheets";
import { teamSlug } from "@/lib/slug";

type SeriesRow = {
  awayTeam: string;
  awayWins: number;
  homeTeam: string;
  homeWins: number;
};

function toInt(val: unknown): number {
  const n = parseInt(String(val ?? "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function WinBoxes({ wins, direction = "right" }: { wins: number; direction?: "left" | "right" }) {
  const count = Math.max(0, Math.min(4, wins)); // clamp between 0–4
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 4 }).map((_, i) => {
        const filled =
          direction === "left" ? i < count : i >= 4 - count;
        return (
          <span
            key={i}
            className={[
              "inline-block size-3.5 rounded-[3px] border transition-colors duration-200",
              filled
                ? "bg-green-500/90 border-green-500/80 shadow-[0_0_6px_rgba(34,197,94,0.35)]"
                : "bg-zinc-800 border-zinc-700",
            ].join(" ")}
          />
        );
      })}
    </div>
  );
}

function Logo({
  name,
  side,
  size = 28,
  className = "",
}: {
  name: string;
  side: "left" | "right";
  size?: number;
  className?: string;
}) {
  const src = `/logos/${teamSlug(name)}.png`;
  return (
    <img
      src={src}
      alt={name || "Team"}
      width={size}
      height={size}
      className={[
        "inline-block shrink-0 object-contain",
        side === "left" ? "mr-2" : "ml-2",
        className,
      ].join(" ")}
      decoding="async"
      loading="lazy"
    />
  );
}

function parseWeekNum(label: string | undefined): number | null {
  if (!label) return null;
  const m = label.trim().match(/week\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}
function formatWeekLabel(n: number) {
  return `WEEK ${n}`;
}
function normalizeWeekTab(label?: string | null) {
  const n = parseWeekNum(label ?? undefined);
  if (n) return `WEEK ${n}`;
  return String(label ?? "").trim().toUpperCase() || "WEEK 1";
}

export default async function CurrentWeekCard({
  activeWeek,
  selectedWeek,
}: {
  activeWeek: string;
  selectedWeek?: string | null;
}) {
  const spreadsheetId =
    process.env.NCX_LEAGUE_SHEET_ID || process.env.SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800">
        <h2 className="text-xl font-semibold text-pink-400">Current Week</h2>
        <p className="mt-2 text-zinc-400">
          Missing env var <code>NCX_LEAGUE_SHEET_ID</code>.
        </p>
      </div>
    );
  }

  const sheets = getSheets();

  // Determine which week to display
  const showWeek = (selectedWeek && selectedWeek.trim()) || activeWeek || "WEEK 1";
  const targetTab = normalizeWeekTab(showWeek);

  const activeNum = parseWeekNum(activeWeek);
  const pastWeeks =
    activeNum && activeNum > 0
      ? Array.from({ length: activeNum }, (_, i) => formatWeekLabel(i + 1))
      : [];

  // Fetch data for targetTab with graceful handling
  let data: any[][] = [];
  try {
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetTab}!A1:Q120`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    data = resp.data.values ?? [];
  } catch (err: any) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-red-800/60">
        <h2 className="text-xl font-semibold text-red-400">Couldn’t load {targetTab}</h2>
        <p className="mt-2 text-zinc-400">
          {process.env.NODE_ENV !== "production" && (
            <>
              <span className="block">{String(err?.message ?? "Sheets API error")}</span>
              <span className="block mt-1 text-zinc-500">
                Checked range: <code>{`${targetTab}!A1:Q120`}</code>
              </span>
            </>
          )}
        </p>
      </div>
    );
  }

  const series: SeriesRow[] = [];
  for (let rowNum = 9; rowNum < 120; rowNum += 10) {
    const idx = rowNum - 1;
    const row = data[idx] ?? [];

    const awayTeam = (row[3] ?? "").toString().trim();
    const awayWins = toInt(row[4]);
    const homeTeam = (row[11] ?? "").toString().trim();
    const homeWins = toInt(row[12]);

    const emptyTeams =
      (!awayTeam || awayTeam === "TBD") && (!homeTeam || homeTeam === "TBD");
    const emptyWins =
      (String(row[4] ?? "").trim() === "" ||
        String(row[4]).trim() === "0" ||
        String(row[4]).trim() === "-") &&
      (String(row[12] ?? "").trim() === "" ||
        String(row[12]).trim() === "0" ||
        String(row[12]).trim() === "-");

    if (emptyTeams && emptyWins) continue;

    series.push({ awayTeam, awayWins, homeTeam, homeWins });
  }

  const items = series.map((s) => {
    const seriesOver = s.awayWins >= 4 || s.homeWins >= 4;
    const awayWinner = seriesOver && s.awayWins >= 4 && s.awayWins > s.homeWins;
    const homeWinner = seriesOver && s.homeWins >= 4 && s.homeWins > s.awayWins;
    return { ...s, seriesOver, awayWinner, homeWinner };
  });

  const GREEN = "34,197,94";
  const RED = "239,68,68";

  const btnBase =
    "group relative overflow-hidden rounded-xl border bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-pink-500/50";
  const gradient =
    "pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100";

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-purple-500/40 transition w-full">
      <h2 className="text-2xl font-extrabold text-center uppercase bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 text-transparent bg-clip-text drop-shadow-[0_0_20px_rgba(255,0,255,0.25)] mb-4 tracking-wide">
        {targetTab === normalizeWeekTab(activeWeek) ? "Current Week" : "Week View"} — {targetTab}
      </h2>

      {/* Week selector strip */}
      {activeNum && activeNum > 1 && (
        <div className="flex flex-wrap justify-center gap-2 mb-5">
          {pastWeeks.map((wk) => {
            const selected = wk.toUpperCase() === targetTab.toUpperCase();
            const isActive = wk.toUpperCase() === normalizeWeekTab(activeWeek).toUpperCase();
            const href = wk === activeWeek ? "?" : `?w=${encodeURIComponent(wk)}`;

            return (
              <Link
                key={wk}
                href={href}
                scroll={false}
                className={[
                  btnBase,
                  isActive
                    ? "border-yellow-400/70"
                    : selected
                    ? "border-cyan-400/60"
                    : "border-purple-500/40",
                ].join(" ")}
              >
                <span
                  className={[
                    gradient,
                    isActive
                      ? "bg-gradient-to-r from-yellow-400/20 via-amber-400/20 to-yellow-300/20"
                      : "bg-gradient-to-r from-pink-600/20 via-purple-500/20 to-cyan-500/20",
                    selected ? "opacity-100" : "",
                  ].join(" ")}
                />
                <span className="relative z-10">{wk}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Matchup grid */}
      {items.length === 0 ? (
        <p className="mt-2 text-zinc-400">No matchups found.</p>
      ) : (
        <ul className="mt-3 space-y-3 text-base">
          {items.map((m, i) => {
            const leftColor = m.awayWinner ? RED : m.homeWinner ? GREEN : "0,0,0";
            const rightColor = m.homeWinner ? RED : m.awayWinner ? GREEN : "0,0,0";

            const gradientStyle: React.CSSProperties = m.seriesOver
              ? {
                  backgroundImage: `
                    linear-gradient(to left, rgba(${leftColor},0.35), rgba(0,0,0,0) 35%),
                    linear-gradient(to right, rgba(${rightColor},0.35), rgba(0,0,0,0) 35%)
                  `,
                }
              : {};

            const q = `${m.awayTeam} ${m.homeTeam}`;
            const href = `/?tab=matchups&w=${encodeURIComponent(showWeek)}&q=${encodeURIComponent(q)}`;

            return (
              <li key={i} className="list-none">
                <Link
                  href={href}
                  scroll={false}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border border-zinc-800 rounded-xl px-5 py-3 bg-zinc-950/60 relative overflow-hidden hover:border-purple-500/50 hover:bg-zinc-900/40 cursor-pointer"
                  style={gradientStyle}
                >
                  {/* Away */}
                  <div
                    className={[
                      "flex items-center justify-start text-zinc-300",
                      m.awayWinner ? "font-bold uppercase" : m.homeWinner ? "line-through" : "",
                    ].join(" ")}
                  >
                    <Logo name={m.awayTeam} side="left" />
                    <span className="break-words">{m.awayTeam}</span>
                  </div>

                  {/* Center */}
                  <div className="flex items-center justify-center gap-3 z-10">
                    <WinBoxes wins={m.awayWins} direction="left" />
                    <div className="text-center min-w-[5.5rem] font-semibold text-zinc-100">
                      {m.awayWins} : {m.homeWins}
                    </div>
                    <WinBoxes wins={m.homeWins} direction="right" />
                  </div>

                  {/* Home */}
                  <div
                    className={[
                      "flex items-center justify-end text-zinc-300",
                      m.homeWinner ? "font-bold uppercase" : m.awayWinner ? "line-through" : "",
                    ].join(" ")}
                  >
                    <span className="break-words">{m.homeTeam}</span>
                    <Logo name={m.homeTeam} side="right" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
