// src/app/m/rules/page.tsx

const RULES_DOC_EMBED_URL =
  "https://docs.google.com/document/d/e/2PACX-1vTlXr6b2uL-Mub44w6TlRWKYOtoujbAFieLu7qDZHmFHpEYKsx9bQJP7p3PBXQ0JGG3nkuOEg_-lunP/pub?embedded=true";

export const revalidate = 60;

export default function MobileRulesPage() {
  return (
    <main className="py-4">
      <section className="mb-4 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400">
          NCX Draft League Rules
        </h1>
        <p className="mt-2 text-xs text-neutral-400">
          This screen always reflects the latest version of the rules document.
        </p>
      </section>

      <section>
        <div className="rounded-2xl border border-white/10 bg-black/30 shadow-lg overflow-hidden min-h-[70vh]">
          <div className="h-full w-full flex justify-center dark:invert dark:hue-rotate-180">
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
      </section>
    </main>
  );
}
