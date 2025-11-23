// src/app/components/StandingsPanel.tsx
import Image from "next/image";
import { fetchOverallStandingsCached } from "@/lib/googleSheets";

function teamNameToSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default async function StandingsPanel() {
  let data: Awaited<ReturnType<typeof fetchOverallStandingsCached>> = [];
  let errorMsg: string | null = null;

  try {
    data = await fetchOverallStandingsCached();
  } catch (e: any) {
    // Graceful degrade on quota errors
    errorMsg =
      "We hit the Google Sheets read limit momentarily. Please try again in a minute.";
  }

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800">
      <h2 className="text-2xl font-bold tracking-wide text-center mb-4">
        <span className="text-pink-400">OVERALL</span>{" "}
        <span className="text-cyan-400">STANDINGS</span>
      </h2>

      {errorMsg ? (
        <p className="text-sm text-amber-300 text-center">{errorMsg}</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center">No data.</p>
      ) : (
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
                const href = `/?tab=team&team=${encodeURIComponent(slug)}`;

                return (
                  <tr
                    key={`${row.rank}-${row.team}`}
                    className="border-t border-zinc-800 hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-2 px-2">{row.rank}</td>
                    <td className="py-2 px-2">
                      <a
                        href={href}
                        className="flex items-center gap-3 min-w-0 hover:underline underline-offset-2"
                      >
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
                      </a>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {row.wins}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {row.losses}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {row.gameWins}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {row.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Link to Playoff Bracket */}
      <div className="mt-4 flex justify-center">
        <a
          href="/?tab=playoffs"
          className="inline-block rounded-xl border border-cyan-500/40 bg-zinc-950/70 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400 transition"
        >
          🏆 View Playoff Bracket
        </a>
      </div>
    </div>
  );
}
