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

  // Active week name from SCHEDULE!U2
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

  // Pull A1:P120 like your bot
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${activeWeek}!A1:P120`,
  });
  const data = resp.data.values ?? [];

  // Walk rows 9, 19, 29, ... (1-based), i.e., indexes 8, 18, 28, ...
  const series: SeriesRow[] = [];
  for (let rowNum = 9; rowNum < 120; rowNum += 10) {
    const idx = rowNum - 1;
    const row = data[idx] ?? [];

    const awayTeam = (row[3] ?? "").toString().trim();   // D
    const awayWins = toInt(row[4]);                      // E
    const homeTeam = (row[11] ?? "").toString().trim();  // L
    const homeWins = toInt(row[12]);                     // M

    // Skip empty rows like the bot does
    const emptyTeams = (!awayTeam || awayTeam === "TBD") && (!homeTeam || homeTeam === "TBD");
    const emptyWins =
      (String(row[4] ?? "").trim() === "" || String(row[4]).trim() === "0" || String(row[4]).trim() === "-") &&
      (String(row[12] ?? "").trim() === "" || String(row[12]).trim() === "0" || String(row[12]).trim() === "-");

    if (emptyTeams && emptyWins) continue;

    series.push({ awayTeam, awayWins, homeTeam, homeWins });
  }

  // Format like your Discord embed:
  // winner bold CAPS, loser strikethrough; show ✅/❌ only when series is over (>=4 wins)
  const items = series.map((s) => {
    const seriesOver = s.awayWins >= 4 || s.homeWins >= 4;
    const awayWinner = seriesOver && s.awayWins >= 4 && s.awayWins > s.homeWins;
    const homeWinner = seriesOver && s.homeWins >= 4 && s.homeWins > s.awayWins;

    // Keep original team names for display and logo lookups
    const awayRaw = s.awayTeam;
    const homeRaw = s.homeTeam;

    const leftClasses = awayWinner
      ? "font-bold uppercase"
      : homeWinner
      ? "line-through"
      : "";

    const rightClasses = homeWinner
      ? "font-bold uppercase"
      : awayWinner
      ? "line-through"
      : "";

    const leftMarker = seriesOver ? (awayWinner ? "✅ " : homeWinner ? "❌ " : "") : "";
    const rightMarker = seriesOver ? (homeWinner ? " ✅" : awayWinner ? " ❌" : "") : "";

    return {
      awayRaw,
      homeRaw,
      leftClasses,
      rightClasses,
      leftMarker,
      rightMarker,
      awayWins: s.awayWins,
      homeWins: s.homeWins,
    };
  });


return (
  <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-purple-500/40 transition w-full">
    <h2 className="text-2xl font-extrabold text-center uppercase bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 text-transparent bg-clip-text drop-shadow-[0_0_20px_rgba(255,0,255,0.25)] mb-4 tracking-wide">
      Current Week — {activeWeek}
    </h2>

    {items.length === 0 ? (
      <p className="mt-2 text-zinc-400">No matchups found.</p>
    ) : (
      <ul className="mt-3 space-y-3 text-base">
        {items.map((m, i) => (
          <li
            key={i}
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 bg-zinc-950/60 border border-zinc-800 rounded-xl px-5 py-3"
          >
            {/* Left: logo + name (wrap allowed) */}
            <div className={`flex items-center justify-start text-zinc-300 ${m.leftClasses}`}>
              <TeamLogo team={m.awayRaw} side="left" />
              <span className="break-words">
                {m.leftMarker}
                {m.awayRaw}
              </span>
            </div>

            {/* Score */}
            <div className="text-center min-w-[5.5rem] font-semibold text-zinc-100">
              {m.awayWins} : {m.homeWins}
            </div>

            {/* Right: name + logo (wrap allowed, aligned right) */}
            <div className={`flex items-center justify-end text-zinc-300 ${m.rightClasses}`}>
              <span className="break-words">
                {m.homeRaw}
                {m.rightMarker}
              </span>
              <TeamLogo team={m.homeRaw} side="right" />
            </div>
          </li>
        ))}
      </ul>
    )}
  </div>
);


}
