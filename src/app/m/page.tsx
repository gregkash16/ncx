// src/app/m/page.tsx
import HomeLanding from "../components/HomeLanding";
import { teamSlug } from "@/lib/slug";

export const revalidate = 60;

export default function MobileHomePage() {
  return (
    <div className="space-y-8 py-4">
      <HomeLanding
        rulesHref="/m/rules"
        buildTeamHref={(team) =>
          `/m/team/${encodeURIComponent(teamSlug(team.filterValue))}`
        }
      />
    </div>
  );
}
