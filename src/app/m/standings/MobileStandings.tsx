// src/app/m/standings/MobileStandings.tsx
// Server component (no 'use client')
import TeamLogo from "@/app/components/TeamLogo";
import { getSheets } from "@/lib/googleSheets";

type Row = {
  rank: string;
  team: string;
  wins: string;
  losses: string;
  gameWins: string;
  points: string;
};

export default async function MobileStandings() {
  const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "OVERALL RECORD!A2:F25",
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = (res.data.values || []).filter(
    (r) => (r?.[0] ?? "").toString().trim() !== "" && (r?.[1] ?? "").toString().trim() !== ""
  );

  const data: Row[] = rows.map((r) => ({
    rank: String(r[0] ?? ""),
    team: String(r[1] ?? ""),
    wins: String(r[2] ?? ""),
    losses: String(r[3] ?? ""),
    gameWins: String(r[4] ?? ""),
    points: String(r[5] ?? ""),
  }));

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 text-center text-neutral-300">
        No standings data found.
      </div>
    );
  }

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
        <h2 className="mb-3 text-xl font-extrabold tracking-wide bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
          Standings
        </h2>

        <ul className="space-y-2">
          {data.map((t, i) => (
            <li
              key={`${t.rank}-${t.team}`}
              className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-2.5"
            >
              {/* Top row: rank + team */}
              <div className="flex items-center gap-2">
                <span className="w-6 text-right text-sm font-semibold text-neutral-400">
                  {t.rank || i + 1}
                </span>
                <TeamLogo team={t.team} className="h-6 w-6" />
                <span className="truncate text-sm font-medium text-neutral-200">
                  {t.team}
                </span>
              </div>

              {/* Bottom row: stats — never wraps horizontally */}
              <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-neutral-300">
                <div className="rounded-lg bg-neutral-900/60 px-2 py-1 text-center">
                  <div className="uppercase text-[10px] tracking-wide text-neutral-400">W</div>
                  <div className="font-semibold tabular-nums">{t.wins}</div>
                </div>
                <div className="rounded-lg bg-neutral-900/60 px-2 py-1 text-center">
                  <div className="uppercase text-[10px] tracking-wide text-neutral-400">L</div>
                  <div className="font-semibold tabular-nums">{t.losses}</div>
                </div>
                <div className="rounded-lg bg-neutral-900/60 px-2 py-1 text-center">
                  <div className="uppercase text-[10px] tracking-wide text-neutral-400">GW</div>
                  <div className="font-semibold tabular-nums">{t.gameWins}</div>
                </div>
                <div className="rounded-lg bg-neutral-900/60 px-2 py-1 text-center">
                  <div className="uppercase text-[10px] tracking-wide text-neutral-400">Pts</div>
                  <div className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 tabular-nums">
                    {t.points}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
