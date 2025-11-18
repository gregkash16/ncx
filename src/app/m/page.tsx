// src/app/m/page.tsx
import HomeLanding from "@/app/components/HomeLanding";
import MobileCurrent from "./MobileCurrent";

export const revalidate = 60;

// Next 15: searchParams is a Promise on server components
export default async function MobileHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const selectedWeek = (sp?.w as string | undefined) || undefined;

  return (
    <div className="space-y-6 py-4">
      {/* Shared home card + team logos; links to mobile Ind Stats */}
      <HomeLanding
        className="mt-1"
        buildTeamHref={(team) =>
          `/m/indstats?indteam=${encodeURIComponent(team.filterValue)}`
        }
      />

      {/* Current week section below the home card */}
      <div>
        <MobileCurrent selectedWeek={selectedWeek} />
      </div>
    </div>
  );
}
