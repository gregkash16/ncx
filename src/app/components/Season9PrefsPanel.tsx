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

const CARD_BACKGROUNDS = [
  {
  id: "ncx",
  name: "Season 9 – Garnet & Gold",
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#4b1024");   // deep garnet
    g.addColorStop(0.45, "#7a1f3d"); // garnet
    g.addColorStop(0.75, "#c98b2f"); // warm gold
    g.addColorStop(1, "#f2c14e");    // bright gold

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

  const canMakeCard = canSave;

  async function load() {
    setLoading(true);
    setNotice("");
    try {
      const res = await fetch("/api/s9/prefs", { cache: "no-store" });
      const json = (await res.json()) as PrefsPayload;
      setData(json);

      function normFaction(v: string) {
        return v?.trim().toUpperCase() ?? "";
        }

        if (json.ok && "found" in json && json.found) {
          setP1(normFaction(json.pref_one));
          setP2(normFaction(json.pref_two));
          setP3(normFaction(json.pref_three));
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

  async function adminRefresh() {
    setRefreshing(true);
    setNotice("");
    try {
      const res = await fetch("/api/s9/refresh", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setNotice(json?.reason ?? "Refresh failed.");
        return;
      }
      setNotice("✅ Refreshed signups.");
      await load();
    } finally {
      setRefreshing(false);
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

    if (!raw) {
      setHistory("ROOKIE");
      return;
    }

    const games = Number(raw.games ?? 0);
    if (games === 0) {
      setHistory("ROOKIE");
      return;
    }

    setHistory({
      ncxid: raw.ncxid,
      first: raw.first,
      last: raw.last,
      wins: Number(raw.wins ?? 0),
      losses: Number(raw.losses ?? 0),
      games,
      winPct: Number(raw.winPct ?? 0),
      championships: raw.championships ?? "",
      seasons: (raw.seasons || []).filter(Boolean),
    });
  }

  // =================================== DRAFT CARD RENDERING =================

function drawCard() {
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

  // ===== INNER PANEL =====
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(80, 80, W - 160, H - 160);

  ctx.fillStyle = "#ffffff";

  // ===== LEFT COLUMN =====
  const LEFT_X = 140;
  let y = 170;

  ctx.font = "bold 48px system-ui";
  ctx.fillText("SEASON 9", LEFT_X, y);

  y += 90;
  ctx.font = "bold 72px system-ui";
  ctx.fillText(`${data.first_name} ${data.last_name}`, LEFT_X, y);

  y += 55;
  ctx.font = "36px system-ui";
  ctx.fillText(`NCX ${data.ncxid}`, LEFT_X, y);

  y += 90;
  ctx.font = "bold 36px system-ui";
  ctx.fillText("FACTION PREFERENCES", LEFT_X, y);

  // ===== FACTION ICON ROW =====
  const factions = [p1, p2, p3].filter(Boolean);
  const ICON_SIZE = 96;
  const ICON_GAP = 64;

  const rowWidth =
    factions.length * ICON_SIZE +
    (factions.length - 1) * ICON_GAP;

  let startX = LEFT_X;
  let iconY = y + 30;

  factions.forEach((faction, index) => {
    const x =
      startX + index * (ICON_SIZE + ICON_GAP);

    const img = new Image();
    img.src = `/factions/${faction}.webp`;
    img.onload = () => {
      ctx.drawImage(img, x, iconY, ICON_SIZE, ICON_SIZE);

      ctx.font = "28px system-ui";
      const label = faction;
      const textWidth = ctx.measureText(label).width;

      ctx.fillText(
        label,
        x + ICON_SIZE / 2 - textWidth / 2,
        iconY + ICON_SIZE + 34
      );
    };
  });

  // ===== RIGHT COLUMN =====
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

    if (history.seasons.length) {
      ry += 44;
      ctx.fillText(
        `Seasons: ${history.seasons.join(", ")}`,
        RIGHT_X,
        ry
      );
    }

    if (history.championships) {
      ry += 44;
      ctx.fillText(
        `Championships: ${history.championships}`,
        RIGHT_X,
        ry
      );
    }
  }

  // ===== QUOTE =====
  if (quote) {
    ctx.font = "italic 32px system-ui";
    ctx.fillText(`“${quote}”`, LEFT_X, H - 220);
  }

  // ===== LOGO =====
  const logo = new Image();
  logo.src = "/logo.webp";
  logo.onload = () => {
    ctx.drawImage(logo, W - 420, H - 320, 300, 300);
  };
}

// ============================================================

  function download() {
    drawCard();
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

  const isAdmin = data.isAdmin;
  const total = (data as any).totalSignups;

  if ("found" in data && !data.found) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--ncx-panel-bg)] border space-y-4">
        <h2 className="text-xl font-semibold">Season 9 Signups</h2>

        <div className="border p-4 text-sm">
          You haven&apos;t signed up yet —{" "}
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
          <div className="border p-4 space-y-3">
            <div>Total signups: {total ?? "—"}</div>
            <button
              onClick={adminRefresh}
              disabled={refreshing}
              className="border px-3 py-1"
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
          className={`
            px-6 py-2 rounded-xl text-white
            transition
            ${!canSave || saving
              ? "bg-purple-400 opacity-60 cursor-not-allowed"
              : "bg-purple-600 hover:bg-purple-700 cursor-pointer"}
          `}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Saving…
            </span>
          ) : (
            "Save Preferences"
          )}

        </button>


        {canMakeCard && (
          <button
            type="button"
            onClick={openDraftCard}
            className="px-4 py-2 border cursor-pointer"
          >
            Create Draft Card
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="border p-4 space-y-3">
          <div>Total signups: {total ?? "—"}</div>
          <button
            onClick={adminRefresh}
            disabled={refreshing}
            className="border px-3 py-1"
          >
            Refresh
          </button>
        </div>
      )}

      {draftOpen && (
        <div className="border p-4 space-y-4">
          {history === null ? (
            <div>Loading player history…</div>
          ) : (
            <>
              <select
                value={bgId}
                onChange={(e) => setBgId(e.target.value)}
                className="border bg-white text-black px-2 py-1"
              >
                {CARD_BACKGROUNDS.map((b) => (
                  <option key={b.id} value={b.id} className="text-black">
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
                <button onClick={drawCard} className="border px-3 py-1">
                  Preview
                </button>
                <button
                  onClick={download}
                  className="bg-purple-600 text-white px-3 py-1"
                >
                  Download
                </button>
                <button
                  onClick={() => {
                    setDraftOpen(false);
                    setHistory(null);
                  }}
                  className="border px-3 py-1"
                >
                  Close
                </button>
              </div>
            </>
          )}
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
        className="w-full rounded-lg border px-3 py-2 bg-white text-black"
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
