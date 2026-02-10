// src/app/components/Season9PrefsPanel.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const FACTIONS = [
  "REPUBLIC",
  "CIS",
  "REBELS",
  "EMPIRE",
  "RESISTANCE",
  "FIRST ORDER",
  "SCUM",
] as const;

const CARD_BACKGROUNDS = [
  {
    id: "ncx",
    name: "NCX Gradient",
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#5b2cff");
      g.addColorStop(0.5, "#ff2fb3");
      g.addColorStop(1, "#00e5ff");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: "dark",
    name: "Dark Steel",
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = "#0b0f19";
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: "light",
    name: "Light",
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = "#f4f6fb";
      ctx.fillRect(0, 0, w, h);
    },
  },
];

type PlayerHistory = {
  ncxid: string;
  first: string;
  last: string;
  wins: number;
  losses: number;
  games: number;
  winPct: number;
  championships: string;
  seasons: (string | null)[];
};

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

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [p3, setP3] = useState("");

  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");

  // Draft card state
  const [showCard, setShowCard] = useState(false);
  const [bgId, setBgId] = useState("ncx");
  const [quote, setQuote] = useState("");
  const [history, setHistory] = useState<PlayerHistory | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const canSave = useMemo(() => {
    if (!data || !data.ok) return false;
    if (!("found" in data) || !data.found) return false;
    return Boolean(p1 && p2 && p3);
  }, [data, p1, p2, p3]);

  const canMakeCard =
    data && data.ok && "found" in data && data.found && p1 && p2 && p3;

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
  }, []);

  async function save() {
    if (!canSave) return;
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

  async function openDraftCard() {
    if (!data || !data.ok || !("found" in data) || !data.found) return;

    const res = await fetch(
      `/api/players?q=${encodeURIComponent(data.ncxid)}&limit=1`
    );
    const json = await res.json();
    const player = json?.items?.[0];
    if (player) {
      player.seasons = (player.seasons || []).filter(Boolean);
      setHistory(player);
      setShowCard(true);
    }
  }

  function drawCard() {
    if (!canvasRef.current || !history || !data) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1920;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;

    const bg = CARD_BACKGROUNDS.find((b) => b.id === bgId);
    bg?.draw(ctx, W, H);

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(80, 80, W - 160, H - 160);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 64px system-ui";
    ctx.fillText(`${history.first} ${history.last}`, 140, 200);

    ctx.font = "32px system-ui";
    ctx.fillText(`NCX ${history.ncxid}`, 140, 250);

    ctx.font = "bold 36px system-ui";
    ctx.fillText("Faction Preferences", 140, 340);

    ctx.font = "30px system-ui";
    ctx.fillText(`1. ${p1}`, 160, 390);
    ctx.fillText(`2. ${p2}`, 160, 430);
    ctx.fillText(`3. ${p3}`, 160, 470);

    ctx.font = "bold 36px system-ui";
    ctx.fillText("NCX History", 140, 560);

    ctx.font = "30px system-ui";
    ctx.fillText(
      `${history.wins}-${history.losses} (${history.winPct.toFixed(
        1
      )}%) • ${history.games} games`,
      160,
      610
    );

    if (history.seasons.length) {
      ctx.fillText(`Seasons: ${history.seasons.join(", ")}`, 160, 650);
    }

    if (history.championships) {
      ctx.fillText(
        `Championships: ${history.championships}`,
        160,
        690
      );
    }

    if (quote) {
      ctx.font = "italic 32px system-ui";
      ctx.fillText(`“${quote}”`, 140, 820);
    }

    const logo = new Image();
    logo.src = "/logo.webp";
    logo.onload = () => {
      ctx.drawImage(logo, W - 420, H - 320, 300, 300);
    };
  }

  function download() {
    drawCard();
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `ncx_s9_draft_${(data as any).ncxid}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)]">
        Loading Season 9 signups…
      </div>
    );
  }

  if (!data || !data.ok) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)]">
        Could not load. {data && !data.ok ? String(data.reason) : ""}
      </div>
    );
  }

  const isAdmin = data.isAdmin === true;
  const total = (data as any).totalSignups as number | undefined;

  if ("found" in data && !data.found) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] space-y-4">
        <h2 className="text-xl font-semibold text-[rgb(var(--ncx-primary-rgb))]">
          Season 9 Signups
        </h2>

        <div className="rounded-xl border p-4 text-sm">
          You haven&apos;t signed up for Season 9 yet —{" "}
          <a
            className="underline"
            href="https://forms.gle/X7VNuw1jbDp5985g8"
            target="_blank"
            rel="noreferrer"
          >
            Sign up here
          </a>
        </div>

        {isAdmin && (
          <div className="rounded-xl border p-4 space-y-3">
            <div className="text-sm">
              Total signups:{" "}
              <span className="font-semibold">{total ?? "—"}</span>
            </div>
            <button
              onClick={adminRefresh}
              disabled={refreshing}
              className="px-4 py-2 rounded-lg border disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh from Google Sheet"}
            </button>
          </div>
        )}

        {notice && <div className="text-sm">{notice}</div>}
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border border-[var(--ncx-border)] space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[rgb(var(--ncx-primary-rgb))]">
            Season 9 Signups
          </h2>
          <p className="text-sm">
            {(data as any).first_name} {(data as any).last_name} • NCX{" "}
            {(data as any).ncxid}
          </p>
        </div>
        {isAdmin && (
          <div className="text-xs rounded-full border px-3 py-1">Admin</div>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <PrefSelect label="FACTION PREFERENCE 1" value={p1} onChange={setP1} />
        <PrefSelect label="FACTION PREFERENCE 2" value={p2} onChange={setP2} />
        <PrefSelect label="FACTION PREFERENCE 3" value={p3} onChange={setP3} />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={save}
          disabled={!canSave || saving}
          className="px-6 py-2 rounded-xl bg-[linear-gradient(to_right,var(--ncx-hero-to),var(--ncx-hero-via),var(--ncx-hero-from))] text-white font-semibold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Preferences"}
        </button>

        {canMakeCard && (
          <button
            onClick={openDraftCard}
            className="px-4 py-2 rounded-lg border"
          >
            Create Draft Card
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="rounded-xl border p-4 space-y-3">
          <div className="text-sm">
            Total signups: <span className="font-semibold">{total ?? "—"}</span>
          </div>
          <button
            onClick={adminRefresh}
            disabled={refreshing}
            className="px-4 py-2 rounded-lg border disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh from Google Sheet"}
          </button>
        </div>
      )}

      {showCard && history && (
        <div className="rounded-xl border p-4 space-y-4">
          <div className="flex gap-4">
            <select
              value={bgId}
              onChange={(e) => setBgId(e.target.value)}
              className="border px-2 py-1"
            >
              {CARD_BACKGROUNDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <input
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="Optional quote"
              className="flex-1 border px-2 py-1"
            />
          </div>

          <canvas ref={canvasRef} className="w-full max-w-3xl border" />

          <div className="flex gap-3">
            <button onClick={drawCard} className="px-4 py-2 border rounded">
              Preview
            </button>
            <button
              onClick={download}
              className="px-4 py-2 rounded bg-purple-600 text-white"
            >
              Download 1920×1080
            </button>
            <button
              onClick={() => setShowCard(false)}
              className="px-4 py-2 border rounded"
            >
              Close
            </button>
          </div>
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
      <div className="text-xs font-semibold mb-1">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
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
