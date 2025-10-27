// src/app/m/MobileCurrent.tsx
// Server Component (no 'use client')
import type React from "react";
import Image from "next/image";
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

// Small helper: absolute, basePath-aware, clean PNG with transparency.
function Logo({
  name,
  size = 28,
  className = "",
  side,
}: {
  name: string;
  size?: number;
  className?: string;
  side: "left" | "right";
}) {
  const slug = teamSlug(name);
  const src = slug ? `/logos/${slug}.png` : `/logos/default.png`;
  return (
    <Image
      src={src}              // absolute path (leading slash)
      alt={name || "Team"}
      width={size}
      height={size}
      className={[
        "inline-block object-contain shrink-0",
        side === "left" ? "mr-2" : "ml-2",
        className || "",
      ].join(" ")}
      unoptimized
      loading="lazy"
      decoding="async"
    />
  );
}

export default async function MobileCurrent() {
  const spreadsheetId =
    process.env.NCX_LEAGUE_SHEET_ID || process.env.SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <h2 className="text-lg font-semibold text-pink-400">Current Week</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Missing env var <code>NCX_LEAGUE_SHEET_ID</code>.
        </p>
      </div>
    );
  }

  const sheets = getSheets();
  const u2 = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "SCHEDULE!U2",
  });
  const activeWeek = u2.data.values?.[0]?.[0] as string | undefined;

  if (!activeWeek) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <h2 className="text-lg font-semibold text-pink-400">Current Week</h2>
        <p className="mt-2 text-sm text-zinc-400">
          No active week found (SCHEDULE!U2 is empty).
        </p>
      </div>
    );
  }

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${activeWeek}!A1:P120`,
  });
  const data = resp.data.values ?? [];

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

  if (!series.length) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <h2 className="text-lg font-semibold text-pink-400">Current Week</h2>
        <p className="mt-2 text-sm text-zinc-400">No matchups found.</p>
      </div>
    );
  }

  // winner/loser ONLY when someone reaches 4+
  const GREEN = "34,197,94";
  const RED = "239,68,68";

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold uppercase tracking-wide bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Current Week
          </h2>
          <span className="rounded-full border border-neutral-700 bg-neutral-950/70 px-2.5 py-1 text-xs text-neutral-300">
            {activeWeek}
          </span>
        </div>

        <ul className="mt-4 space-y-3">
          {series.map((m, i) => {
            const away = m.awayWins;
            const home = m.homeWins;

            const seriesOver = away >= 4 || home >= 4;
            let winner: "away" | "home" | "none" = "none";
            if (seriesOver) {
              if (away > home) winner = "away";
              else if (home > away) winner = "home";
            }

            const leftColor =
              winner === "away" ? GREEN : winner === "home" ? RED : "0,0,0";
            const rightColor =
              winner === "home" ? GREEN : winner === "away" ? RED : "0,0,0";

            const gradientStyle: React.CSSProperties = seriesOver
              ? {
                  backgroundImage: `
                    linear-gradient(to right, rgba(${leftColor},0.35) 0%, rgba(0,0,0,0) 25%),
                    linear-gradient(to left,  rgba(${rightColor},0.35) 0%, rgba(0,0,0,0) 25%)
                  `,
                }
              : {};

            return (
              <li key={i} className="list-none">
                <div
                  className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 hover:border-purple-500/50 hover:bg-zinc-900/40"
                  style={gradientStyle}
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Away */}
                    <div
                      className={[
                        "flex min-w-0 items-center gap-2 text-zinc-200",
                        seriesOver && winner === "away"
                          ? "font-bold uppercase"
                          : seriesOver && winner === "home"
                          ? "line-through"
                          : "",
                      ].join(" ")}
                    >
                      <Logo name={m.awayTeam} side="left" size={28} />
                      <span className="truncate text-sm">{m.awayTeam || "TBD"}</span>
                    </div>

                    <span className="text-xs text-zinc-400">vs</span>

                    {/* Home */}
                    <div
                      className={[
                        "flex min-w-0 items-center gap-2 justify-end text-zinc-200",
                        seriesOver && winner === "home"
                          ? "font-bold uppercase"
                          : seriesOver && winner === "away"
                          ? "line-through"
                          : "",
                      ].join(" ")}
                    >
                      <span className="truncate text-sm">{m.homeTeam || "TBD"}</span>
                      <Logo name={m.homeTeam} side="right" size={28} />
                    </div>
                  </div>

                  {/* Score */}
                  <div className="mt-2 text-center text-sm font-semibold text-zinc-100">
                    {away} : {home}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
