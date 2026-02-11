"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const FACTIONS = [
  "REPUBLIC",
  "CIS",
  "REBELS",
  "EMPIRE",
  "RESISTANCE",
  "FIRST ORDER",
  "SCUM",
] as const;

const FACTION_ICON_MAP: Record<string, string> = {
  REPUBLIC: "Republic.webp",
  CIS: "CIS.webp",
  REBELS: "Rebels.webp",
  EMPIRE: "Empire.webp",
  RESISTANCE: "Resistance.webp",
  "FIRST ORDER": "First Order.webp",
  SCUM: "Scum.webp",
};

const CARD_BACKGROUNDS = [
  {
    id: "ncx",
    name: "Season 9 – Garnet & Gold",
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#4b1024");
      g.addColorStop(0.45, "#7a1f3d");
      g.addColorStop(0.75, "#c98b2f");
      g.addColorStop(1, "#f2c14e");
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
  points: number;
  plms: number;
  ppg: number;
  championships: string;
  seasons: string[];
};

type HistoryState = PlayerHistory | "ROOKIE" | null;

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

async function loadBitmap(src: string): Promise<ImageBitmap> {
  const res = await fetch(src, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Image not found: ${src}`);
  const blob = await res.blob();
  return await createImageBitmap(blob);
}

export default function Season9PrefsPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PrefsPayload | null>(null);

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [p3, setP3] = useState("");

  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");

  const [draftOpen, setDraftOpen] = useState(false);
  const [bgId, setBgId] = useState("ncx");
  const [quote, setQuote] = useState("");
  const [history, setHistory] = useState<HistoryState>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const canSave = useMemo(() => {
    if (!data || !data.ok) return false;
    if (!("found" in data) || !data.found) return false;
    return Boolean(p1 && p2 && p3);
  }, [data, p1, p2, p3]);

  async function load() {
    setLoading(true);
    setNotice("");
    try {
      const res = await fetch("/api/s9/prefs", { cache: "no-store" });
      const json = (await res.json()) as PrefsPayload;
      setData(json);

      const norm = (v: string) => v?.trim().toUpperCase() ?? "";
      if (json.ok && "found" in json && json.found) {
        setP1(norm(json.pref_one));
        setP2(norm(json.pref_two));
        setP3(norm(json.pref_three));
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
        setNotice(json?.reason ?? "Failed to save.");
        return;
      }
      setNotice("✅ Preferences saved!");
      await load();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function openDraftCard() {
    setDraftOpen(true);
    setHistory(null);

    if (!data || !data.ok || !("found" in data) || !data.found) {
      setHistory("ROOKIE");
      return;
    }

    const res = await fetch(
      `/api/players?q=${encodeURIComponent(data.ncxid)}&limit=1`
    );
    const json = await res.json();
    const raw = json?.items?.[0];

    if (!raw || Number(raw.games ?? 0) === 0) {
      setHistory("ROOKIE");
      return;
    }

    setHistory({
      ncxid: raw.ncxid,
      first: raw.first,
      last: raw.last,
      wins: raw.wins,
      losses: raw.losses,
      games: raw.games,
      winPct: raw.winPct,
      points: raw.points,
      plms: raw.plms,
      ppg: raw.ppg,
      championships: raw.championships,
      seasons: (raw.seasons || []).filter(Boolean),
    });
  }

  function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) {
    const words = text.split(" ");
    let line = "";

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, y);
        line = words[n] + " ";
        y += lineHeight;
      } else {
        line = testLine;
      }
    }

    ctx.fillText(line.trim(), x, y);
    return y + lineHeight;
  }

  async function drawCard() {
    if (!canvasRef.current || !data || !data.ok) return;
    if (!("found" in data) || !data.found) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1920;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;

    const bg = CARD_BACKGROUNDS.find((b) => b.id === bgId);
    bg?.draw(ctx, W, H);

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(80, 80, W - 160, H - 160);
    ctx.fillStyle = "#fff";

    const LEFT_X = 140;
    let y = 170;

    ctx.font = "bold 48px system-ui";
    ctx.fillText("SEASON 9", LEFT_X, y);

    y += 90;
    ctx.font = "bold 72px system-ui";
    ctx.fillText(`${data.first_name} ${data.last_name}`, LEFT_X, y);

    y += 55;
    ctx.font = "36px system-ui";
    ctx.fillText(data.ncxid, LEFT_X, y);

    y += 90;
    ctx.font = "bold 36px system-ui";
    ctx.fillText("FACTION PREFERENCES", LEFT_X, y);

    // ===== FACTION ICONS (FINAL, PROD-SAFE) =====
    const factions = [p1, p2, p3].filter(Boolean);
    const ICON = 96;
    const GAP = 64;
    const iconY = y + 30;

    for (let i = 0; i < factions.length; i++) {
      const faction = factions[i];
      const filename = FACTION_ICON_MAP[faction];
      if (!filename) continue;

      try {
        const bmp = await loadBitmap(`/factions/${filename}`);
        const x = LEFT_X + i * (ICON + GAP);

        ctx.drawImage(bmp, x, iconY, ICON, ICON);

        ctx.font = "28px system-ui";
        const w = ctx.measureText(faction).width;
        ctx.fillText(
          faction,
          x + ICON / 2 - w / 2,
          iconY + ICON + 34
        );
      } catch {}
    }

    const RIGHT_X = 1000;
    let ry = 260;

    if (history === "ROOKIE" || history === null) {
      ctx.font = "bold 48px system-ui";
      ctx.fillText("ROOKIE SEASON", RIGHT_X, ry);
    } else {
      ctx.font = "bold 42px system-ui";
      ctx.fillText("NCX HISTORY", RIGHT_X, ry);

      ry += 60;
      ctx.font = "32px system-ui";
      ctx.fillText(
        `${history.wins}-${history.losses} (${history.winPct.toFixed(
          1
        )}%) • ${history.games} games`,
        RIGHT_X,
        ry
      );

      ry += 44;
      ctx.fillText(
        `Points: ${history.points} • PL/MS: ${history.plms}`,
        RIGHT_X,
        ry
      );

      ry += 44;
      ctx.fillText(`PPG: ${history.ppg.toFixed(2)}`, RIGHT_X, ry);

      if (history.seasons.length) {
        ry += 44;
        ctx.font = "32px system-ui";

        const maxWidth = 800;
        const lineHeight = 42;

        history.seasons.forEach((seasonEntry: string) => {
          // Try to extract season number (handles S6, SEASON 6, etc.)
          const match = seasonEntry.match(/S(?:EASON)?\s*(\d+)/i);
          const seasonNumber = match ? match[1] : "?";

          // Remove season text from team name if it's embedded
          const teamName = seasonEntry
            .replace(/S(?:EASON)?\s*\d+/i, "")
            .replace(/[-:]/g, "")
            .trim();

          const label = `S${seasonNumber}: ${teamName || seasonEntry}`;
          ry = wrapText(ctx, label, RIGHT_X, ry, maxWidth, lineHeight);
        });
      }


      if (history.championships) {
        ry += 44;
        ctx.fillText(`Championships: ${history.championships}`, RIGHT_X, ry);
      }
    }

    if (quote) {
      ctx.font = "italic 32px system-ui";
      ctx.fillText(`“${quote}”`, LEFT_X, H - 220);
    }

    try {
      const logo = await loadBitmap("/logo.webp");
      ctx.drawImage(logo, W - 420, H - 320, 300, 300);
    } catch {}
  }

  async function download() {
    await drawCard();
    if (!canvasRef.current) return;
    const a = document.createElement("a");
    a.download = `ncx_s9_draft_${(data as any).ncxid}.png`;
    a.href = canvasRef.current.toDataURL("image/png");
    a.click();
  }

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border">
        Loading Season 9 signups…
      </div>
    );
  }

  if (!data || !data.ok) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border">
        Could not load.
      </div>
    );
  }

  if ("found" in data && !data.found) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border space-y-4">
        <h2 className="text-xl font-semibold">Season 9 Signups</h2>
        <div className="border p-4 text-sm">
          You haven&apos;t signed up yet —{" "}
          <a
            className="underline cursor-pointer"
            href="https://forms.gle/X7VNuw1jbDp5985g8"
            target="_blank"
            rel="noreferrer"
          >
            Sign up here
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border space-y-6">
      <h2 className="text-xl font-semibold">Season 9 Signups</h2>

      <div className="grid sm:grid-cols-3 gap-4">
        <PrefSelect label="FACTION PREFERENCE 1" value={p1} onChange={setP1} />
        <PrefSelect label="FACTION PREFERENCE 2" value={p2} onChange={setP2} />
        <PrefSelect label="FACTION PREFERENCE 3" value={p3} onChange={setP3} />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!canSave || saving}
          className={`px-6 py-2 rounded-xl text-white transition cursor-pointer ${
            !canSave || saving
              ? "bg-purple-400 opacity-60 cursor-not-allowed"
              : "bg-purple-600 hover:bg-purple-700"
          }`}
        >
          {saving ? "Saving…" : "Save Preferences"}
        </button>

        {canSave && (
          <button
            type="button"
            onClick={openDraftCard}
            className="px-4 py-2 border cursor-pointer"
          >
            Create Draft Card
          </button>
        )}
      </div>

      {draftOpen && (
        <div className="border p-4 space-y-4">
          <select
            value={bgId}
            onChange={(e) => setBgId(e.target.value)}
            className="border bg-white text-black px-2 py-1 cursor-pointer"
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
            className="border px-2 py-1 w-full"
          />

          <canvas ref={canvasRef} className="border w-full max-w-3xl" />

          <div className="flex gap-3">
            <button onClick={drawCard} className="border px-3 py-1 cursor-pointer">
              Preview
            </button>
            <button
              onClick={download}
              className="bg-purple-600 text-white px-3 py-1 cursor-pointer"
            >
              Download
            </button>
            <button
              onClick={() => {
                setDraftOpen(false);
                setHistory(null);
              }}
              className="border px-3 py-1 cursor-pointer"
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
        className="w-full rounded-lg border px-3 py-2 bg-white text-black cursor-pointer"
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
