// src/app/m/page.tsx
import HomeLanding from "@/app/components/HomeLanding";

export const revalidate = 60;

export default function MobileHomePage() {
  return (
    <div className="space-y-8 py-4">
      <HomeLanding
        className="mt-1"
        rulesHref="/m/rules"
        buildTeamHref={(team) =>
          `/m/indstats?indteam=${encodeURIComponent(team.filterValue)}`
        }
      />

      {/* (Optional) You can delete this extra rules button now if you want */}
      {/* 
      <div className="flex justify-center">
        <a
          href="/m/rules"
          className="inline-block rounded-xl border border-neutral-700 bg-neutral-900/70 px-4 py-2 text-sm font-semibold text-neutral-100 hover:bg-neutral-800 transition"
        >
          📘 League Rules
        </a>
      </div>
      */}
    </div>
  );
}
