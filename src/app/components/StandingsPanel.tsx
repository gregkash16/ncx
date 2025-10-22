// src/app/components/StandingsPanel.tsx
import Image from "next/image";
import { getSheets } from "@/lib/googleSheets";

function teamNameToSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default async function StandingsPanel() {
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

  const data = rows.map((r) => ({
    rank: r[0] ?? "",
    team: r[1] ?? "",
    wins: r[2] ?? "",
    losses: r[3] ?? "",
    gameWins: r[4] ?? "",
    points: r[5] ?? "",
  }));

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800">
      <h2 className="text-2xl font-bold tracking-wide text-center mb-4">
        <span className="text-pink-400">OVERALL</span>{" "}
        <span className="text-cyan-400">STANDINGS</span>
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-zinc-200">
          <thead className="text-sm uppercase text-zinc-400">
            <tr className="[&>th]:py-2 [&>th]:px-2">
              <th className="w-14">Rank</th>
              <th>Team</th>
              <th className="text-right w-16">W</th>
              <th className="text-right w-16">L</th>
              <th className="text-right w-24">GW</th>
              <th className="text-right w-24">Pts</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {data.map((row) => {
              const slug = teamNameToSlug(row.team);
              const logoSrc = `/logos/${slug}.png`;

              return (
                <tr
                  key={`${row.rank}-${row.team}`}
                  className="border-t border-zinc-800 hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="py-2 px-2">{row.rank}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* We’ll wrap logo in a span that gracefully handles missing files */}
                      <span className="shrink-0 rounded-md overflow-hidden bg-zinc-800 border border-zinc-700 w-[28px] h-[28px] flex items-center justify-center">
                        <Image
                          src={logoSrc}
                          alt={`${row.team} logo`}
                          width={28}
                          height={28}
                          className="object-contain"
                          unoptimized
                        />
                      </span>
                      <span className="truncate">{row.team}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">{row.wins}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{row.losses}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{row.gameWins}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
