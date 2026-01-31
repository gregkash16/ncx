// src/app/m/rules/page.tsx

const RULES_DOC_EMBED_URL =
  "https://docs.google.com/document/d/1lFXGloKW6guAMj0xGK3U_Ft8CUNR3MFQhutTJqG72-M/preview";

export const revalidate = 60;

export default function MobileRulesPage() {
  return (
    <main className="py-4">
      <section className="mb-4 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight ncx-hero-title ncx-hero-glow">
          NCX Draft League Rules
        </h1>
        <p className="mt-2 text-xs text-[var(--ncx-text-muted)]">
          This screen always reflects the latest version of the rules document.
        </p>
      </section>

      <section>
        <div className="rounded-2xl border border-[var(--ncx-border)] bg-[rgb(0_0_0/0.30)] shadow-lg overflow-hidden min-h-[70vh]">
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
