"use client";

import { useEffect, useMemo, useState } from "react";

const FACTIONS = [
  "REPUBLIC",
  "CIS",
  "REBELS",
  "EMPIRE",
  "RESISTANCE",
  "FIRST ORDER",
  "SCUM",
] as const;

type Faction = (typeof FACTIONS)[number];

type PrefsPayload =
  | {
      ok: true;
      found: true;
      ncxid: string;
      first_name: string;
      last_name: string;
      pref_one: string;
      pref_two: string;
      pref_three: string;
      isAdmin: boolean;
      totalSignups?: number;
    }
  | {
      ok: true;
      found: false;
      isAdmin: boolean;
      totalSignups?: number;
    }
  | { ok: false; reason: string };

export default function Season9PrefsPanel() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PrefsPayload | null>(null);

  const [p1, setP1] = useState<string>("");
  const [p2, setP2] = useState<string>("");
  const [p3, setP3] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string>("");

  const canSave = useMemo(() => {
    if (!data || !data.ok) return false;
    if (!("found" in data) || !data.found) return false;
    if (!p1 || !p2 || !p3) return false;
    return true;
  }, [data, p1, p2, p3]);

  async function load() {
    setLoading(true);
    setNotice("");
    try {
      const res = await fetch("/api/s9/prefs", { cache: "no-store" });
      const json = (await res.json()) as PrefsPayload;
      setData(json);

      if (json.ok && "found" in json && json.found) {
        setP1(json.pref_one || "");
        setP2(json.pref_two || "");
        setP3(json.pref_three || "");
      }
    } catch {
      setData({ ok: false, reason: "Failed to load." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!data || !data.ok || !("found" in data) || !data.found) return;

    setSaving(true);
    setNotice("");
    try {
      const res = await fetch("/api/s9/prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pref_one: p1,
          pref_two: p2,
          pref_three: p3,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setNotice(json?.error ?? json?.reason ?? "Failed to save.");
        return;
      }

      setNotice("✅ Preferences saved!");
      await load();
    } catch {
      setNotice("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function adminRefresh() {
    setRefreshing(true);
    setNotice("");
    try {
      const res = await fetch("/api/s9/refresh", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setNotice(json?.error ?? json?.reason ?? "Refresh failed.");
        return;
      }
      setNotice("✅ Refreshed signups.");
      await load();
    } catch {
      setNotice("Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] text-[var(--ncx-text-primary)]">
        Loading Season 9 signups…
      </div>
    );
  }

  if (!data || !data.ok) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] text-[var(--ncx-text-primary)]">
        Could not load. {data && !data.ok ? String(data.reason) : ""}
      </div>
    );
  }

  const isAdmin = (data as any).isAdmin === true;
  const total = (data as any).totalSignups as number | undefined;

  if ("found" in data && !data.found) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] text-[var(--ncx-text-primary)] space-y-4">
        <h2 className="text-xl font-semibold text-[rgb(var(--ncx-primary-rgb))]">
          Season 9 Signups
        </h2>

        <div className="rounded-xl border border-[var(--ncx-border)] bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] p-4 text-sm text-[var(--ncx-text-primary)]">
          You haven&apos;t signed up for Season 9 yet — please do so here:{" "}
          <a
            className="text-[rgb(var(--ncx-primary-rgb))] underline"
            href="https://forms.gle/X7VNuw1jbDp5985g8"
            target="_blank"
            rel="noreferrer"
          >
            https://forms.gle/X7VNuw1jbDp5985g8
          </a>
        </div>

        {isAdmin && (
          <div className="rounded-xl border border-[var(--ncx-border)] bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] p-4 space-y-3">
            <div className="text-sm text-[var(--ncx-text-primary)]">
              Total signups: <span className="font-semibold">{total ?? "—"}</span>
            </div>
            <button
              type="button"
              onClick={adminRefresh}
              disabled={refreshing}
              className="px-4 py-2 rounded-lg border border-[var(--ncx-border)] bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.12)] text-sm text-[var(--ncx-text-primary)] hover:border-[rgb(var(--ncx-primary-rgb)/0.60)] disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh from Google Sheet"}
            </button>
          </div>
        )}

        {notice && <div className="text-sm text-[var(--ncx-text-primary)]">{notice}</div>}
      </div>
    );
  }

  // found == true
  return (
    <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] text-[var(--ncx-text-primary)] space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[rgb(var(--ncx-primary-rgb))]">
            Season 9 Signups
          </h2>
          <p className="mt-1 text-sm text-[var(--ncx-text-primary)]">
            {(data as any).first_name} {(data as any).last_name} • NCX {(data as any).ncxid}
          </p>
        </div>

        {isAdmin && (
          <div className="text-xs text-[var(--ncx-text-primary)] rounded-full border border-[var(--ncx-border)] bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] px-3 py-1">
            Admin
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <PrefSelect label="FACTION PREFERENCE 1" value={p1} onChange={setP1} />
        <PrefSelect label="FACTION PREFERENCE 2" value={p2} onChange={setP2} />
        <PrefSelect label="FACTION PREFERENCE 3" value={p3} onChange={setP3} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!canSave || saving}
          className="px-6 py-2 rounded-xl bg-[linear-gradient(to_right,var(--ncx-hero-to),var(--ncx-hero-via),var(--ncx-hero-from))] text-white font-semibold shadow-lg disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Preferences"}
        </button>

        {notice && <span className="text-sm text-[var(--ncx-text-primary)]">{notice}</span>}
      </div>

      {isAdmin && (
        <div className="rounded-xl border border-[var(--ncx-border)] bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] p-4 space-y-3">
          <div className="text-sm text-[var(--ncx-text-primary)]">
            Total signups: <span className="font-semibold">{total ?? "—"}</span>
          </div>
          <button
            type="button"
            onClick={adminRefresh}
            disabled={refreshing}
            className="px-4 py-2 rounded-lg border border-[var(--ncx-border)] bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.12)] text-sm text-[var(--ncx-text-primary)] hover:border-[rgb(var(--ncx-primary-rgb)/0.60)] disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh from Google Sheet"}
          </button>
        </div>
      )}
    </div>
  );
}

function PrefSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-[var(--ncx-text-primary)] mb-1">
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-[rgb(var(--ncx-bg-start-rgb,10_47_102)/0.10)] border border-[var(--ncx-border)] px-3 py-2 text-sm text-[var(--ncx-text-primary)] outline-none focus:border-[rgb(var(--ncx-primary-rgb)/0.60)]"
      >
        <option value="" disabled>
          Choose…
        </option>
        {FACTIONS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
    </label>
  );
}
