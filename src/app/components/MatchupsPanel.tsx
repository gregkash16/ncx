"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import NextImage from "next/image";
import type { IndRow, FactionMap, MatchRow } from "@/lib/googleSheets";
import { teamSlug } from "@/lib/slug";
import PlayerDMLink from "@/app/components/PlayerDMLink";

type ScheduleMap = Record<string, { day: string; slot: string }>;

// Extra fields that get attached in page.tsx
interface MatchRowWithDiscord extends MatchRow {
  awayDiscordId?: string | null;
  homeDiscordId?: string | null;
  awayDiscordTag?: string | null;
  homeDiscordTag?: string | null;
}

// Lists map for a given week (from Lists!A:D)
type ListsForWeek = Record<
  string,
  {
    awayList?: string;
    homeList?: string;
  }
>;

type Props = {
  data: MatchRow[]; // we accept MatchRow[]; extra fields are read via the extended interface above
  weekLabel?: string;
  activeWeek?: string;
  scheduleWeek?: string;
  scheduleMap?: ScheduleMap;
  indStats?: IndRow[];
  factionMap?: FactionMap;
  listsForWeek?: ListsForWeek; // per-game list URLs (YASB or LBN)
};

function parseIntSafe(v: string | number | undefined | null): number {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}
function gameNum(g: string): number {
  const m = (g || "").match(/^\d+/);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
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
  REBELS: "Rebels.png",
  EMPIRE: "Empire.png",
  REPUBLIC: "Republic.png",
  CIS: "CIS.png",
  RESISTANCE: "Resistance.png",
  "FIRST ORDER": "First Order.png",
  SCUM: "Scum.png",
};
function factionIconSrc(faction?: string) {
  const key = (faction || "").toUpperCase().trim();
  const file = FACTION_FILE[key];
  return file ? `/factions/${file}` : "";
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
  // NEW: list URLs so we can add ship icons to the thumbnail
  awayListUrl?: string | null;
  homeListUrl?: string | null;
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
        'url(/fonts/x-wing-miniatures-ships.ttf)'
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

    const img = new window.Image(); // explicitly use the DOM Image
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

async function fetchShipGlyphs(
  listUrl?: string | null
): Promise<string | null> {
  if (!listUrl) return null;
  if (typeof window === "undefined") return null;

  const apiUrl = buildLocalProxyUrl(listUrl);
  if (!apiUrl) return null;

  try {
    const res = await fetch(apiUrl, { cache: "no-store" });
    if (!res.ok) return null;

    const data = (await res.json()) as XwsResponse;
    const iconString = shipsToGlyphs(data.pilots ?? []);
    return iconString || null;
  } catch (err) {
    console.warn("fetchShipGlyphs error:", err);
    return null;
  }
}

// OPTION A: LIGHTSPEED DUEL STYLE — CLEAN + BRIGHT TEXT (TS-SAFE)
async function generateMatchThumbnail(ctxData: ThumbnailContext) {
  if (typeof window === "undefined") return;

  await ensureShipFontLoaded(); // <- make sure ship font is ready

  const {
    row,
    awayFactionIcon,
    homeFactionIcon,
    weekLabel,
    awayListUrl,
    homeListUrl,
  } = ctxData;

  const canvas = document.createElement("canvas");
  canvas.width = THUMB_WIDTH;
  canvas.height = THUMB_HEIGHT;

  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) return;
  const ctx: CanvasRenderingContext2D = maybeCtx;

  const W = THUMB_WIDTH;
  const H = THUMB_HEIGHT;

  // ===== HYPERSPACE BACKGROUND =====
  const bgGrad = ctx.createRadialGradient(
    W / 2,
    H / 2,
    0,
    W / 2,
    H / 2,
    H / 1.1
  );
  bgGrad.addColorStop(0, "#020617");
  bgGrad.addColorStop(1, "#000000");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Hyperspace streaks
  function drawStreaks(side: "left" | "right") {
    const count = 150;
    ctx.save();
    ctx.lineCap = "round";

    for (let i = 0; i < count; i++) {
      const y = Math.random() * H;
      const len = 80 + Math.random() * 220;
      const thickness = 1 + Math.random() * 3;

      let xStart: number;
      let xEnd: number;

      if (side === "left") {
        xStart = Math.random() * (W * 0.45);
        xEnd = xStart + len;
        ctx.strokeStyle = `rgba(236,72,153,${
          0.2 + Math.random() * 0.55
        })`; // pink
      } else {
        xStart = W * 0.55 + Math.random() * (W * 0.45);
        xEnd = xStart - len;
        ctx.strokeStyle = `rgba(56,189,248,${
          0.2 + Math.random() * 0.55
        })`; // cyan
      }

      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.moveTo(xStart, y);
      ctx.lineTo(xEnd, y + (side === "left" ? -len * 0.15 : len * 0.15));
      ctx.stroke();
    }

    ctx.restore();
  }

  drawStreaks("left");
  drawStreaks("right");

  // Light grid overlay
  ctx.save();
  ctx.strokeStyle = "rgba(148,163,184,0.1)";
  const gridSize = 48;
  for (let x = 0; x < W; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();

  // Central glow (kept subtle)
  const centerGlow = ctx.createRadialGradient(
    W / 2,
    H / 2,
    0,
    W / 2,
    H / 2,
    H / 1.3
  );
  centerGlow.addColorStop(0, "rgba(129,140,248,0.25)");
  centerGlow.addColorStop(1, "rgba(15,23,42,0)");
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, W, H);

  // ===== TOP TEXT: BRIGHTER =====
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font =
    "800 64px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("NICKEL CITY X-WING", W / 2, 95);

  // WEEK label (brighter)
  if (weekLabel) {
    ctx.fillStyle = "#ffffff"; // bright white
    ctx.font =
      "700 40px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(weekLabel.toUpperCase(), W / 2, 150);
  }

  const awayName = row.awayName || "Away Player";
  const homeName = row.homeName || "Home Player";
  const awayTeam = row.awayTeam || "Away Team";
  const homeTeam = row.homeTeam || "Home Team";

  const awayLogoPath = `/logos/${teamSlug(row.awayTeam)}.png`;
  const homeLogoPath = `/logos/${teamSlug(row.homeTeam)}.png`;
  const mainLogoPath = "/logo.png";

  const [
  awayLogoImg,
  homeLogoImg,
  awayFactionImg,
  homeFactionImg,
  mainLogoImg,
  awayShipGlyphs,
  homeShipGlyphs,
] = await Promise.all([
  loadImageSafe(awayLogoPath),
  loadImageSafe(homeLogoPath),
  loadImageSafe(awayFactionIcon),
  loadImageSafe(homeFactionIcon),
  loadImageSafe(mainLogoPath),
  fetchShipGlyphs(awayListUrl),
  fetchShipGlyphs(homeListUrl),
]);

const hasShips = Boolean(awayShipGlyphs || homeShipGlyphs);

  // ===== CENTER LOGO (PRESERVE ASPECT RATIO) =====
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


  // ===== HOLO PANELS =====
  function drawHoloPanel(
    x: number,
    y: number,
    w: number,
    h: number,
    color: string
  ) {
    const r = 18;
    ctx.save();
    ctx.beginPath();

    ctx.moveTo(x - w / 2 + r, y - h / 2);
    ctx.lineTo(x + w / 2 - r, y - h / 2);
    ctx.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + r);
    ctx.lineTo(x + w / 2, y + h / 2 - r);
    ctx.quadraticCurveTo(x + w / 2, y + h / 2, x + w / 2 - r, y + h / 2);
    ctx.lineTo(x - w / 2 + r, y + h / 2);
    ctx.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - r);
    ctx.lineTo(x - w / 2, y - h / 2 + r);
    ctx.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + r, y - h / 2);

    ctx.closePath();
    ctx.fillStyle = "rgba(15,23,42,0.85)";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }

  const midY = H / 2;
  const leftX = W * 0.25;
  const rightX = W * 0.75;

  const factionSize = 210;
  const teamLogoSize = 320;

  // Faction icons (NO GLOW CIRCLES)
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

  // Slightly larger panels to fit name + ships + team comfortably
  // drawHoloPanel(leftX, midY + 10, 640, 190, "rgb(236,72,153)");
  // drawHoloPanel(rightX, midY + 10, 640, 190, "rgb(56,189,248)");

  // ===== TEXT LAYOUT: NAME / SHIPS / TEAM =====
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Names
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 64px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText(awayName, leftX, hasShips ? midY - 40 : midY - 20);
  ctx.fillText(homeName, rightX, hasShips ? midY - 40 : midY - 20);

  // BIG ship icons row (if we have lists)
  if (hasShips) {
    ctx.save();
    ctx.fillStyle = "#e5e7eb";

    // BIG font size for ship iconographs
    ctx.font = `700 86px "${SHIP_FONT_FAMILY}", system-ui, -apple-system, sans-serif`;

    // Add a soft shadow so they pop off the background
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

  // Team names (below ships)
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "600 42px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText(awayTeam, leftX, hasShips ? midY + 95 : midY + 50);
  ctx.fillText(homeTeam, rightX, hasShips ? midY + 95 : midY + 50);

  // Team logos (PRESERVE ASPECT RATIO)
  if (awayLogoImg) {
    const maxW = 320;
    const maxH = 260;
    let w = awayLogoImg.width;
    let h = awayLogoImg.height;
    const scale = Math.min(maxW / w, maxH / h);
    w *= scale;
    h *= scale;

    // top aligned below panel
    ctx.drawImage(awayLogoImg, leftX - w / 2, midY + 110, w, h);
  }

  if (homeLogoImg) {
    const maxW = 320;
    const maxH = 260;
    let w = homeLogoImg.width;
    let h = homeLogoImg.height;
    const scale = Math.min(maxW / w, maxH / h);
    w *= scale;
    h *= scale;

    ctx.drawImage(homeLogoImg, rightX - w / 2, midY + 110, w, h);
  }


  // ===== GAME LABEL (BRIGHTER) =====
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

  // game15-gregvdan.jpg
  const filename = `game${row.game} - ${fileAway} v ${fileHome}.jpg`;
  downloadBlob(blob, filename);
}

/************************************************************
 *  Ship icon map + local proxy helpers (YASB + LaunchBayNext)
 ************************************************************/
const SHIP_ICON_MAP: Record<string, string> = {
  aggressorassaultfighter: "i",
  alphaclassstarwing: "&",
  arc170starfighter: "c",
  asf01bwing: "b",
  attackshuttle: "g",
  auzituckgunship: "@",
  belbullab22starfighter: "[",
  btanr2ywing: "{",
  btanr2wywing: "{",
  btla4ywing: "y",
  btlbywing: ":",
  btls8kwing: "k",
  clonez95headhunter: "¡",
  cr90corvette: "2",
  croccruiser: "5",
  customizedyt1300lightfreighter: "W",
  droidtrifighter: "+",
  delta7aethersprite: "\\",
  delta7baethersprite: "\\",
  escapecraft: "X",
  eta2actis: "-",
  ewing: "e",
  fangfighter: "M",
  fireball: "0",
  firesprayclasspatrolcraft: "f",
  g1astarfighter: "n",
  gauntletfighter: "|",
  gozanticlasscruiser: "4",
  gr75mediumtransport: "1",
  hmpdroidgunship: ".",
  hwk290lightfreighter: "h",
  hyenaclassdroidbomber: "=",
  jumpmaster5000: "p",
  kihraxzfighter: "r",
  laatigunship: "/",
  lambdaclasst4ashuttle: "l",
  lancerclasspursuitcraft: "L",
  m12lkimogilafighter: "K",
  m3ainterceptor: "s",
  mg100starfortress: "Z",
  modifiedtielnfighter: "C",
  modifiedyt1300lightfreighter: "m",
  nabooroyaln1starfighter: "<",
  nantexclassstarfighter: ";",
  nimbusclassvwing: ",",
  quadrijettransferspacetug: "q",
  raiderclasscorvette: "3",
  resistancetransport: ">",
  resistancetransportpod: "?",
  rogueclassstarfighter: "~",
  rz1awing: "a",
  rz2awing: "E",
  scavengedyt1300: "Y",
  scurrgh6bomber: "H",
  sheathipedeclassshuttle: "%",
  sithinfiltrator: "]",
  st70assaultship: "}",
  starviperclassattackplatform: "v",
  syliureclasshyperspacering: "*",
  t65xwing: "x",
  t70xwing: "w",
  tieadvancedv1: "R",
  tieadvancedx1: "A",
  tieagaggressor: "`",
  tiebainterceptor: "j",
  tiecapunisher: "N",
  tieddefender: "D",
  tiefofighter: "O",
  tieinterceptor: "I",
  tielnfighter: "F",
  tiephphantom: "P",
  tierbheavy: "J",
  tiereaper: "V",
  tiesabomber: "B",
  tiesebomber: "!",
  tiesffighter: "S",
  tieskstriker: "T",
  tievnsilencer: "$",
  tiewiwhispermodifiedinterceptor: "#",
  tridentclassassaultship: "6",
  upsilonclasscommandshuttle: "U",
  ut60duwing: "u",
  v19torrentstarfighter: "^",
  vcx100lightfreighter: "G",
  vt49decimator: "d",
  vultureclassdroidfighter: "_",
  xiclasslightshuttle: "Q",
  yt2400lightfreighter: "o",
  yv666lightfreighter: "t",
  z95af4headhunter: "z",
};

type XwsPilot = {
  ship: string;
};

type XwsResponse = {
  pilots: XwsPilot[];
};

/**
 * Build URL to your proxy route (/api/yasb-xws) for:
 * - YASB: passes full URL as ?yasb=...
 * - LaunchBayNext: pulls the "lbx=" segment and passes it as ?lbx=...
 */
function buildLocalProxyUrl(listUrl: string): string | null {
  // YASB
  if (listUrl.startsWith("https://yasb.app")) {
    return `/api/yasb-xws?yasb=${encodeURIComponent(listUrl)}`;
  }

  // LaunchBayNext
  if (listUrl.startsWith("https://launchbaynext.app")) {
    const idx = listUrl.indexOf("lbx=");
    if (idx === -1) return null;

    let value = listUrl.slice(idx + "lbx=".length);
    const ampIdx = value.indexOf("&");
    if (ampIdx !== -1) {
      value = value.slice(0, ampIdx);
    }

    return `/api/yasb-xws?lbx=${encodeURIComponent(value)}`;
  }

  return null;
}

function shipsToGlyphs(pilots: XwsPilot[]): string {
  return pilots.map((p) => SHIP_ICON_MAP[p.ship] ?? "·").join("");
}

type ListIconsProps = {
  label: string; // "Away list" or "Home list"
  listUrl?: string | null; // YASB or LBN URL
  side: "away" | "home"; // controls alignment layout
};

const ListIcons: React.FC<ListIconsProps> = ({ label, listUrl, side }) => {
  const [glyphs, setGlyphs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!listUrl) {
      setGlyphs(null);
      setError(null);
      return;
    }

    const apiUrl = buildLocalProxyUrl(listUrl);
    if (!apiUrl) {
      setGlyphs(null);
      setError(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetch(apiUrl, { cache: "no-store" }).catch((err) => {
          console.warn("XWS proxy fetch failed:", err);
          return null;
        });

        if (!res || !res.ok) {
          if (!cancelled) {
            setGlyphs(null);
            setError("!");
          }
          return;
        }

        const data = (await res.json()) as XwsResponse;
        const iconString = shipsToGlyphs(data.pilots ?? []);

        if (!cancelled) {
          setGlyphs(iconString);
          setError(null);
        }
      } catch (e) {
        console.error("Error fetching XWS via proxy:", e);
        if (!cancelled) {
          setGlyphs(null);
          setError("!");
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [listUrl]);

  if (!listUrl) return null;

  // Icon block (big glyphs, same height as 48x48 faction icon)
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
  ) : !glyphs && !error ? (
    <div className="h-12 flex items-center text-zinc-500 text-xs">…</div>
  ) : (
    <div className="h-12 flex items-center font-mono text-xs text-red-400">
      !
    </div>
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

  // For AWAY (left column): list link towards center, icons towards outer side
  // For HOME (right column): list link towards center, icons towards outer side
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
}: Props) {
  const searchParams = useSearchParams();
  const urlQRaw = (searchParams.get("q") ?? "").trim();
  const selectedWeekRaw = (searchParams.get("w") ?? "").trim(); // e.g. "WEEK 3"

  // Parse week numbers so we can render the week-strip
  const activeNum = useMemo(
    () => parseWeekNum(activeWeek ?? null),
    [activeWeek]
  );
  const selectedNum = useMemo(
    () => parseWeekNum(selectedWeekRaw || null),
    [selectedWeekRaw]
  );

  // Past weeks to render as pills = 1..active
  const weeksPills = useMemo(() => {
    if (!activeNum || activeNum <= 0) return [] as string[];
    return Array.from({ length: activeNum }, (_, i) => formatWeekLabel(i + 1));
  }, [activeNum]);

  // Clean the incoming data
  const cleaned = useMemo(() => {
    return (data || []).filter((m) => /^\d+$/.test((m.game || "").trim()));
  }, [data]);

  // Derive a single-team filter from URL ?q=
  const urlSelectedTeam = useMemo(() => {
    if (!urlQRaw) return "";
    return pickTeamFilter(urlQRaw, cleaned);
  }, [urlQRaw, cleaned]);
  const [query, setQuery] = useState(urlSelectedTeam);

  const [onlyCompleted, setOnlyCompleted] = useState(false);
  const [onlyScheduled, setOnlyScheduled] = useState(false);

  // track which game is generating (for button disabled state)
  const [generatingGame, setGeneratingGame] = useState<string | null>(null);

  // Keep input synced if the URL changes (clicking a different series or week)
  useEffect(() => {
    setQuery(urlSelectedTeam);
  }, [urlSelectedTeam]);

  const selectedTeam = useMemo(
    () => pickTeamFilter(query, cleaned),
    [query, cleaned]
  );

  // Precompute lookups
  const indById = useMemo(() => statsMapFromIndRows(indStats), [indStats]);

  // Filtering + ordering
  const filtered = useMemo(() => {
    const q = (query || "").toLowerCase().trim();
    let rows = !q
      ? cleaned
      : cleaned.filter((m) =>
          [
            m.awayId,
            m.homeId,
            m.awayName,
            m.homeName,
            m.awayTeam,
            m.homeTeam,
            m.scenario,
          ]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
        );

    rows = rows.filter((m) => {
      const isCompleted = Boolean((m.scenario || "").trim());
      if (onlyCompleted && !isCompleted) return false;
      if (onlyScheduled && isCompleted) return false;
      return true;
    });

    rows.sort((a, b) => {
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

      if (aInSel !== bInSel) return bInSel - aInSel; // selected team first
      return gameNum(a.game) - gameNum(b.game);
    });

    return rows;
  }, [cleaned, query, onlyCompleted, onlyScheduled, selectedTeam]);

  const scheduleEnabled =
    Boolean(weekLabel && scheduleWeek) &&
    weekLabel!.trim() === scheduleWeek!.trim();

  // Styles for the week-strip buttons (match HomeTabs vibe)
  const btnBase =
    "group relative overflow-hidden rounded-xl border bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-pink-500/50";
  const gradient =
    "pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100";

  // Colors (winner = GREEN, loser = RED)
  const GREEN = "34,197,94";
  const RED = "239,68,68";
  const TIE = "99,102,241";

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800">
      <h2 className="text-2xl font-bold text-center mb-4">
        <span className="text-pink-400">WEEKLY</span>{" "}
        <span className="text-cyan-400">MATCHUPS</span>
        {weekLabel ? (
          <span className="ml-2 text-zinc-400 text-base">• {weekLabel}</span>
        ) : null}
      </h2>

      {/* Week selector strip (Current = active, gold; others are past weeks) */}
      {activeNum && activeNum > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-5">
          {weeksPills.map((wk) => {
            const isActive =
              wk.toUpperCase() === (activeWeek || "").toUpperCase();
            const selected =
              (!selectedWeekRaw && isActive) ||
              wk.toUpperCase() === (selectedWeekRaw || "").toUpperCase();

            const href = isActive
              ? "?tab=matchups"
              : `?tab=matchups&w=${encodeURIComponent(wk)}`;

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
          placeholder="Filter by NCXID, Name, Team, or Scenario..."
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
          Completed only
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
          Scheduled only
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
              awayScore > homeScore
                ? "away"
                : homeScore > awayScore
                ? "home"
                : "tie";

            const awayLogo = `/logos/${teamSlug(row.awayTeam)}.png`;
            const homeLogo = `/logos/${teamSlug(row.homeTeam)}.png`;

            const leftColor =
              winner === "away" ? GREEN : winner === "home" ? RED : TIE;
            const rightColor =
              winner === "home" ? GREEN : winner === "away" ? RED : TIE;

            const gradientStyle: React.CSSProperties = {
              backgroundImage: `
                linear-gradient(to right, rgba(${leftColor},0.35) 0%, rgba(0,0,0,0) 25%),
                linear-gradient(to left,  rgba(${rightColor},0.35) 0%, rgba(0,0,0,0) 25%)
              `,
            };

            // Optional stream-schedule badge
            const sched =
              scheduleEnabled && scheduleMap?.[row.game]
                ? ` — ${scheduleMap[row.game].day.toUpperCase()}, ${scheduleMap[
                    row.game
                  ].slot.toUpperCase()}`
                : "";

            // Season summaries (from IndStats)
            const awaySeason = row.awayId
              ? indById.get(row.awayId)
              : undefined;
            const homeSeason = row.homeId
              ? indById.get(row.homeId)
              : undefined;

            // Faction icons (from factionMap + /public/factions)
            const awayFactionIcon = factionIconSrc(factionMap?.[row.awayId]);
            const homeFactionIcon = factionIconSrc(factionMap?.[row.homeId]);

            // Optional tooltip helpers if you store handles like name#1234
            const awayTooltip = row.awayDiscordTag
              ? `@${row.awayDiscordTag}`
              : "Open DM";
            const homeTooltip = row.homeDiscordTag
              ? `@${row.homeDiscordTag}`
              : "Open DM";

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
                  awayListUrl,  // <- important
                  homeListUrl,  // <- important
                });
              } finally {
                setGeneratingGame((current) =>
                  current === row.game ? null : current
                );
              }
            };


            // List URLs (YASB or LBN) for this game
            const awayListUrl = listsForWeek?.[row.game]?.awayList || null;
            const homeListUrl = listsForWeek?.[row.game]?.homeList || null;

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

                {/* Create thumbnail button */}
                <div className="absolute -top-3 -right-3">
                  <button
                    type="button"
                    onClick={handleClickThumbnail}
                    disabled={generatingGame === row.game}
                    className="inline-flex items-center rounded-lg bg-purple-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md hover:bg-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {generatingGame === row.game
                      ? "Generating…"
                      : "Create thumbnail"}
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
                        awayScore > homeScore
                          ? "text-pink-400 font-bold"
                          : "text-zinc-300"
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
                        homeScore > awayScore
                          ? "text-cyan-400 font-bold"
                          : "text-zinc-300"
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
                      titleSuffix={awayTooltip}
                      className="text-pink-400 font-semibold"
                    />
                    {row.awayId ? (
                      <span className="rounded-full bg-zinc-800/80 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200 font-mono">
                        {row.awayId}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-3 justify-end">
                    {row.homeId ? (
                      <span className="rounded-full bg-zinc-800/80 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200 font-mono">
                        {row.homeId}
                      </span>
                    ) : null}
                    <PlayerDMLink
                      name={row.homeName || "—"}
                      discordId={row.homeDiscordId}
                      titleSuffix={homeTooltip}
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

                {/* Lists (YASB or LBN) + big ship icons ABOVE the stats rail */}
                {(awayListUrl || homeListUrl) && (
                  <div className="relative z-10 mt-4 flex items-center justify-between gap-6">
                    <div className="flex-1 flex justify-start">
                      {awayListUrl && (
                        <ListIcons
                          label="Away list"
                          listUrl={awayListUrl}
                          side="away"
                        />
                      )}
                    </div>
                    <div className="flex-1 flex justify-end">
                      {homeListUrl && (
                        <ListIcons
                          label="Home list"
                          listUrl={homeListUrl}
                          side="home"
                        />
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
                        {awaySeason
                          ? `${awaySeason.wins}-${awaySeason.losses}`
                          : "—"}
                      </span>
                    </div>
                    <div>
                      Win%:{" "}
                      <span className="text-zinc-100">
                        {awaySeason?.winPct ?? "—"}
                      </span>
                      {" • "}SoS:{" "}
                      <span className="text-zinc-100">
                        {awaySeason?.sos ?? "—"}
                      </span>
                      {" • "}Potato:{" "}
                      <span className="text-zinc-100">
                        {awaySeason?.potato ?? "—"}
                      </span>
                    </div>
                  </div>

                  <div className="bg-zinc-800/60 rounded-lg px-3 py-2 text-right">
                    <div>
                      Record:{" "}
                      <span className="text-zinc-100">
                        {homeSeason
                          ? `${homeSeason.wins}-${homeSeason.losses}`
                          : "—"}
                      </span>
                    </div>
                    <div>
                      Win%:{" "}
                      <span className="text-zinc-100">
                        {homeSeason?.winPct ?? "—"}
                      </span>
                      {" • "}SoS:{" "}
                      <span className="text-zinc-100">
                        {homeSeason?.sos ?? "—"}
                      </span>
                      {" • "}Potato:{" "}
                      <span className="text-zinc-100">
                        {homeSeason?.potato ?? "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
