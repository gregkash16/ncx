// src/app/m/standings/MobileStandings.tsx
// Server component (no 'use client')
import Link from "next/link";
import Image from "next/image";
import { teamSlug } from "@/lib/slug";
import { getSheets } from "@/lib/googleSheets";

console.log("[SSR] MobileStandings render", new Date().toISOString());

type Row = {
  rank: string;
  team: string;
  wins: string;
  losses: string;
  gameWins: string;
  points: string;
};

function Logo({
  name,
  size = 24,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const slug = teamSlug(name);
  const src = slug ? `/logos/${slug}.png` : `/logos/default.png`; // absolute path
  return (
    <Image
      src={src}
      alt={name || "Team"}
      width={size}
      height={size}
      className={["inline-block object-contain shrink-0", className || ""].join(" ")}
      unoptimized
      loading="lazy"
      decoding="async"
    />
  );
}

export default async function MobileStandings() {
  const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "OVERALL RECORD!A2:F25",
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = (res.data.values || []).filter(
    (r) =>
      (r?.[0] ?? "").toString().trim() !== "" &&
      (r?.[1] ?? "").toString().trim() !== ""
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
          {data.map((t, i) => {
            const slug = teamSlug(t.team);
            const href = slug ? `/m/team/${encodeURIComponent(slug)}` : undefined;

            const content = (
              <>
                {/* Top row: rank + team */}
                <div className="flex items-center gap-2">
                  <span className="w-6 text-right text-sm font-semibold text-neutral-400">
                    {t.rank || i + 1}
                  </span>
                  <Logo name={t.team} size={24} />
                  <span className="truncate text-sm font-medium text-neutral-200">
                    {t.team}
                  </span>
                </div>

                {/* Bottom row: stats — never wraps horizontally */}
                <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-neutral-300">
                  <div className="rounded-lg bg-neutral-900/60 px-2 py-1 text-center">
                    <div className="uppercase text-[10px] tracking-wide text-neutral-400">
                      W
                    </div>
                    <div className="font-semibold tabular-nums">{t.wins}</div>
                  </div>
                  <div className="rounded-lg bg-neutral-900/60 px-2 py-1 text-center">
                    <div className="uppercase text-[10px] tracking-wide text-neutral-400">
                      L
                    </div>
                    <div className="font-semibold tabular-nums">{t.losses}</div>
                  </div>
                  <div className="rounded-lg bg-neutral-900/60 px-2 py-1 text-center">
                    <div className="uppercase text-[10px] tracking-wide text-neutral-400">
                      GW
                    </div>
                    <div className="font-semibold tabular-nums">{t.gameWins}</div>
                  </div>
                  <div className="rounded-lg bg-neutral-900/60 px-2 py-1 text-center">
                    <div className="uppercase text-[10px] tracking-wide text-neutral-400">
                      Pts
                    </div>
                    <div className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 tabular-nums">
                      {t.points}
                    </div>
                  </div>
                </div>
              </>
            );

            return (
              <li
                key={`${t.rank}-${t.team}`}
                className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-2.5"
              >
                {href ? (
                  <Link href={href} className="block" prefetch={false}>
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>

        {/* Link to Playoff Bracket */}
        <div className="mt-4 flex justify-center">
          <Link
            href="/m/playoffs"
            prefetch={false}
            className="inline-block rounded-xl border border-cyan-500/40 bg-neutral-950/80 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400 transition"
          >
            🏆 View Playoff Bracket
          </Link>
        </div>
      </div>
    </section>
  );
}
