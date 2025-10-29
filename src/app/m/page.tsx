// src/app/m/page.tsx
import MobileCurrent from "./MobileCurrent";

export const revalidate = 60;

// Next 15: searchParams is a Promise on server components
export default async function MobileCurrentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const selectedWeek = (sp?.w as string | undefined) || undefined;

  // We only pass the raw requested week; MobileCurrent will validate it
  return <MobileCurrent selectedWeek={selectedWeek} />;
}
