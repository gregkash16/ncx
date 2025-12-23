"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import NextImage from "next/image";
import type { IndRow, FactionMap, MatchRow } from "@/lib/googleSheets";
import { teamSlug } from "@/lib/slug";
import PlayerDMLink from "@/app/components/PlayerDMLink";
import { TEAM_COLOR_MAP } from "@/theme/teams";

type ScheduleMap = Record<string, { day: string; slot: string }>;

// Extra fields that get attached in page.tsx
interface MatchRowWithDiscord extends MatchRow {
  awayDiscordId?: string | null;
  homeDiscordId?: string | null;
  awayDiscordTag?: string | null;
  homeDiscordTag?: string | null;
}

// Scouting Pill Stuff
type ScenarioRow = {
  scenario: string;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  avgMov: number;
};

type ScoutPayload = {
  ncxid: string;
  minGames: number;
  totals: { games: number };
  bestScenario: {
    scenario: string;
    games: number;
    wins: number;
    winPct: number;
    avgMov: number;
  } | null;
  worstScenario: {
    scenario: string;
    games: number;
    wins: number;
    winPct: number;
    avgMov: number;
  } | null;
  scenarios: ScenarioRow[];
  topPilots: Array<{
    pilotId: string;
    pilotName: string;
    uses: number;
    shipGlyph: string;
  }>;
};

// Lists map for a given week (from MySQL S8.lists)
type ListsForWeek = Record<
  string,
  {
    awayList?: string;
    homeList?: string;
    awayLetters?: string;
    homeLetters?: string;
    awayCount?: number;
    homeCount?: number;
    awayAverageInit?: number;
    homeAverageInit?: number;
  }
>;

type Props = {
  data: MatchRow[];
  weekLabel?: string;
  activeWeek?: string;
  scheduleWeek?: string;
  scheduleMap?: ScheduleMap;
  indStats?: IndRow[];
  factionMap?: FactionMap;
  listsForWeek?: ListsForWeek;

  // Feature flags
  enableCapsules?: boolean;
  enableCapsulesAI?: boolean;
  capsuleTone?: "neutral" | "buster";
};

function parseIntSafe(v: string | number | undefined | null): number {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}
function gameNum(g: string): number {
  const m = (g || "").match(/^\d+/);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
}

function normalizeNcxId(v?: string | null): string | null {
  if (!v) return null;
  const s = v.trim().toUpperCase().replace(/\s+/g, "");
  return s.startsWith("NCX") ? s : null;
}

/** Choose ONE team from q by checking against actual team names. */
function pickTeamFilter(q: string, rows: MatchRow[]): string {
  const tokens = (q || "")
    .split(/[+\s]+/g)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!tokens.length) return "";

  const allTeams = Array.from(
    new Set(
      rows.flatMap((r) => [r.awayTeam, r.homeTeam]).filter(Boolean) as string[]
    )
  );
  const teamBySlug = new Map(allTeams.map((t) => [teamSlug(t), t]));

  // 1) exact slug match
  for (const tok of tokens) {
    const s = teamSlug(tok);
    const exact = teamBySlug.get(s);
    if (exact) return exact;
  }
  // 2) substring slug match
  for (const tok of tokens) {
    const s = teamSlug(tok);
    const found = allTeams.find((t) => {
      const ts = teamSlug(t);
      return ts.includes(s) || s.includes(ts);
    });
    if (found) return found;
  }
  // 3) fallback: first token
  return tokens[0];
}

// Map canonical faction label → PNG filename in /public/factions
const FACTION_FILE: Record<string, string> = {
  REBELS: "Rebels.webp",
  EMPIRE: "Empire.webp",
  REPUBLIC: "Republic.webp",
  CIS: "CIS.webp",
  RESISTANCE: "Resistance.webp",
  "FIRST ORDER": "First Order.webp",
  SCUM: "Scum.webp",
};
function factionIconSrc(faction?: string) {
  const key = (faction || "").toUpperCase().trim();
  const file = FACTION_FILE[key];
  return file ? `/factions/${file}` : "";
}

// --- Team color mapping for thumbnails ---------------------------------


function getTeamColorHex(teamName?: string | null): string {
  if (!teamName) return "#0f172a";
  const key = teamName.trim().toUpperCase();
  return TEAM_COLOR_MAP[key] ?? "#0f172a";
}

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  const int = parseInt(h, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fillStyle?: string,
  strokeStyle?: string,
  strokeWidth = 1
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
  ctx.restore();
}

// Build a quick lookup from IndStats by NCXID
function statsMapFromIndRows(rows?: IndRow[]) {
  const map = new Map<string, IndRow>();
  (rows ?? []).forEach((r) => {
    if (r?.ncxid) map.set(r.ncxid, r);
  });
  return map;
}

// --- helpers for week labels like "WEEK 4"
function parseWeekNum(label?: string | null): number | null {
  if (!label) return null;
  const m = label.trim().match(/week\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}
function formatWeekLabel(n: number) {
  return `WEEK ${n}`;
}

/************************************************************
 *  Thumbnail generation helpers
 ************************************************************/
const THUMB_WIDTH = 1920;
const THUMB_HEIGHT = 1080;

type ThumbnailContext = {
  row: MatchRowWithDiscord;
  awaySeason?: IndRow;
  homeSeason?: IndRow;
  awayFactionIcon?: string;
  homeFactionIcon?: string;
  weekLabel?: string;
  // precomputed ship glyphs from MySQL
  awayLetters?: string | null;
  homeLetters?: string | null;
};

const SHIP_FONT_FAMILY = "XWingShips";

let shipFontLoaded: Promise<void> | null = null;

function ensureShipFontLoaded(): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve();
  }

  if (shipFontLoaded) return shipFontLoaded;

  shipFontLoaded = (async () => {
    try {
      const font = new FontFace(
        SHIP_FONT_FAMILY,
        "url(/fonts/x-wing-miniatures-ships.ttf)"
      );
      const loaded = await font.load();
      (document as any).fonts.add(loaded);
    } catch (err) {
      console.warn("Failed to load X-Wing ship font:", err);
    }
  })();

  return shipFontLoaded;
}

function loadImageSafe(src?: string | null): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    if (typeof window === "undefined") return resolve(null);

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality = 0.9
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// OPTION A: TEAM-COLOR GRADIENT STYLE
async function generateMatchThumbnail(ctxData: ThumbnailContext) {
  if (typeof window === "undefined") return;

  await ensureShipFontLoaded();

  const { row, awayFactionIcon, homeFactionIcon, weekLabel, awayLetters, homeLetters } =
    ctxData;

  const canvas = document.createElement("canvas");
  canvas.width = THUMB_WIDTH;
  canvas.height = THUMB_HEIGHT;

  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) return;
  const ctx: CanvasRenderingContext2D = maybeCtx;

  const W = THUMB_WIDTH;
  const H = THUMB_HEIGHT;

  const awayName = row.awayName || "Away Player";
  const homeName = row.homeName || "Home Player";
  const awayTeam = row.awayTeam || "Away Team";
  const homeTeam = row.homeTeam || "Home Team";

  const awayLogoPath = `/logos/${teamSlug(row.awayTeam)}.webp`;
  const homeLogoPath = `/logos/${teamSlug(row.homeTeam)}.webp`;
  const mainLogoPath = "/logo.webp";

  const awayColorHex = getTeamColorHex(awayTeam);
  const homeColorHex = getTeamColorHex(homeTeam);

  const [awayLogoImg, homeLogoImg, awayFactionImg, homeFactionImg, mainLogoImg] =
    await Promise.all([
      loadImageSafe(awayLogoPath),
      loadImageSafe(homeLogoPath),
      loadImageSafe(awayFactionIcon),
      loadImageSafe(homeFactionIcon),
      loadImageSafe(mainLogoPath),
    ]);

  const awayShipGlyphs =
    (awayLetters ?? "").trim().length > 0 ? (awayLetters as string) : null;
  const homeShipGlyphs =
    (homeLetters ?? "").trim().length > 0 ? (homeLetters as string) : null;

  const hasShips = Boolean(awayShipGlyphs || homeShipGlyphs);

  /************************************************************
   * BACKGROUND: PURE TEAM GRADIENT
   ************************************************************/
  const baseGrad = ctx.createLinearGradient(0, 0, W, 0);
  baseGrad.addColorStop(0, awayColorHex);
  baseGrad.addColorStop(0.5, hexToRgba(awayColorHex, 0.5));
  baseGrad.addColorStop(0.5, hexToRgba(homeColorHex, 0.5));
  baseGrad.addColorStop(1, homeColorHex);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, W, H);

  const vGrad = ctx.createLinearGradient(0, 0, 0, H);
  vGrad.addColorStop(0, "rgba(15,23,42,0.35)");
  vGrad.addColorStop(0.5, "rgba(15,23,42,0.15)");
  vGrad.addColorStop(1, "rgba(15,23,42,0.35)");
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.fillStyle = "rgba(248,250,252,0.5)";
  ctx.fillRect(W / 2 - 2, 0, 4, H);
  ctx.restore();

  /************************************************************
   * TOP TEXT
   ************************************************************/
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#ffffff";
  ctx.font =
    "800 64px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("NICKEL CITY X-WING", W / 2, 95);

  if (weekLabel) {
    ctx.fillStyle = "#f9fafb";
    ctx.font =
      "700 40px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(weekLabel.toUpperCase(), W / 2, 150);
  }

  /************************************************************
   * CENTER LOGO
   ************************************************************/
  if (mainLogoImg) {
    const maxW = 380;
    const maxH = 380;

    let drawW = mainLogoImg.width;
    let drawH = mainLogoImg.height;

    const scale = Math.min(maxW / drawW, maxH / drawH);
    drawW *= scale;
    drawH *= scale;

    ctx.globalAlpha = 1;
    ctx.drawImage(
      mainLogoImg,
      W / 2 - drawW / 2,
      H / 2 - drawH / 2 + 10,
      drawW,
      drawH
    );
  }

  const midY = H / 2;
  const leftX = W * 0.25;
  const rightX = W * 0.75;

  const factionSize = 210;

  /************************************************************
   * FACTION ICONS
   ************************************************************/
  if (awayFactionImg) {
    ctx.drawImage(
      awayFactionImg,
      leftX - factionSize / 2,
      midY - 250 - factionSize / 2,
      factionSize,
      factionSize
    );
  }
  if (homeFactionImg) {
    ctx.drawImage(
      homeFactionImg,
      rightX - factionSize / 2,
      midY - 250 - factionSize / 2,
      factionSize,
      factionSize
    );
  }

  /************************************************************
   * NAMES / SHIPS / TEAMS
   ************************************************************/
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#ffffff";
  ctx.font =
    "800 64px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText(awayName, leftX, hasShips ? midY - 40 : midY - 20);
  ctx.fillText(homeName, rightX, hasShips ? midY - 40 : midY - 20);

  if (hasShips) {
    ctx.save();
    ctx.fillStyle = "#f9fafb";
    ctx.font = `700 86px "${SHIP_FONT_FAMILY}", system-ui, -apple-system, sans-serif`;
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    if (awayShipGlyphs) {
      ctx.fillText(awayShipGlyphs, leftX, midY + 35);
    }
    if (homeShipGlyphs) {
      ctx.fillText(homeShipGlyphs, rightX, midY + 35);
    }

    ctx.restore();
  }

  ctx.fillStyle = "#e5e7eb";
  ctx.font =
    "600 42px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText(awayTeam, leftX, hasShips ? midY + 95 : midY + 50);
  ctx.fillText(homeTeam, rightX, hasShips ? midY + 95 : midY + 50);

  /************************************************************
   * NORMALIZED LOGO CARDS
   ************************************************************/
  const cardW = 260;
  const cardH = 260;
  const cardRadius = 40;
  const cardY = midY + 110;

  if (awayLogoImg) {
    const cardX = leftX - cardW / 2;

    drawRoundedRect(
      ctx,
      cardX,
      cardY,
      cardW,
      cardH,
      cardRadius,
      hexToRgba(awayColorHex, 0.25),
      hexToRgba(awayColorHex, 0.9),
      3
    );

    const maxLogoW = cardW - 60;
    const maxLogoH = cardH - 60;
    let w = awayLogoImg.width;
    let h = awayLogoImg.height;
    const scale = Math.min(maxLogoW / w, maxLogoH / h);
    w *= scale;
    h *= scale;

    const logoX = leftX - w / 2;
    const logoY = cardY + cardH / 2 - h / 2;

    ctx.drawImage(awayLogoImg, logoX, logoY, w, h);
  }

  if (homeLogoImg) {
    const cardX = rightX - cardW / 2;

    drawRoundedRect(
      ctx,
      cardX,
      cardY,
      cardW,
      cardH,
      cardRadius,
      hexToRgba(homeColorHex, 0.25),
      hexToRgba(homeColorHex, 0.9),
      3
    );

    const maxLogoW = cardW - 60;
    const maxLogoH = cardH - 60;
    let w = homeLogoImg.width;
    let h = homeLogoImg.height;
    const scale = Math.min(maxLogoW / w, maxLogoH / h);
    w *= scale;
    h *= scale;

    const logoX = rightX - w / 2;
    const logoY = cardY + cardH / 2 - h / 2;

    ctx.drawImage(homeLogoImg, logoX, logoY, w, h);
  }

  /************************************************************
   * GAME LABEL + DOWNLOAD
   ************************************************************/
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 34px system-ui";
  ctx.fillText(`GAME ${row.game}`, W / 2, H - 70);

  const blob = await canvasToBlob(canvas, 0.9);
  if (!blob) return;

  const safeSlug = (s: string) =>
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .replace(/^-+|-+$/g, "") || "player";

  const fileAway = safeSlug(awayName);
  const fileHome = safeSlug(homeName);

  const filename = `game${row.game} - ${fileAway} v ${fileHome}.jpg`;
  downloadBlob(blob, filename);
}

/************************************************************
 *  ListIcons – uses precomputed letters (away_letters/home_letters)
 ************************************************************/
type ListIconsProps = {
  label: string;
  listUrl?: string | null;
  side: "away" | "home";
  letters?: string | null;
};

const ListIcons: React.FC<ListIconsProps> = ({
  label,
  listUrl,
  side,
  letters,
}) => {
  if (!listUrl) return null;

  const glyphs = (letters ?? "").trim().length > 0 ? (letters as string) : null;

  const iconBlock = glyphs ? (
    <div
      className="
        ship-icons
        text-[48px]
        leading-none
        h-12
        flex items-center justify-center
      "
    >
      {glyphs}
    </div>
  ) : (
    <div className="h-12 flex items-center text-zinc-500 text-xs">…</div>
  );

  const linkBlock = (
    <a
      href={listUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full bg-zinc-900/80 border border-zinc-700 px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-200 hover:border-pink-500/60 hover:bg-zinc-800/80 transition"
      title={listUrl}
    >
      <span className="underline decoration-dotted underline-offset-2">
        {label}
      </span>
    </a>
  );

  const content =
    side === "away" ? (
      <>
        {linkBlock}
        {iconBlock}
      </>
    ) : (
      <>
        {iconBlock}
        {linkBlock}
      </>
    );

  return (
    <div className="inline-flex items-center gap-2 min-w-[140px]">
      {content}
    </div>
  );
};

/************************************************************
 *  AI capsule client state
 ************************************************************/
type CapsuleState = {
  text?: string;
  loading?: boolean;
  error?: string;
};

/************************************************************
 *  Component
 ************************************************************/
export default function MatchupsPanel({
  data,
  weekLabel,
  activeWeek,
  scheduleWeek,
  scheduleMap,
  indStats,
  factionMap,
  listsForWeek,
  enableCapsules = false,
  enableCapsulesAI = false,
  capsuleTone = "neutral",
}: Props) {
  const searchParams = useSearchParams();
  const urlQRaw = (searchParams.get("q") ?? "").trim();
  const selectedWeekRaw = (searchParams.get("w") ?? "").trim();

  const [openScout, setOpenScout] = useState<string | null>(null);
  const [scoutById, setScoutById] = useState<
    Record<string, { loading?: boolean; error?: string; data?: ScoutPayload }>
  >({});
  const [openScoutName, setOpenScoutName] = useState<string>("");

  const activeNum = useMemo(() => parseWeekNum(activeWeek ?? null), [activeWeek]);
  const selectedNum = useMemo(
    () => parseWeekNum(selectedWeekRaw || null),
    [selectedWeekRaw]
  );

  const weeksPills = useMemo(() => {
    if (!activeNum || activeNum <= 0) return [] as string[];
    return Array.from({ length: activeNum }, (_, i) => formatWeekLabel(i + 1));
  }, [activeNum]);

  const cleaned = useMemo(() => {
    return (data || []).filter((m) => /^\d+$/.test((m.game || "").trim()));
  }, [data]);

  const urlSelectedTeam = useMemo(() => {
    if (!urlQRaw) return "";
    return pickTeamFilter(urlQRaw, cleaned);
  }, [urlQRaw, cleaned]);

  const [query, setQuery] = useState(urlSelectedTeam);

  const [onlyCompleted, setOnlyCompleted] = useState(false);
  const [onlyScheduled, setOnlyScheduled] = useState(false);

  const [generatingGame, setGeneratingGame] = useState<string | null>(null);

  // Capsule open/close per game
  const [openCapsule, setOpenCapsule] = useState<Record<string, boolean>>({});

  // AI capsule state per game
  const [aiCapsules, setAiCapsules] = useState<Record<string, CapsuleState>>({});

  async function loadScout(ncxid: string) {
    setScoutById((p) => ({
      ...p,
      [ncxid]: { ...(p[ncxid] ?? {}), loading: true, error: undefined },
    }));

    try {
      const res = await fetch(
        `/api/scout?ncxid=${encodeURIComponent(ncxid)}&minGames=2`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");

      setScoutById((p) => ({ ...p, [ncxid]: { loading: false, data: json } }));
    } catch (e: any) {
      setScoutById((p) => ({
        ...p,
        [ncxid]: { loading: false, error: e?.message || "Failed" },
      }));
    }
  }

  useEffect(() => {
    setQuery(urlSelectedTeam);
  }, [urlSelectedTeam]);

  const selectedTeam = useMemo(() => pickTeamFilter(query, cleaned), [query, cleaned]);

  const indById = useMemo(() => statsMapFromIndRows(indStats), [indStats]);

  /**
   * ✅ Counts should follow the CURRENT search filter.
   * So we compute a baseFiltered (query filter only, no completion toggles)
   * and derive completed/scheduled counts from that.
   */
  const baseFiltered = useMemo(() => {
    const q = (query || "").toLowerCase().trim();

    let rows = !q
      ? cleaned
      : cleaned.filter((m) => {
          const awayFactionName =
            m.awayId && factionMap ? factionMap[m.awayId] : undefined;
          const homeFactionName =
            m.homeId && factionMap ? factionMap[m.homeId] : undefined;

          return [
            m.awayId,
            m.homeId,
            m.awayName,
            m.homeName,
            m.awayTeam,
            m.homeTeam,
            m.scenario,
            awayFactionName,
            homeFactionName,
          ]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q));
        });

    // same sort behavior as main list
    rows = [...rows].sort((a, b) => {
      const aInSel =
        selectedTeam &&
        (a.awayTeam === selectedTeam || a.homeTeam === selectedTeam)
          ? 1
          : 0;
      const bInSel =
        selectedTeam &&
        (b.awayTeam === selectedTeam || b.homeTeam === selectedTeam)
          ? 1
          : 0;

      if (aInSel !== bInSel) return bInSel - aInSel;
      return gameNum(a.game) - gameNum(b.game);
    });

    return rows;
  }, [cleaned, query, selectedTeam, factionMap]);

  const completedCount = useMemo(() => {
    return baseFiltered.filter((m) => Boolean((m.scenario || "").trim())).length;
  }, [baseFiltered]);

  const scheduledCount = useMemo(() => {
    return baseFiltered.filter((m) => !Boolean((m.scenario || "").trim())).length;
  }, [baseFiltered]);

  const filtered = useMemo(() => {
    // Start from baseFiltered so we don't duplicate the query logic
    let rows = baseFiltered;

    rows = rows.filter((m) => {
      const isCompleted = Boolean((m.scenario || "").trim());
      if (onlyCompleted && !isCompleted) return false;
      if (onlyScheduled && isCompleted) return false;
      return true;
    });

    return rows;
  }, [baseFiltered, onlyCompleted, onlyScheduled]);

  const scheduleEnabled =
    Boolean(weekLabel && scheduleWeek) && weekLabel!.trim() === scheduleWeek!.trim();

  const btnBase =
    "group relative overflow-hidden rounded-xl border bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-pink-500/50";
  const gradient =
    "pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100";

  const GREEN = "34,197,94";
  const RED = "239,68,68";
  const TIE = "99,102,241";

  async function handleGenerateAICapsule(args: {
    row: MatchRowWithDiscord;
    awaySeason?: IndRow;
    homeSeason?: IndRow;
    listMeta?: {
      awayCount?: number | null;
      homeCount?: number | null;
      awayAverageInit?: number | null;
      homeAverageInit?: number | null;
      awayListSubmitted?: boolean | null;
      homeListSubmitted?: boolean | null;
    } | null;
  }) {
    const game = args.row.game;

    setAiCapsules((prev) => ({
      ...prev,
      [game]: { ...(prev[game] ?? {}), loading: true, error: undefined },
    }));

    try {
      const res = await fetch("/api/match-capsule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekLabel,
          row: args.row,
          awaySeason: args.awaySeason ?? null,
          homeSeason: args.homeSeason ?? null,
          listMeta: args.listMeta ?? null,
          tone: capsuleTone,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Request failed");

      setAiCapsules((prev) => ({
        ...prev,
        [game]: { text: String(json?.text ?? "").trim(), loading: false },
      }));
    } catch (e: any) {
      setAiCapsules((prev) => ({
        ...prev,
        [game]: {
          ...(prev[game] ?? {}),
          loading: false,
          error: e?.message || "Failed",
        },
      }));
    }
  }

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800">
      <h2 className="text-2xl font-bold text-center mb-4">
        <span className="text-pink-400">WEEKLY</span>{" "}
        <span className="text-cyan-400">MATCHUPS</span>
        {weekLabel ? (
          <span className="ml-2 text-zinc-400 text-base">• {weekLabel}</span>
        ) : null}
      </h2>

      {activeNum && activeNum > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-5">
          {weeksPills.map((wk) => {
            const isActive = wk.toUpperCase() === (activeWeek || "").toUpperCase();
            const selected =
              (!selectedWeekRaw && isActive) ||
              wk.toUpperCase() === (selectedWeekRaw || "").toUpperCase();

            const href = isActive ? "?tab=matchups" : `?tab=matchups&w=${encodeURIComponent(wk)}`;

            return (
              <a
                key={wk}
                href={href}
                className={[
                  btnBase,
                  isActive
                    ? "border-yellow-400/70"
                    : selected
                    ? "border-cyan-400/60"
                    : "border-purple-500/40",
                ].join(" ")}
              >
                <span
                  className={[
                    gradient,
                    isActive
                      ? "bg-gradient-to-r from-yellow-400/20 via-amber-400/20 to-yellow-300/20"
                      : "bg-gradient-to-r from-pink-600/20 via-purple-500/20 to-cyan-500/20",
                    selected ? "opacity-100" : "",
                  ].join(" ")}
                />
                <span className="relative z-10">{wk}</span>
              </a>
            );
          })}
        </div>
      )}

      {/* Search + toggles */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-6">
        <input
          type="text"
          placeholder="Filter by NCXID, Name, Team, Faction, or Scenario..."
          className="w-full sm:flex-1 rounded-lg bg-zinc-800 border border-zinc-700 text-sm px-4 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-pink-500"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={onlyCompleted}
            onChange={(e) => {
              setOnlyCompleted(e.target.checked);
              if (e.target.checked) setOnlyScheduled(false);
            }}
          />
          Completed ({completedCount})
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={onlyScheduled}
            onChange={(e) => {
              setOnlyScheduled(e.target.checked);
              if (e.target.checked) setOnlyCompleted(false);
            }}
          />
          Scheduled ({scheduledCount})
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-zinc-500 italic">No matchups found.</p>
      ) : (
        <div className="space-y-6">
          {filtered.map((rawRow, i) => {
            const row = rawRow as MatchRowWithDiscord;

            const awayScore = parseIntSafe(row.awayPts);
            const homeScore = parseIntSafe(row.homePts);
            const isDone = Boolean((row.scenario || "").trim());

            const winner =
              awayScore > homeScore ? "away" : homeScore > awayScore ? "home" : "tie";

            const awayLogo = `/logos/${teamSlug(row.awayTeam)}.webp`;
            const homeLogo = `/logos/${teamSlug(row.homeTeam)}.webp`;

            const leftColor = winner === "away" ? GREEN : winner === "home" ? RED : TIE;
            const rightColor = winner === "home" ? GREEN : winner === "away" ? RED : TIE;

            const gradientStyle: React.CSSProperties = {
              backgroundImage: `
                linear-gradient(to right, rgba(${leftColor},0.35) 0%, rgba(0,0,0,0) 25%),
                linear-gradient(to left,  rgba(${rightColor},0.35) 0%, rgba(0,0,0,0) 25%)
              `,
            };

            const sched =
              scheduleEnabled && scheduleMap?.[row.game]
                ? ` — ${scheduleMap[row.game].day.toUpperCase()}, ${scheduleMap[row.game].slot.toUpperCase()}`
                : "";

            const awaySeason = row.awayId ? indById.get(row.awayId) : undefined;
            const homeSeason = row.homeId ? indById.get(row.homeId) : undefined;

            const awayFactionIcon = factionMap?.[row.awayId]
              ? factionIconSrc(factionMap[row.awayId])
              : "";
            const homeFactionIcon = factionMap?.[row.homeId]
              ? factionIconSrc(factionMap[row.homeId])
              : "";

            const awayTooltip = row.awayDiscordTag ? `@${row.awayDiscordTag}` : "Open DM";
            const homeTooltip = row.homeDiscordTag ? `@${row.homeDiscordTag}` : "Open DM";

            const weekList = listsForWeek?.[row.game];
            const awayListUrl = weekList?.awayList || null;
            const homeListUrl = weekList?.homeList || null;
            const awayLetters = weekList?.awayLetters || null;
            const homeLetters = weekList?.homeLetters || null;

            const isOpen = Boolean(openCapsule[row.game]);
            const aiState = aiCapsules[row.game] || {};

            const handleClickThumbnail = async () => {
              try {
                setGeneratingGame(row.game);
                await generateMatchThumbnail({
                  row,
                  awaySeason,
                  homeSeason,
                  awayFactionIcon,
                  homeFactionIcon,
                  weekLabel,
                  awayLetters,
                  homeLetters,
                });
              } finally {
                setGeneratingGame((current) => (current === row.game ? null : current));
              }
            };

            return (
              <div
                key={`${row.game}-${i}`}
                className="relative p-5 rounded-xl bg-zinc-950/50 border border-zinc-800 hover:border-purple-500/40 transition"
                style={gradientStyle}
              >
                {/* Game # badge (+ stream schedule info if available) */}
                <div className="absolute -top-3 -left-3">
                  <span
                    className={[
                      "inline-flex items-center rounded-lg text-white text-xs font-bold px-2 py-1 shadow-lg",
                      isDone
                        ? "bg-cyan-500/90 shadow-cyan-500/30"
                        : "bg-pink-600/80 shadow-pink-600/30",
                    ].join(" ")}
                    title={sched ? sched.replace(/^ — /, "") : undefined}
                  >
                    {`GAME ${row.game}${sched}`}
                  </span>
                </div>

                {/* Buttons (Capsule + Create thumbnail) */}
                <div className="absolute -top-3 -right-3 flex items-center gap-2">
                  {enableCapsules && (
                    <button
                      type="button"
                      onClick={() =>
                        setOpenCapsule((p) => ({
                          ...p,
                          [row.game]: !p[row.game],
                        }))
                      }
                      className="inline-flex items-center rounded-lg bg-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md hover:bg-zinc-700"
                    >
                      {isOpen ? "Hide capsule" : "Capsule"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleClickThumbnail}
                    disabled={generatingGame === row.game}
                    className="inline-flex items-center rounded-lg bg-purple-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md hover:bg-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {generatingGame === row.game ? "Generating…" : "Create thumbnail"}
                  </button>
                </div>

                {/* Teams row */}
                <div className="relative z-10 flex items-center justify-between font-semibold text-lg">
                  {/* Away */}
                  <div className="flex items-center gap-3 w-1/3 min-w-0">
                    <NextImage
                      src={awayLogo}
                      alt={row.awayTeam || "Team"}
                      width={32}
                      height={32}
                      className="inline-block object-contain shrink-0"
                      unoptimized
                      loading="lazy"
                      decoding="async"
                    />
                    <span
                      className={`truncate ${
                        awayScore > homeScore ? "text-pink-400 font-bold" : "text-zinc-300"
                      }`}
                    >
                      {row.awayTeam || "TBD"}
                    </span>
                  </div>

                  {/* Scenario + Score */}
                  <div className="flex flex-col items-center w-1/3">
                    <span className="text-sm text-zinc-400 mb-1 italic">
                      {row.scenario || "No Scenario"}
                    </span>
                    <div className="text-3xl md:text-4xl font-mono leading-none">
                      <span>{awayScore}</span>
                      <span className="mx-3">:</span>
                      <span>{homeScore}</span>
                    </div>
                  </div>

                  {/* Home */}
                  <div className="flex items-center gap-3 justify-end w-1/3 min-w-0">
                    <span
                      className={`truncate text-right ${
                        homeScore > awayScore ? "text-cyan-400 font-bold" : "text-zinc-300"
                      }`}
                    >
                      {row.homeTeam || "TBD"}
                    </span>
                    <NextImage
                      src={homeLogo}
                      alt={row.homeTeam || "Team"}
                      width={32}
                      height={32}
                      className="inline-block object-contain shrink-0"
                      unoptimized
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>

                {/* Player names + NCX IDs + Faction icons */}
                <div className="relative z-10 mt-3 text-sm text-zinc-200 grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3">
                    {awayFactionIcon && (
                      <NextImage
                        src={awayFactionIcon}
                        alt={`${row.awayName} faction`}
                        width={48}
                        height={48}
                        className="object-contain"
                        unoptimized
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    <PlayerDMLink
                      name={row.awayName || "—"}
                      discordId={row.awayDiscordId}
                      titleSuffix={row.awayDiscordTag ? `@${row.awayDiscordTag}` : "Open DM"}
                      className="text-pink-400 font-semibold"
                    />
                    {row.awayId ? (
                      <button
                        type="button"
                        onClick={() => {
                          const id = normalizeNcxId(row.awayId);
                          if (!id) return;

                          const name = (row.awayName || "").trim();
                          setOpenScout((cur) => (cur === id ? null : id));
                          setOpenScoutName(name);

                          if (!scoutById[id]?.data && !scoutById[id]?.loading) loadScout(id);
                        }}
                        className="rounded-full bg-zinc-800/80 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200 font-mono hover:border-pink-500/60 hover:bg-zinc-800 transition"
                        title="Open scouting report"
                      >
                        {row.awayId}
                      </button>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-3 justify-end">
                    {row.homeId ? (
                      <button
                        type="button"
                        onClick={() => {
                          const id = normalizeNcxId(row.homeId);
                          if (!id) return;

                          const name = (row.homeName || "").trim();
                          setOpenScout((cur) => (cur === id ? null : id));
                          setOpenScoutName(name);

                          if (!scoutById[id]?.data && !scoutById[id]?.loading) loadScout(id);
                        }}
                        className="rounded-full bg-zinc-800/80 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200 font-mono hover:border-cyan-500/60 hover:bg-zinc-800 transition"
                        title="Open scouting report"
                      >
                        {row.homeId}
                      </button>
                    ) : null}

                    <PlayerDMLink
                      name={row.homeName || "—"}
                      discordId={row.homeDiscordId}
                      titleSuffix={row.homeDiscordTag ? `@${row.homeDiscordTag}` : "Open DM"}
                      className="text-cyan-400 font-semibold text-right"
                    />
                    {homeFactionIcon && (
                      <NextImage
                        src={homeFactionIcon}
                        alt={`${row.homeName} faction`}
                        width={48}
                        height={48}
                        className="object-contain"
                        unoptimized
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                  </div>
                </div>

                {/* Lists + precomputed ship glyphs */}
                {(awayListUrl || homeListUrl) && (
                  <div className="relative z-10 mt-4 flex items-center justify-between gap-6">
                    <div className="flex-1 flex justify-start">
                      {awayListUrl && (
                        <ListIcons label="Away list" listUrl={awayListUrl} letters={awayLetters} side="away" />
                      )}
                    </div>
                    <div className="flex-1 flex justify-end">
                      {homeListUrl && (
                        <ListIcons label="Home list" listUrl={homeListUrl} letters={homeLetters} side="home" />
                      )}
                    </div>
                  </div>
                )}

                {/* Season summary rail */}
                <div className="relative z-10 mt-4 grid grid-cols-2 gap-3 text-xs text-zinc-300">
                  <div className="bg-zinc-800/60 rounded-lg px-3 py-2">
                    <div>
                      Record:{" "}
                      <span className="text-zinc-100">
                        {awaySeason ? `${awaySeason.wins}-${awaySeason.losses}` : "—"}
                      </span>
                    </div>
                    <div>
                      Win%: <span className="text-zinc-100">{awaySeason?.winPct ?? "—"}</span>
                      {" • "}SoS: <span className="text-zinc-100">{awaySeason?.sos ?? "—"}</span>
                      {" • "}Potato: <span className="text-zinc-100">{awaySeason?.potato ?? "—"}</span>
                    </div>
                  </div>

                  <div className="bg-zinc-800/60 rounded-lg px-3 py-2 text-right">
                    <div>
                      Record:{" "}
                      <span className="text-zinc-100">
                        {homeSeason ? `${homeSeason.wins}-${homeSeason.losses}` : "—"}
                      </span>
                    </div>
                    <div>
                      Win%: <span className="text-zinc-100">{homeSeason?.winPct ?? "—"}</span>
                      {" • "}SoS: <span className="text-zinc-100">{homeSeason?.sos ?? "—"}</span>
                      {" • "}Potato: <span className="text-zinc-100">{homeSeason?.potato ?? "—"}</span>
                    </div>
                  </div>
                </div>

                {openScout && (openScout === row.awayId || openScout === row.homeId) && (
                  <div className="relative z-10 mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                    {(() => {
                      const id = openScout;
                      const st = scoutById[id] ?? {};
                      if (st.loading)
                        return <div className="text-sm text-zinc-400 italic">Loading scouting…</div>;
                      if (st.error) return <div className="text-sm text-red-300">{st.error}</div>;
                      if (!st.data) return null;

                      const d = st.data;

                      return (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[11px] uppercase tracking-wide text-zinc-400">
                              SCOUTING - {openScoutName || "Unknown"} {d.ncxid}
                            </div>

                            <div className="text-xs text-zinc-500">min games for best/weakest: {d.minGames}</div>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-3 text-sm">
                            <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-3">
                              <div className="text-zinc-400 text-xs uppercase">Best Scenario</div>
                              {d.bestScenario ? (
                                <div className="mt-1">
                                  <div className="font-semibold text-zinc-100">{d.bestScenario.scenario}</div>
                                  <div className="text-zinc-300 text-xs">
                                    {d.bestScenario.wins}-{d.bestScenario.games - d.bestScenario.wins} •{" "}
                                    {d.bestScenario.winPct}% • avg MOV {d.bestScenario.avgMov}
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-1 text-zinc-500 italic">Not enough data</div>
                              )}
                            </div>

                            <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-3">
                              <div className="text-zinc-400 text-xs uppercase">Weakest Scenario</div>
                              {d.worstScenario ? (
                                <div className="mt-1">
                                  <div className="font-semibold text-zinc-100">{d.worstScenario.scenario}</div>
                                  <div className="text-zinc-300 text-xs">
                                    {d.worstScenario.wins}-{d.worstScenario.games - d.worstScenario.wins} •{" "}
                                    {d.worstScenario.winPct}% • avg MOV {d.worstScenario.avgMov}
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-1 text-zinc-500 italic">Not enough data</div>
                              )}
                            </div>
                          </div>

                          {d.topPilots?.length > 0 && (
                            <div className="rounded-lg bg-zinc-900/40 border border-zinc-800 p-3">
                              <div className="text-zinc-400 text-xs uppercase mb-2">
                                Top 3 most used pilots (from submitted lists)
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {(d.topPilots ?? []).slice(0, 3).map((p) => (
                                  <div
                                    key={p.pilotId}
                                    className="inline-flex items-center gap-2 rounded-full bg-zinc-800/70 border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200"
                                    title={p.pilotName}
                                  >
                                    <span className="text-lg leading-none">{p.shipGlyph}</span>
                                    <span className="max-w-[220px] truncate">{p.pilotName}</span>
                                    <span className="text-zinc-400">×{p.uses}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Capsule block */}
                {enableCapsules && isOpen && (
                  <div className="relative z-10 mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                    {!isDone ? (
                      <div className="text-sm text-zinc-400 italic">
                        Capsule unavailable — this game has not been reported yet.
                      </div>
                    ) : (
                      <>
                        {enableCapsulesAI && (
                          <div className="mt-4 pt-3 border-t border-zinc-800">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-[11px] uppercase tracking-wide text-zinc-400">
                                AI Capsule (beta)
                              </div>

                              <button
                                type="button"
                                disabled={aiState.loading}
                                onClick={() =>
                                  handleGenerateAICapsule({
                                    row,
                                    awaySeason,
                                    homeSeason,
                                    listMeta: weekList
                                      ? {
                                          awayCount: weekList.awayCount ?? null,
                                          homeCount: weekList.homeCount ?? null,
                                          awayAverageInit: weekList.awayAverageInit ?? null,
                                          homeAverageInit: weekList.homeAverageInit ?? null,
                                          awayListSubmitted: Boolean(weekList.awayList),
                                          homeListSubmitted: Boolean(weekList.homeList),
                                        }
                                      : null,
                                  })
                                }
                                className="inline-flex items-center rounded-lg bg-purple-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md hover:bg-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {aiState.loading ? "Generating…" : aiState.text ? "Regenerate" : "Generate"}
                              </button>
                            </div>

                            {aiState.error && <div className="mt-2 text-xs text-red-300">{aiState.error}</div>}

                            {aiState.text && <div className="mt-2 text-sm text-zinc-200">{aiState.text}</div>}

                            {!aiState.text && !aiState.loading && !aiState.error && (
                              <div className="mt-2 text-xs text-zinc-500 italic">
                                Click Generate to create a 2–3 sentence recap from the data shown here.
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
