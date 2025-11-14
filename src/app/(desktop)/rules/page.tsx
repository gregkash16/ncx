// /src/app/(desktop)/rules/page.tsx

import DesktopNavTabs from "../../components/DesktopNavTabs";

const RULES_DOC_EMBED_URL =
  "https://docs.google.com/document/d/e/2PACX-1vTlXr6b2uL-Mub44w6TlRWKYOtoujbAFieLu7qDZHmFHpEYKsx9bQJP7p3PBXQ0JGG3nkuOEg_-lunP/pub?embedded=true";

export default function RulesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0b0b16] via-[#1a1033] to-[#0b0b16] text-zinc-100">
      {/* Header / hero-style title */}
      <section className="relative max-w-6xl mx-auto px-6 pt-24 pb-6 text-center">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,0,150,0.25),transparent_70%)] animate-pulse" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_120%,rgba(0,255,255,0.15),transparent_60%)] blur-3xl" />
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 text-transparent bg-clip-text drop-shadow-[0_0_25px_rgba(255,0,255,0.25)]">
          NCX Draft League Rules
        </h1>
        <p className="mt-3 text-base md:text-lg text-zinc-300">
          This page always reflects the latest version of the rules document.
        </p>
      </section>

      {/* Nav + rules panel */}
      <section className="w-full px-4 pb-24">
        <div className="w-full max-w-[110rem] mx-auto">
          <DesktopNavTabs />

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 shadow-lg overflow-hidden min-h-[70vh]">
            <div className="h-full w-full flex justify-center dark:invert dark:hue-rotate-180">
              <iframe
                src={RULES_DOC_EMBED_URL}
                className="border-0"
                style={{
                  width: "100%",
                  maxWidth: "900px", // keeps it looking like a centered page
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
