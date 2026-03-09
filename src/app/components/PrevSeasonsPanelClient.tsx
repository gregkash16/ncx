// src/app/components/PrevSeasonsPanelClient.tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { type SeasonNumber, type StatsMode } from "@/lib/SeasonStats";

type Props = {
  season: SeasonNumber;
  mode: StatsMode;
  columns: string[];
  rows: Record<string, unknown>[];
  error: string | null;
};

const SEASONS: SeasonNumber[] = [8, 7, 6, 5, 4, 3, 2, 1];

export default function PrevSeasonsPanelClient({
  season,
  mode,
  columns,
  rows,
  error,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(newSeason: SeasonNumber, newMode: StatsMode) {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set("tab", "prevseasons");
    params.set("ps", String(newSeason));
    params.set("pm", newMode);
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  // ── Season selector pills ──────────────────────────────────────────────
  const seasonPills = SEASONS.map((s) => {
    const isActive = s === season;
    return (
      <button
        key={s}
        onClick={() => navigate(s, mode)}
        className="relative isolate overflow-hidden rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:scale-105 focus:outline-none"
        style={{
          background: isActive
            ? undefined
            : "var(--ncx-bg-panel)",
          borderColor: isActive
            ? "transparent"
            : "var(--ncx-border)",
          color: "var(--ncx-text-primary)",
        }}
      >
        {isActive && (
          <span
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "linear-gradient(to right, var(--ncx-hero-from), var(--ncx-hero-via), var(--ncx-hero-to))",
            }}
          />
        )}
        {!isActive && (
          <span
            className="pointer-events-none absolute inset-0 -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{
              background:
                "linear-gradient(to right, var(--ncx-hero-from), var(--ncx-hero-via), var(--ncx-hero-to))",
            }}
          />
        )}
        <span className="relative">S{s}</span>
      </button>
    );
  });

  // ── Mode toggle ────────────────────────────────────────────────────────
  const modes: { key: StatsMode; label: string }[] = [
    { key: "overall", label: "Overall" },
    { key: "individual", label: "Individual" },
  ];

  const modeToggle = (
    <div
      className="flex rounded-xl border overflow-hidden"
      style={{ borderColor: "var(--ncx-border)" }}
    >
      {modes.map(({ key, label }) => {
        const isActive = key === mode;
        return (
          <button
            key={key}
            onClick={() => navigate(season, key)}
            className="relative isolate overflow-hidden px-5 py-2 text-sm font-semibold transition-all duration-200 focus:outline-none"
            style={{
              color: "var(--ncx-text-primary)",
              background: isActive ? undefined : "var(--ncx-bg-panel)",
            }}
          >
            {isActive && (
              <span
                className="pointer-events-none absolute inset-0 -z-10"
                style={{
                  background:
                    "linear-gradient(to right, var(--ncx-hero-from), var(--ncx-hero-via), var(--ncx-hero-to))",
                }}
              />
            )}
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );

  // ── Table ──────────────────────────────────────────────────────────────
  const table =
    error ? (
      <div
        className="rounded-xl border px-6 py-8 text-center text-sm"
        style={{ borderColor: "var(--ncx-border)", color: "var(--ncx-text-muted)" }}
      >
        {error}
      </div>
    ) : columns.length === 0 ? (
      <div
        className="rounded-xl border px-6 py-8 text-center text-sm"
        style={{ borderColor: "var(--ncx-border)", color: "var(--ncx-text-muted)" }}
      >
        No data found for Season {season} {mode === "overall" ? "Overall" : "Individual"} stats.
      </div>
    ) : (
      <div className="w-full overflow-x-auto rounded-xl border" style={{ borderColor: "var(--ncx-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr
              style={{
                background:
                  "linear-gradient(to right, rgb(var(--ncx-primary-rgb) / 0.25), rgb(var(--ncx-secondary-rgb) / 0.10))",
                borderBottom: "1px solid var(--ncx-border)",
              }}
            >
              {columns.map((col) => (
                <th
                  key={col}
                  className="whitespace-nowrap px-4 py-3 text-left font-semibold tracking-wide uppercase text-xs"
                  style={{ color: "var(--ncx-text-muted)" }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                style={{
                  background:
                    i % 2 === 0
                      ? "rgb(0 0 0 / 0.15)"
                      : "rgb(0 0 0 / 0.05)",
                  borderBottom: "1px solid var(--ncx-border)",
                }}
                className="transition-colors hover:bg-white/5"
              >
                {columns.map((col) => {
                  const val = row[col];
                  return (
                    <td
                      key={col}
                      className="whitespace-nowrap px-4 py-2.5"
                      style={{ color: "var(--ncx-text-primary)" }}
                    >
                      {val == null ? "—" : String(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <div className="mx-auto max-w-[115rem] space-y-5 px-2 pb-10">
      {/* Header */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ background: "var(--ncx-bg-panel)", borderColor: "var(--ncx-border)" }}>
        <div className="flex flex-col gap-1">
          <h2
            className="text-2xl font-extrabold tracking-tight ncx-hero-title ncx-hero-glow"
          >
            Previous Seasons
          </h2>
          <p className="text-sm" style={{ color: "var(--ncx-text-muted)" }}>
            Historical stats for Seasons 1–8
          </p>
        </div>

        {/* Season selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--ncx-text-muted)" }}>
            Season
          </span>
          {seasonPills}
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--ncx-text-muted)" }}>
            View
          </span>
          {modeToggle}
        </div>
      </div>

      {/* Table */}
      {table}
    </div>
  );
}