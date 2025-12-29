// src/app/components/Season9PrefsPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRef } from "react";

const FACTIONS = [
  "REPUBLIC",
  "CIS",
  "REBELS",
  "EMPIRE",
  "RESISTANCE",
  "FIRST ORDER",
  "SCUM",
] as const;

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

async function readJsonSafe(res: Response) {
  const text = await res.text();
  try {
    return { ok: true as const, json: JSON.parse(text), text };
  } catch {
    return { ok: false as const, json: null as any, text };
  }
}

export default function Season9PrefsPanel() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PrefsPayload | null>(null);

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [p3, setP3] = useState("");

  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");

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
        body: JSON.stringify({ pref_one: p1, pref_two: p2, pref_three: p3 }),
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
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-zinc-300">
        Loading Season 9 signups…
      </div>
    );
  }

  if (!data || !data.ok) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-zinc-300">
        Could not load. {data && !data.ok ? String(data.reason) : ""}
      </div>
    );
  }

  const isAdmin = (data as any).isAdmin === true;
  const total = (data as any).totalSignups as number | undefined;

  if ("found" in data && !data.found) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-zinc-200 space-y-4">
        <h2 className="text-xl font-semibold text-cyan-300">Season 9 Signups</h2>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-300">
          You haven&apos;t signed up for Season 9 yet — please do so here:{" "}
          <a
            className="text-cyan-300 underline"
            href="https://forms.gle/X7VNuw1jbDp5985g8"
            target="_blank"
            rel="noreferrer"
          >
            https://forms.gle/X7VNuw1jbDp5985g8
          </a>
        </div>

        {isAdmin && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <div className="text-sm text-zinc-200">
              Total signups: <span className="font-semibold">{total ?? "—"}</span>
            </div>
            <button
              type="button"
              onClick={adminRefresh}
              disabled={refreshing}
              className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-950/60 text-sm text-zinc-100 hover:border-cyan-400/50 disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh from Google Sheet"}
            </button>
          </div>
        )}

        {notice && <div className="text-sm text-zinc-300">{notice}</div>}
      </div>
    );
  }

  const ncxid = (data as any).ncxid as string;

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-zinc-200 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-cyan-300">Season 9 Signups</h2>
          <p className="mt-1 text-sm text-zinc-300">
            {(data as any).first_name} {(data as any).last_name} • NCX {ncxid}
          </p>
        </div>

        {isAdmin && (
          <div className="text-xs text-zinc-300 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1">
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
          className="px-6 py-2 rounded-xl bg-gradient-to-r from-pink-600 via-purple-500 to-cyan-500 text-white font-semibold shadow-lg shadow-pink-600/30 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Preferences"}
        </button>

        {notice && <span className="text-sm text-zinc-300">{notice}</span>}
      </div>

      <DraftCardSection ncxid={ncxid} />

      {isAdmin && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <div className="text-sm text-zinc-200">
            Total signups: <span className="font-semibold">{total ?? "—"}</span>
          </div>
          <button
            type="button"
            onClick={adminRefresh}
            disabled={refreshing}
            className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-950/60 text-sm text-zinc-100 hover:border-cyan-400/50 disabled:opacity-50"
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
      <div className="text-xs font-semibold text-zinc-300 mb-1">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-400/60"
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

function DraftCardSection({ ncxid }: { ncxid: string }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");

  const [generating, setGenerating] = useState(false);
  const [cardUrl, setCardUrl] = useState("");

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  function openPicker() {
    setErr("");
    setOk("");
    // Must be a direct user click → this is allowed.
    fileInputRef.current?.click();
  }

  async function upload() {
    setErr("");
    setOk("");

    if (!file) {
      setErr("Pick an image first (click “Choose Image”).");
      return;
    }

    setUploadedUrl("");
    setCardUrl("");
    setUploading(true);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/draft-card/upload", {
        method: "POST",
        body: form,
        // DO NOT set Content-Type; browser sets multipart boundary.
      });

      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Upload returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
      }

      if (!res.ok || !json?.ok) {
        throw new Error(json?.reason || json?.error || `Upload failed (${res.status})`);
      }

      const url = String(json.url || "").trim();
      if (!url) throw new Error("Upload succeeded but did not return url");

      setUploadedUrl(url);
      setOk("✅ Headshot uploaded. Now generate your card.");
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function generate() {
    setErr("");
    setOk("");

    if (!uploadedUrl) {
      setErr("Upload a headshot first.");
      return;
    }

    setGenerating(true);

    try {
      const url = `/api/draft-card?ncxid=${encodeURIComponent(
        ncxid
      )}&img=${encodeURIComponent(uploadedUrl)}`;

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Generate failed (${res.status})`);
      }

      setCardUrl(url);
      setOk("✅ Draft card generated!");
    } catch (e: any) {
      setErr(e?.message || "Generate failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-zinc-200 font-semibold">Draft Card</div>
          <div className="text-xs text-zinc-400">
            Choose a headshot, upload it, then generate your draft card.
          </div>
        </div>
        <div className="text-xs text-zinc-400">1920×1080 PNG</div>
      </div>

      {/* Hidden real file input (this is what actually opens the dialog) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          setErr("");
          setOk("");
          setUploadedUrl("");
          setCardUrl("");

          const f = e.target.files?.[0] ?? null;
          setFile(f);
        }}
      />

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4 space-y-3">
        <div className="text-sm font-semibold text-zinc-200">1) Choose + Upload headshot</div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openPicker}
            disabled={uploading || generating}
            className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-950/60 text-sm text-zinc-100 hover:border-cyan-400/50 disabled:opacity-50"
          >
            Choose Image…
          </button>

          <div className="text-sm text-zinc-300">
            {file ? (
              <span>
                Selected: <span className="text-zinc-100 font-semibold">{file.name}</span>
              </span>
            ) : (
              <span className="text-zinc-500">No file selected</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={upload}
            disabled={uploading}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>

          {uploadedUrl ? (
            <a
              href={uploadedUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-950/40 text-zinc-200 text-sm hover:border-cyan-400/40"
            >
              View uploaded image
            </a>
          ) : null}
        </div>

        {uploadedUrl ? (
          <div className="rounded-lg overflow-hidden border border-zinc-800 bg-black/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={uploadedUrl} alt="uploaded headshot" className="w-full h-auto" />
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4 space-y-3">
        <div className="text-sm font-semibold text-zinc-200">2) Generate card</div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-pink-600 via-purple-500 to-cyan-500 text-white text-sm font-semibold disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate Draft Card"}
          </button>

          {cardUrl ? (
            <a
              href={cardUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-950/40 text-zinc-200 text-sm hover:border-cyan-400/40"
            >
              Open PNG
            </a>
          ) : null}
        </div>

        {cardUrl ? (
          <div className="rounded-xl overflow-hidden border border-zinc-800 bg-black/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cardUrl} alt="draft card preview" className="w-full h-auto" />
          </div>
        ) : (
          <div className="text-xs text-zinc-400">Upload first, then generate.</div>
        )}
      </div>

      {err ? <div className="text-sm text-red-300">{err}</div> : null}
      {ok ? <div className="text-sm text-zinc-200">{ok}</div> : null}
    </div>
  );
}
