// src/app/m/current/page.tsx
import CurrentWeekCard from "@/app/components/CurrentWeekCard";
import { getActiveWeekFromDb } from "@/lib/matchupsDb";

export const revalidate = 60;

export default async function MobileCurrentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const selectedWeek = (sp?.w as string | undefined) || undefined;
  const activeWeek = await getActiveWeekFromDb();

  return (
    <div className="py-4">
      <CurrentWeekCard activeWeek={activeWeek} selectedWeek={selectedWeek} mobile />
    </div>
  );
}
