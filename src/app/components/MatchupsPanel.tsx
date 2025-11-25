'use client';

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import NextImage from "next/image";
import type { IndRow, FactionMap, MatchRow } from "@/lib/googleSheets";
import { teamSlug } from "@/lib/slug";
import PlayerDMLink from "@/app/components/PlayerDMLink";

type ScheduleMap = Record<string, { day: string; slot: string }>;

interface MatchRowWithDiscord extends MatchRow {
  awayDiscordId?: string | null;
  homeDiscordId?: string | null;
  awayDiscordTag?: string | null;
  homeDiscordTag?: string | null;
}

type Props = {
  data: MatchRow[]; // we accept MatchRow[]; extra fields are read via the extended interface above
  weekLabel?: string;
  activeWeek?: string;
  scheduleWeek?: string;
  scheduleMap?: ScheduleMap;
  indStats?: IndRow[];
  factionMap?: FactionMap;
};

function parseIntSafe(v: string): number {
  const n = Number((v || "").trim());
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
    new Set(rows.flatMap((r) => [r.awayTeam, r.homeTeam]).filter(Boolean) as string[])
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

// --- Thumbnail generation helpers ----
const THUMB_WIDTH = 1920;
const THUMB_HEIGHT = 1080;

type ThumbnailContext = {
  row: MatchRowWithDiscord;
  awaySeason?: IndRow;
  homeSeason?: IndRow;
  awayFactionIcon?: string;
  homeFactionIcon?: string;
  weekLabel?: string;
};

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


function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob | null> {
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

async function generateMatchThumbnail(ctxData: ThumbnailContext) {
  if (typeof window === "undefined") return;

  const { row, awayFactionIcon, homeFactionIcon, weekLabel } = ctxData;

  const canvas = document.createElement("canvas");
  canvas.width = THUMB_WIDTH;
  canvas.height = THUMB_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // === BOLDER BACKGROUND ===
  const baseGrad = ctx.createLinearGradient(0, 0, THUMB_WIDTH, THUMB_HEIGHT);
  baseGrad.addColorStop(0, "#020617"); // slate-950
  baseGrad.addColorStop(0.5, "#020617");
  baseGrad.addColorStop(1, "#020617");
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, THUMB_WIDTH, THUMB_HEIGHT);

  // Left pink overlay (stronger)
  const leftGrad = ctx.createLinearGradient(0, 0, THUMB_WIDTH / 2, 0);
  leftGrad.addColorStop(0, "rgba(236,72,153,0.9)");  // pink-500
  leftGrad.addColorStop(0.7, "rgba(236,72,153,0.2)");
  leftGrad.addColorStop(1, "rgba(236,72,153,0.0)");
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, THUMB_WIDTH / 2, THUMB_HEIGHT);

  // Right cyan overlay (stronger)
  const rightGrad = ctx.createLinearGradient(THUMB_WIDTH / 2, 0, THUMB_WIDTH, 0);
  rightGrad.addColorStop(0, "rgba(34,211,238,0.0)");
  rightGrad.addColorStop(0.3, "rgba(34,211,238,0.2)");
  rightGrad.addColorStop(1, "rgba(34,211,238,0.9)"); // cyan-400
  ctx.fillStyle = rightGrad;
  ctx.fillRect(THUMB_WIDTH / 2, 0, THUMB_WIDTH / 2, THUMB_HEIGHT);

  // Stronger center glow
  const centerGrad = ctx.createRadialGradient(
    THUMB_WIDTH / 2,
    THUMB_HEIGHT / 2,
    0,
    THUMB_WIDTH / 2,
    THUMB_HEIGHT / 2,
    THUMB_HEIGHT / 1.2
  );
  centerGrad.addColorStop(0, "rgba(129,140,248,0.35)"); // indigo-400
  centerGrad.addColorStop(1, "rgba(15,23,42,0)");
  ctx.fillStyle = centerGrad;
  ctx.fillRect(0, 0, THUMB_WIDTH, THUMB_HEIGHT);

  // Top label: NICKEL CITY X-WING
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "1000 100px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("NICKEL CITY X-WING", THUMB_WIDTH / 2, 90);

  if (weekLabel) {
    ctx.fillStyle = "#a5b4fc"; // indigo-300
    ctx.font = "500 36px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(weekLabel.toUpperCase(), THUMB_WIDTH / 2, 140);
  }

  const awayName = row.awayName || "Away Player";
  const homeName = row.homeName || "Home Player";
  const awayTeam = row.awayTeam || "Away Team";
  const homeTeam = row.homeTeam || "Home Team";

  const awayLogoPath = `/logos/${teamSlug(row.awayTeam)}.png`;
  const homeLogoPath = `/logos/${teamSlug(row.homeTeam)}.png`;
  const mainLogoPath = "/logo.png";

  const [awayLogoImg, homeLogoImg, awayFactionImg, homeFactionImg, mainLogoImg] =
    await Promise.all([
      loadImageSafe(awayLogoPath),
      loadImageSafe(homeLogoPath),
      loadImageSafe(awayFactionIcon),
      loadImageSafe(homeFactionIcon),
      loadImageSafe(mainLogoPath),
    ]);

  // Center logo instead of VS
  if (mainLogoImg) {
    const logoSize = 460;
    const cx = THUMB_WIDTH / 2 - logoSize / 2;
    const cy = THUMB_HEIGHT / 2 - logoSize / 2 + 10;
    ctx.drawImage(mainLogoImg, cx, cy, logoSize, logoSize);
  }

  // === LAYOUT CONSTANTS ===
  const midY = THUMB_HEIGHT / 2;

  const factionSize = 180;   // bigger
  const teamLogoSize = 320;  // bigger

  const leftCenterX = THUMB_WIDTH * 0.25;
  const rightCenterX = THUMB_WIDTH * 0.75;

  // Y positions for stack on each side:
  // Faction center, Name, Team, Team Logo center
  const factionCenterY = midY - 250;
  const nameY = midY - 40;
  const teamY = nameY + 70;
  const teamLogoCenterY = midY + 220;

  // ===== LEFT SIDE (Away) =====
  ctx.textAlign = "center";

  // Faction icon ABOVE name (higher than before, larger)
  if (awayFactionImg) {
    ctx.drawImage(
      awayFactionImg,
      leftCenterX - factionSize / 2,
      factionCenterY - factionSize / 2,
      factionSize,
      factionSize
    );
  }

  // Away player name
  ctx.fillStyle = "#f9a8d4"; // pink-300
  ctx.font = "800 84px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText(awayName, leftCenterX, nameY);

  // Away team name
  ctx.fillStyle = "#f9fafb";
  ctx.font = "600 52px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText(awayTeam, leftCenterX, teamY);

  // Team logo BELOW team name (bigger, centered)
  if (awayLogoImg) {
    ctx.drawImage(
      awayLogoImg,
      leftCenterX - teamLogoSize / 2,
      teamLogoCenterY - teamLogoSize / 2,
      teamLogoSize,
      teamLogoSize
    );
  }

  // ===== RIGHT SIDE (Home) =====
  // Faction icon
  if (homeFactionImg) {
    ctx.drawImage(
      homeFactionImg,
      rightCenterX - factionSize / 2,
      factionCenterY - factionSize / 2,
      factionSize,
      factionSize
    );
  }

  // Home player name
  ctx.fillStyle = "#7dd3fc"; // cyan-300
  ctx.font = "800 84px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText(homeName, rightCenterX, nameY);

  // Home team name
  ctx.fillStyle = "#f9fafb";
  ctx.font = "600 52px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText(homeTeam, rightCenterX, teamY);

  // Home team logo
  if (homeLogoImg) {
    ctx.drawImage(
      homeLogoImg,
      rightCenterX - teamLogoSize / 2,
      teamLogoCenterY - teamLogoSize / 2,
      teamLogoSize,
      teamLogoSize
    );
  }

  // Subfooter: GAME X (no score)
  ctx.textAlign = "center";
  ctx.fillStyle = "#9ca3af";
  ctx.font = "500 32px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const gameLabel = `GAME ${row.game}`;
  ctx.fillText(gameLabel, THUMB_WIDTH / 2, THUMB_HEIGHT - 70);

  const blob = await canvasToBlob(canvas, 0.9);
  if (!blob) return;

  const safeSlug = (s: string) =>
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "team";

  const filename = `Game-${row.game}-${safeSlug(awayTeam)}-vs-${safeSlug(homeTeam)}.jpg`;
  downloadBlob(blob, filename);
}


// --- Component ----

export default function MatchupsPanel({
  data,
  weekLabel,
  activeWeek,
  scheduleWeek,
  scheduleMap,
  indStats,
  factionMap,
}: Props) {
  const searchParams = useSearchParams();
  const urlQRaw = (searchParams.get("q") ?? "").trim();
  const selectedWeekRaw = (searchParams.get("w") ?? "").trim(); // e.g. "WEEK 3"

  // Parse week numbers so we can render the week-strip
  const activeNum = useMemo(() => parseWeekNum(activeWeek ?? null), [activeWeek]);
  const selectedNum = useMemo(() => parseWeekNum(selectedWeekRaw || null), [selectedWeekRaw]);

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

  const selectedTeam = useMemo(() => pickTeamFilter(query, cleaned), [query, cleaned]);

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
            .some((v) => v.toLowerCase().includes(q))
        );

    rows = rows.filter((m) => {
      const isCompleted = Boolean((m.scenario || "").trim());
      if (onlyCompleted && !isCompleted) return false;
      if (onlyScheduled && isCompleted) return false;
      return true;
    });

    rows.sort((a, b) => {
      const aInSel =
        selectedTeam && (a.awayTeam === selectedTeam || a.homeTeam === selectedTeam) ? 1 : 0;
      const bInSel =
        selectedTeam && (b.awayTeam === selectedTeam || b.homeTeam === selectedTeam) ? 1 : 0;

      if (aInSel !== bInSel) return bInSel - aInSel; // selected team first
      return gameNum(a.game) - gameNum(b.game);
    });

    return rows;
  }, [cleaned, query, onlyCompleted, onlyScheduled, selectedTeam]);

  const scheduleEnabled =
    Boolean(weekLabel && scheduleWeek) && weekLabel!.trim() === scheduleWeek!.trim();

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
        {weekLabel ? <span className="ml-2 text-zinc-400 text-base">• {weekLabel}</span> : null}
      </h2>

      {/* Week selector strip (Current = active, gold; others are past weeks) */}
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
              awayScore > homeScore ? "away" : homeScore > awayScore ? "home" : "tie";

            const awayLogo = `/logos/${teamSlug(row.awayTeam)}.png`;
            const homeLogo = `/logos/${teamSlug(row.homeTeam)}.png`;

            const leftColor = winner === "away" ? GREEN : winner === "home" ? RED : TIE;
            const rightColor = winner === "home" ? GREEN : winner === "away" ? RED : TIE;

            const gradientStyle: React.CSSProperties = {
              backgroundImage: `
                linear-gradient(to right, rgba(${leftColor},0.35) 0%, rgba(0,0,0,0) 25%),
                linear-gradient(to left,  rgba(${rightColor},0.35) 0%, rgba(0,0,0,0) 25%)
              `,
            };

            // Optional stream-schedule badge
            const sched =
              scheduleEnabled && scheduleMap?.[row.game]
                ? ` — ${scheduleMap[row.game].day.toUpperCase()}, ${scheduleMap[row.game].slot.toUpperCase()}`
                : "";

            // Season summaries (from IndStats)
            const awaySeason = row.awayId ? indById.get(row.awayId) : undefined;
            const homeSeason = row.homeId ? indById.get(row.homeId) : undefined;

            // Faction icons (from factionMap + /public/factions)
            const awayFactionIcon = factionIconSrc(factionMap?.[row.awayId]);
            const homeFactionIcon = factionIconSrc(factionMap?.[row.homeId]);

            // Optional tooltip helpers if you store handles like name#1234
            const awayTooltip = row.awayDiscordTag ? `@${row.awayDiscordTag}` : "Open DM";
            const homeTooltip = row.homeDiscordTag ? `@${row.homeDiscordTag}` : "Open DM";

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

                {/* Create thumbnail button */}
                <div className="absolute -top-3 -right-3">
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
                      {" • "}Potato:{" "}
                      <span className="text-zinc-100">{awaySeason?.potato ?? "—"}</span>
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
                      {" • "}Potato:{" "}
                      <span className="text-zinc-100">{homeSeason?.potato ?? "—"}</span>
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
