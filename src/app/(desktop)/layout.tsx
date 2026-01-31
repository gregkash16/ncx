// app/(desktop)/layout.tsx
import type { ReactNode } from "react";
import DesktopHeader from "../components/DesktopHeader";

export default function DesktopLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col ncx-gradient-bg text-[var(--ncx-text-primary)]">
      <DesktopHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
