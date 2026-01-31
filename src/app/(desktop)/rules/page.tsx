// /src/app/(desktop)/rules/page.tsx

import { Suspense } from "react";
import DesktopNavTabs from "../../components/DesktopNavTabs";

const RULES_DOC_EMBED_URL =
  "https://docs.google.com/document/d/1lFXGloKW6guAMj0xGK3U_Ft8CUNR3MFQhutTJqG72-M/preview";

export default function RulesPage() {
  return (
    <main className="min-h-screen ncx-gradient-bg text-zinc-100">
      {/* Header / hero-style title */}
      <section className="relative max-w-6xl mx-auto px-6 pt-24 pb-6 text-center">
        <div className="absolute inset-0 -z-10">
          {/* Brand blobs */}
          <div className="absolute inset-0 ncx-neon-blob-a" />
          <div className="absolute inset-0 ncx-neon-blob-b blur-3xl" />
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-zinc-100 ncx-hero-title ncx-hero-glow">
          NCX Draft League Rules
        </h1>

        <p className="mt-3 text-base md:text-lg text-zinc-300">
          This page always reflects the latest version of the rules document.
        </p>
      </section>

      {/* Nav + rules panel */}
      <section className="w-full px-4 pb-24">
        <div className="w-full max-w-[110rem] mx-auto">
          {/* Nav tabs */}
          <Suspense fallback={null}>
            <DesktopNavTabs />
          </Suspense>

          {/* Rules embed */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 shadow-lg overflow-hidden min-h-[70vh]">
            <div className="h-full w-full flex justify-center">
              <iframe
                src={RULES_DOC_EMBED_URL}
                className="border-0"
                style={{
                  width: "100%",
                  maxWidth: "900px",
                  height: "100%",
                  minHeight: "70vh",
                }}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
