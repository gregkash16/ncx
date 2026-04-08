// src/app/m/podcast/page.tsx
import PodcastPanel from "@/app/components/PodcastPanel";

export const revalidate = 3600;

export default async function MobilePodcastPage() {
  return (
    <div className="py-4">
      <PodcastPanel />
    </div>
  );
}
