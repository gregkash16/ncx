// Server Component: no 'use client'
import { getSheets } from "@/lib/googleSheets";
import TeamLogo from "../components/TeamLogo";

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

function WinBoxes({ wins }: { wins: number }) {
  const count = Math.max(0, Math.min(4, wins));
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 4 }).map((_, i) => {
        const filled = i >= 4 - count;
        return (
          <span
            key={i}
            className={[
              "inline-block size-3.5 rounded-[3px] border",
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

export default async function CurrentWeekCard() {
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

  const u2 = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "SCHEDULE!U2",
  });
  const activeWeek = u2.data.values?.[0]?.[0] as string | undefined;

  if (!activeWeek) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800">
        <h2 className="text-xl font-semibold text-pink-400">Current Week</h2>
        <p className="mt-2 text-zinc-400">
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

  const items = series.map((s) => {
    const seriesOver = s.awayWins >= 4 || s.homeWins >= 4;
    const awayWinner = seriesOver && s.awayWins >= 4 && s.awayWins > s.homeWins;
    const homeWinner = seriesOver && s.homeWins >= 4 && s.homeWins > s.awayWins;

    return {
      ...s,
      seriesOver,
      awayWinner,
      homeWinner,
    };
  });

  const GREEN = "34,197,94";
  const RED = "239,68,68";

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-purple-500/40 transition w-full">
      <h2 className="text-2xl font-extrabold text-center uppercase bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 text-transparent bg-clip-text drop-shadow-[0_0_20px_rgba(255,0,255,0.25)] mb-4 tracking-wide">
        Current Week — {activeWeek}
      </h2>

      {items.length === 0 ? (
        <p className="mt-2 text-zinc-400">No matchups found.</p>
      ) : (
        <ul className="mt-3 space-y-3 text-base">
          {items.map((m, i) => {
            // pick colors based on winner
            const leftColor = m.awayWinner ? GREEN : m.homeWinner ? RED : "0,0,0";
            const rightColor = m.homeWinner ? GREEN : m.awayWinner ? RED : "0,0,0";

            const gradientStyle: React.CSSProperties = {
              backgroundImage: `
                linear-gradient(to left, rgba(${leftColor},0.35), rgba(0,0,0,0) 35%),
                linear-gradient(to right, rgba(${rightColor},0.35), rgba(0,0,0,0) 35%)
              `,
            };

            return (
              <li
                key={i}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border border-zinc-800 rounded-xl px-5 py-3 bg-zinc-950/60 relative overflow-hidden"
                style={m.seriesOver ? gradientStyle : undefined}
              >
                {/* Left: logo + name */}
                <div
                  className={`flex items-center justify-start text-zinc-300 ${
                    m.awayWinner ? "font-bold uppercase" : m.homeWinner ? "line-through" : ""
                  }`}
                >
                  <TeamLogo team={m.awayTeam} side="left" />
                  <span className="break-words">{m.awayTeam}</span>
                </div>

                {/* Center: win boxes + score */}
                <div className="flex items-center justify-center gap-3 z-10">
                  <WinBoxes wins={m.awayWins} />
                  <div className="text-center min-w-[5.5rem] font-semibold text-zinc-100">
                    {m.awayWins} : {m.homeWins}
                  </div>
                  <WinBoxes wins={m.homeWins} />
                </div>

                {/* Right: name + logo */}
                <div
                  className={`flex items-center justify-end text-zinc-300 ${
                    m.homeWinner ? "font-bold uppercase" : m.awayWinner ? "line-through" : ""
                  }`}
                >
                  <span className="break-words">{m.homeTeam}</span>
                  <TeamLogo team={m.homeTeam} side="right" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
