// app/(desktop)/layout.tsx
import type { ReactNode } from "react";

export default function DesktopLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col ncx-gradient-bg">
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
