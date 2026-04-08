// src/app/m/playoffs/page.tsx
import PlayoffsPanel from "@/app/components/PlayoffsPanel";

export const revalidate = 60;

export default async function MobilePlayoffsPage() {
  return (
    <div className="py-4">
      <PlayoffsPanel mobile />
    </div>
  );
}
