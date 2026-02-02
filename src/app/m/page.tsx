// src/app/m/page.tsx
import HomeLanding from "../components/HomeLanding";
import { teamSlug } from "@/lib/slug";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDiscordMapCached, fetchFactionMapCached } from "@/lib/googleSheets";

export const revalidate = 60;

function normalizeDiscordId(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/[<@!>]/g, "")
    .replace(/\D/g, "");
}

export default async function MobileHomePage() {
  // --- Welcome banner (same logic as desktop, but simplified) ---
  const session = await getServerSession(authOptions);
  let message = "Please log in with your Discord.";

  if (session?.user) {
    try {
      const rawSessionId =
        (session.user as any).discordId ?? (session.user as any).id;
      const sessionId = normalizeDiscordId(rawSessionId);

      if (sessionId) {
        const discordMap = await getDiscordMapCached();
        const match = (discordMap as any)?.[sessionId];

        if (match) {
          const { ncxid, first, last } = match as any;
          message = `Welcome ${first} ${last}! – ${ncxid}`;
        } else {
          message = `Welcome ${session.user.name ?? "Pilot"}! – No NCXID Found.`;
        }
      } else {
        message = `Welcome ${session.user.name ?? "Pilot"}! – No Discord ID found`;
      }
    } catch (err) {
      console.error("Error fetching NCX info (mobile):", err);
      message = `Welcome ${session.user.name ?? "Pilot"}! – (Error fetching NCXID)`;
    }
  }

  // Factions for the matchup widget (by NCXID)
  const factionMap = await fetchFactionMapCached();

  return (
    <div className="space-y-8 py-4">
      <HomeLanding
        message={message}
        rulesHref="/m/rules"
        factionMap={factionMap ?? undefined}
        buildTeamHref={(team) =>
          `/m/team/${encodeURIComponent(teamSlug(team.filterValue))}`
        }
      />
    </div>
  );
}
