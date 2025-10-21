import Link from "next/link";
import Image from "next/image";
import CurrentWeekCard from "./components/CurrentWeekCard";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSheets } from "@/lib/googleSheets";

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/[<@!>]/g, "")
    .replace(/\D/g, ""); // keep only digits
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  let message = "Please log in with your Discord.";

  if (session?.user) {
    try {
      const rawSessionId =
        (session.user as any).discordId ??
        (session.user as any).id;

      const sessionId = normalizeDiscordId(rawSessionId);

      if (sessionId) {
        const sheets = await getSheets();
        const spreadsheetId = process.env.NCX_LEAGUE_SHEET_ID!;
        const range = "Discord_ID!A:D";

        const res = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
          valueRenderOption: "FORMATTED_VALUE",
        });

        const rows = res.data.values || [];
        const match = rows.find((r) => normalizeDiscordId(r?.[3]) === sessionId);

        if (match) {
          const [ncxid, first, last] = match;
          message = `Welcome ${first} ${last}! – ${ncxid}`;
        } else {
          message = `Welcome ${session.user.name ?? "Pilot"}! – No NCXID Found.`;
        }
      } else {
        message = `Welcome ${session.user.name ?? "Pilot"}! – No Discord ID found`;
      }
    } catch (err) {
      console.error("Error fetching NCX info:", err);
      message = `Welcome ${session.user.name ?? "Pilot"}! – (Error fetching NCXID)`;
    }
  }

  return (
    <main className="min-h-screen overflow-visible bg-gradient-to-b from-[#0b0b16] via-[#1a1033] to-[#0b0b16] text-zinc-100">
      {/* Subtle animated glow background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,0,150,0.25),transparent_70%)] animate-pulse"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_120%,rgba(0,255,255,0.15),transparent_60%)] blur-3xl"></div>
      </div>

      {/* Hero Section */}
      <section className="relative max-w-6xl mx-auto px-6 pt-24 pb-6 text-center">
        <div className="flex flex-col items-center space-y-6">
          <Image
            src="/logo.png"
            alt="NCX Draft League Season 8"
            width={240}
            height={240}
            priority
            className="drop-shadow-[0_0_30px_rgba(255,0,150,0.5)] hover:scale-105 transition-transform duration-500"
          />

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 text-transparent bg-clip-text drop-shadow-[0_0_25px_rgba(255,0,255,0.25)]">
            DRAFT LEAGUE • SEASON 8
          </h1>

          {/* Dynamic greeting */}
          <p className="text-zinc-300 text-lg font-medium">{message}</p>

          <div className="flex flex-wrap justify-center gap-4 mt-3">
            <Link
              href="/standings"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-600 via-purple-500 to-cyan-500 text-white font-semibold shadow-lg shadow-pink-600/30 hover:scale-105 transition-transform duration-300"
            >
              View Standings
            </Link>
            <Link
              href="/report"
              className="px-6 py-3 rounded-xl bg-zinc-900 border border-purple-500/40 hover:border-cyan-400/60 text-white font-semibold hover:scale-105 transition-transform duration-300"
            >
              Report a Game
            </Link>
          </div>
        </div>
      </section>

      {/* Current Week only */}
      <section className="relative max-w-6xl mx-auto px-6 pb-24">
        <CurrentWeekCard />
      </section>
    </main>
  );
}
