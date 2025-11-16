// src/app/m/[...slug]/page.tsx
import Link from "next/link";

export default function MobileUnknownPage() {
  // This page will be wrapped in src/app/m/layout.tsx
  // so you'll still see the mobile header + bottom nav.
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-10 text-center">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-neutral-100">
          Page not found
        </h2>
        <p className="text-sm text-neutral-400">
          That screen doesn&apos;t exist. Use the tabs below or go back to the
          current week.
        </p>
      </div>

      <Link
        href="/m"
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-800"
      >
        Go to Current Week
      </Link>
    </div>
  );
}
