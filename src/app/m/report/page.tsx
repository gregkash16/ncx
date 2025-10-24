// src/app/m/report/page.tsx
import ReportPanel from "@/app/components/ReportPanel";

export const revalidate = 60;

export default async function MobileReportPage() {
  return (
    <section className="w-full">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
        <div className="sticky -top-1 z-10 -mx-2 mb-2 rounded-xl border border-neutral-800 bg-neutral-950/85 px-3 py-2 text-sm font-semibold text-neutral-200 backdrop-blur">
          Report a Game
        </div>

        <div className="mt-3">
          <ReportPanel />
        </div>
      </div>
    </section>
  );
}
