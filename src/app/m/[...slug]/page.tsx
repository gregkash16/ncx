// src/app/m/[...slug]/page.tsx
import Link from "next/link";

export default function MobileUnknownPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-10 text-center">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          Page not found
        </h2>
        <p className="text-sm text-muted-foreground">
          That screen doesn&apos;t exist. Use the tabs below or go back to the
          home screen.
        </p>
      </div>

      <Link
        href="/m"
        className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
      >
        Go to Home
      </Link>
    </div>
  );
}
