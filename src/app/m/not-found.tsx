// src/app/m/not-found.tsx
import Link from "next/link";

export default function MobileNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-10 text-center">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-[var(--ncx-text-primary)]">
          Page not found
        </h2>
        <p className="text-sm text-[var(--ncx-text-muted)]">
          That screen doesn&apos;t exist. Use the tabs below or go back to the
          current week.
        </p>
      </div>

      <Link
        href="/m"
        className="
          rounded-lg
          border
          border-[var(--ncx-border)]
          bg-[var(--ncx-panel-bg)]
          px-4
          py-2
          text-sm
          font-medium
          text-[var(--ncx-text-primary)]
          hover:bg-[rgb(var(--ncx-primary-rgb)/0.14)]
        "
      >
        Go to Current Week
      </Link>
    </div>
  );
}
