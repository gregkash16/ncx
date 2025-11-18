// src/app/m/team/[team]/page.tsx
import Link from "next/link";
import Image from "next/image";
import {
  fetchScheduleForTeam,
  TeamScheduleRow,
  getSheets,
} from "@/lib/googleSheets";
import { teamSlug } from "@/lib/slug";

/* ----------------------------- helpers ----------------------------- */
function normalizeWeekLabel(label: string): string {
  const s = String(label ?? "").trim();
  if (!s) return "WEEK 1";
  const m = s.match(/week\s*(\d+)/i);
  if (m) return `WEEK ${parseInt(m[1], 10)}`;
  const n = parseInt(s, 10);
  if (Number.isFinite(n) && n > 0) return `WEEK ${n}`;
  return s.toUpperCase();
}

function toInt(val: unknown): number {
  const s = String(val ?? "").trim();
  if (s === "" || s === "-" || s === "–" || s === "—") return 0;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

type Status = "SCHEDULED" | "IN PROGRESS" | "FINAL";

type EnrichedRow = TeamScheduleRow & {
  week: string;
  status: Status;
  awayWins: number;
  homeWins: number;
  seriesOver: boolean;
};

/**
 * Same idea as desktop: derive series W/L from the week sheet grid.
 */
async function deriveSeriesFromWeek(
  weekTab: string,
  away: string,
  home: string
) {
  const spreadsheetId =
    process.env.NCX_LEAGUE_SHEET_ID || process.env.SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) return { awayWins: 0, homeWins: 0, found: false };

  const sheets = getSheets();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${weekTab}!A1:Q120`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const data = resp.data.values ?? [];

  for (let rowNum = 9; rowNum < 120; rowNum += 10) {
    const idx = rowNum - 1;
    const row = data[idx] ?? [];
    const awayTeam = String(row[3] ?? "").trim();
    const homeTeam = String(row[11] ?? "").trim();
    if (!awayTeam && !homeTeam) continue;

    const matchesDirect = awayTeam === away && homeTeam === home;
    const matchesFlipped = awayTeam === home && homeTeam === away;
    if (!matchesDirect && !matchesFlipped) continue;

    const awayWins = toInt(row[4]);
    const homeWins = toInt(row[12]);

    if (matchesFlipped) {
      return { awayWins: homeWins, homeWins: awayWins, found: true };
    }
    return { awayWins, homeWins, found: true };
  }

  return { awayWins: 0, homeWins: 0, found: false };
}

async function enrichRowWithScore(
  row: TeamScheduleRow
): Promise<EnrichedRow> {
  const weekTab = normalizeWeekLabel(row.week);
  try {
    const { awayWins, homeWins, found } = await deriveSeriesFromWeek(
      weekTab,
      row.away,
      row.home
    );
    if (!found) {
      return {
        ...row,
        week: weekTab,
        status: "SCHEDULED",
        awayWins: 0,
        homeWins: 0,
        seriesOver: false,
      };
    }
    const seriesOver = awayWins >= 4 || homeWins >= 4;
    const status: Status =
      awayWins > 0 || homeWins > 0
        ? seriesOver
          ? "FINAL"
          : "IN PROGRESS"
        : "SCHEDULED";
    return { ...row, week: weekTab, status, awayWins, homeWins, seriesOver };
  } catch {
    return {
      ...row,
      week: weekTab,
      status: "SCHEDULED",
      awayWins: 0,
      homeWins: 0,
      seriesOver: false,
    };
  }
}

function StatusCell({
  row,
  teamName,
}: {
  row: EnrichedRow;
  teamName: string;
}) {
  if (row.status === "SCHEDULED") {
    return <span className="text-neutral-500 text-xs">Scheduled</span>;
  }
  if (row.status === "IN PROGRESS") {
    return (
      <span className="text-xs font-semibold text-yellow-300">
        In Progress
      </span>
    );
  }

  const viewingIsAway = row.away === teamName;
  const viewingIsHome = row.home === teamName;
  const viewingWon =
    (viewingIsAway && row.awayWins > row.homeWins) ||
    (viewingIsHome && row.homeWins > row.awayWins);
  const viewingLost =
    (viewingIsAway && row.awayWins < row.homeWins) ||
    (viewingIsHome && row.homeWins < row.awayWins);

  if (viewingWon) {
    return (
      <div className="flex items-center justify-end gap-1 text-[11px] text-green-400 font-semibold">
        <span>Winner</span>
        <Image
          src={`/logos/${teamSlug(teamName)}.png`}
          alt={`${teamName} logo`}
          width={20}
          height={20}
          className="object-contain rounded"
          unoptimized
        />
      </div>
    );
  }
  if (viewingLost) {
    return (
      <div className="flex items-center justify-end gap-1 text-[11px] text-red-400 font-semibold">
        <span>Loser</span>
        <Image
          src={`/logos/${teamSlug(teamName)}.png`}
          alt={`${teamName} logo`}
          width={20}
          height={20}
          className="object-contain rounded"
          unoptimized
        />
      </div>
    );
  }
  return <span className="text-xs text-neutral-400">Final</span>;
}

/* ----------------------------- PAGE ----------------------------- */

export default async function MobileTeamSchedulePage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team } = await params;
  const { teamName, rows } = await fetchScheduleForTeam(team);

  return (
    <div className="p-3">
      {!rows.length ? (
        <>
          <h2 className="text-lg font-bold text-neutral-100">
            Team Schedule
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            Couldn&apos;t find a schedule for “{team}”.
          </p>
        </>
      ) : (
        <>
          <header className="mb-3 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border border-neutral-700 bg-neutral-900">
              <Image
                src={`/logos/${teamSlug(teamName)}.png`}
                alt={`${teamName} logo`}
                width={32}
                height={32}
                className="object-contain"
                unoptimized
              />
            </span>
            <div>
              <h2 className="text-lg font-extrabold tracking-wide">
                <span className="text-cyan-400">{teamName}</span>{" "}
                <span className="text-neutral-200">Schedule</span>
              </h2>
              <p className="text-[11px] text-neutral-500">
                Tap a week to jump to that week on the Current tab.
              </p>
            </div>
          </header>

          <TeamTable rows={rows} teamName={teamName} />
        </>
      )}
    </div>
  );
}

async function TeamTable({
  rows,
  teamName,
}: {
  rows: TeamScheduleRow[];
  teamName: string;
}) {
  const enriched = await Promise.all(rows.map(enrichRowWithScore));

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-2">
      <table className="w-full text-left text-[13px] text-neutral-200">
        <thead className="text-[11px] uppercase text-neutral-400">
          <tr className="[&>th]:py-1.5 [&>th]:px-2">
            <th className="w-20">Week</th>
            <th className="w-[35%]">Away</th>
            <th className="w-[35%]">Home</th>
            <th className="text-right w-28">Status</th>
          </tr>
        </thead>
        <tbody>
          {enriched.map((r, i) => {
            const weekLabel = normalizeWeekLabel(r.week);

            // 🔧 FIX: go straight to /m/current, not /m
            const weekHref = `/m/current?w=${encodeURIComponent(weekLabel)}`;

            let rowTone = "";
            if (r.status === "FINAL") {
              const viewingIsAway = r.away === teamName;
              const viewingIsHome = r.home === teamName;
              const viewingWon =
                (viewingIsAway && r.awayWins > r.homeWins) ||
                (viewingIsHome && r.homeWins > r.awayWins);
              const viewingLost =
                (viewingIsAway && r.awayWins < r.homeWins) ||
                (viewingIsHome && r.homeWins < r.awayWins);

              if (viewingWon)
                rowTone = "bg-green-900/20 border-green-700/50";
              else if (viewingLost)
                rowTone = "bg-red-900/20 border-red-700/50";
            } else if (r.status === "IN PROGRESS") {
              rowTone = "bg-yellow-900/15 border-yellow-700/40";
            }

            return (
              <tr
                key={`${weekLabel}-${i}`}
                className={`border-t border-neutral-800 ${rowTone}`}
              >
                <td className="py-1.5 px-2 align-top">
                  <Link
                    href={weekHref}
                    prefetch={false}
                    className="text-xs text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
                  >
                    {weekLabel}
                  </Link>
                </td>
                <td className="py-1.5 px-2 align-top">
                  <div className="flex items-center gap-1 min-w-0">
                    <Image
                      src={`/logos/${teamSlug(r.away)}.png`}
                      alt={`${r.away} logo`}
                      width={20}
                      height={20}
                      className="object-contain rounded"
                      unoptimized
                    />
                    <span className="truncate text-xs">{r.away}</span>
                  </div>
                </td>
                <td className="py-1.5 px-2 align-top">
                  <div className="flex items-center gap-1 min-w-0">
                    <Image
                      src={`/logos/${teamSlug(r.home)}.png`}
                      alt={`${r.home} logo`}
                      width={20}
                      height={20}
                      className="object-contain rounded"
                      unoptimized
                    />
                    <span className="truncate text-xs">{r.home}</span>
                  </div>
                </td>
                <td className="py-1.5 px-2 text-right align-top">
                  <StatusCell row={r} teamName={teamName} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
