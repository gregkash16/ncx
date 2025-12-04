// /src/app/(desktop)/teams/[slug]/page.tsx

import { redirect } from "next/navigation";

export default function TeamRoute({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;

  return redirect(`/?tab=team&team=${encodeURIComponent(slug)}`);
}
