// /src/app/(desktop)/teams/[slug]/page.tsx
export const runtime = "nodejs";

import { redirect } from "next/navigation";

// Next 15: params is a Promise in server components
export default async function TeamRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/?tab=team&team=${encodeURIComponent(slug)}`);
}
