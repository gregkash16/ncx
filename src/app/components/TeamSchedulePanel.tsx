// src/app/components/TeamSchedulePanel.tsx
import Link from "next/link";
import Image from "next/image";
import { fetchScheduleForTeam, TeamScheduleRow, getSheets } from "@/lib/googleSheets";
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

type PanelMode = "desktop" | "mobile";

/**
 * Read the week grid (A1:Q120) and derive wins like CurrentWeekCard:
 * - Away Team = col D (index 3)
 * - Away Wins = col E (index 4)
 * - Home Team = col L (index 11)
 * - Home Wins = col M (index 12)
 * We scan each 10-row block starting at visual row 10 (idx 9): 9, 19, 29, ... 119
 */
async function deriveSeriesFromWeek(weekTab: string, away: string, home: string) {
  const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID || process.env.SHEETS_SPREADSHEET_ID;
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

async function enrichRowWithScore(row: TeamScheduleRow): Promise<EnrichedRow> {
  const weekTab = normalizeWeekLabel(row.week);
  try {
    const { awayWins, homeWins, found } = await deriveSeriesFromWeek(weekTab, row.away, row.home);
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
      awayWins > 0 || homeWins > 0 ? (seriesOver ? "FINAL" : "IN PROGRESS") : "SCHEDULED";
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

function StatusCell({ row, teamName }: { row: EnrichedRow; teamName: string }) {
  if (row.status === "SCHEDULED") {
    return <span className="text-zinc-500">Scheduled</span>;
  }
  if (row.status === "IN PROGRESS") {
    return <span className="font-semibold text-yellow-300">In Progress</span>;
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
      <div className="flex items-center justify-end gap-2 text-green-400 font-semibold">
        <span>Winner</span>
        <Image
          src={`/logos/${teamSlug(teamName)}.png`}
          alt={`${teamName} logo`}
          width={24}
          height={24}
          className="object-contain rounded"
          unoptimized
        />
      </div>
    );
  }
  if (viewingLost) {
    return (
      <div className="flex items-center justify-end gap-2 text-red-400 font-semibold">
        <span>Loser</span>
        <Image
          src={`/logos/${teamSlug(teamName)}.png`}
          alt={`${teamName} logo`}
          width={24}
          height={24}
          className="object-contain rounded"
          unoptimized
        />
      </div>
    );
  }
  return <span className="text-zinc-400">Final</span>;
}

/* ----------------------------- PANEL ----------------------------- */

type TeamSchedulePanelProps = {
  team: string;
  /** desktop = "/?tab=current&w=...", mobile = "/m/current?w=..." */
  mode?: PanelMode;
};

export default async function TeamSchedulePanel({
  team,
  mode = "desktop",
}: TeamSchedulePanelProps) {
  const { teamName, rows } = await fetchScheduleForTeam(team);

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800">
      {!rows.length ? (
        <>
          <h2 className="text-2xl font-bold">Team Schedule</h2>
          <p className="mt-2 text-zinc-400">Couldn’t find a schedule for “{team}”.</p>
        </>
      ) : (
        <>
          <header className="flex items-center gap-3 mb-4">
            <span className="shrink-0 rounded-md overflow-hidden bg-zinc-800 border border-zinc-700 w-[36px] h-[36px] flex items-center justify-center">
              <Image
                src={`/logos/${teamSlug(teamName)}.png`}
                alt={`${teamName} logo`}
                width={36}
                height={36}
                className="object-contain"
                unoptimized
              />
            </span>
            <h2 className="text-2xl font-extrabold tracking-wide">
              <span className="text-cyan-400">{teamName}</span>{" "}
              <span className="text-zinc-200">Schedule</span>
            </h2>
          </header>

          <TeamTable rows={rows} teamName={teamName} mode={mode} />
        </>
      )}
    </div>
  );
}

async function TeamTable({
  rows,
  teamName,
  mode,
}: {
  rows: TeamScheduleRow[];
  teamName: string;
  mode: PanelMode;
}) {
  const enriched = await Promise.all(rows.map(enrichRowWithScore));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-zinc-200">
        <thead className="text-sm uppercase text-zinc-400">
          <tr className="[&>th]:py-2 [&>th]:px-2">
            <th className="w-24">Week</th>
            <th className="w-[40%]">Away</th>
            <th className="w-[40%]">Home</th>
            <th className="text-right w-36">Status</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {enriched.map((r, i) => {
            const weekLabel = normalizeWeekLabel(r.week);

            // 🔒 Use explicit string URLs so they can't get rewritten to `?w=...` on `/m`.
            const weekHref =
              mode === "mobile"
                ? `/m/current?w=${encodeURIComponent(weekLabel)}`
                : `/?tab=current&w=${encodeURIComponent(weekLabel)}`;

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

              if (viewingWon) rowTone = "bg-green-900/20 border-green-700/50";
              else if (viewingLost) rowTone = "bg-red-900/20 border-red-700/50";
            } else if (r.status === "IN PROGRESS") {
              rowTone = "bg-yellow-900/15 border-yellow-700/40";
            }

            return (
              <tr key={`${weekLabel}-${i}`} className={`border-t border-zinc-800 ${rowTone}`}>
                {/* Week → link to Current Week (desktop) or Mobile Current (mobile) */}
                <td className="py-2 px-2">
                  <Link
                    href={weekHref}
                    prefetch={false}
                    className="text-cyan-300 hover:text-cyan-200 underline-offset-2 hover:underline"
                  >
                    {weekLabel}
                  </Link>
                </td>

                {/* Away */}
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Image
                      src={`/logos/${teamSlug(r.away)}.png`}
                      alt={`${r.away} logo`}
                      width={24}
                      height={24}
                      className="object-contain rounded"
                      unoptimized
                    />
                    <span className="truncate">{r.away}</span>
                  </div>
                </td>

                {/* Home */}
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Image
                      src={`/logos/${teamSlug(r.home)}.png`}
                      alt={`${r.home} logo`}
                      width={24}
                      height={24}
                      className="object-contain rounded"
                      unoptimized
                    />
                    <span className="truncate">{r.home}</span>
                  </div>
                </td>

                {/* Status → Winner/Loser/In Progress */}
                <td className="py-2 px-2 text-right">
                  <StatusCell row={r} teamName={teamName} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-6 text-sm text-zinc-400">
        Click any <span className="text-cyan-300">Week</span> to jump to the{" "}
        <span className="text-cyan-300">
          {mode === "mobile" ? "Mobile Current Week" : "Current Week"}
        </span>{" "}
        view with that week selected.
      </div>
    </div>
  );
}
