"use client";

import { useEffect, useMemo, useState } from "react";
import { teamSlug } from "@/lib/slug";
import { TEAM_COLOR_MAP } from "@/theme/teams";

type LiveEntry = {
  weekLabel: string;
  game: string;
  provider: string;
  streamName: string | null;
  streamUrl: string;
  startedAt: string;
  startedByDiscordId: string | null;
};

type Matchup = {
  week: string;
  game: string | null;
  away_id: string | null;
  away_name: string | null;
  away_team: string | null;
  away_faction: string | null;
  away_pts: number | null;
  home_id: string | null;
  home_name: string | null;
  home_team: string | null;
  home_faction: string | null;
  home_pts: number | null;
  scenario: string | null;
};

const FACTION_FILE: Record<string, string> = {
  REBELS: "Rebels.webp",
  EMPIRE: "Empire.webp",
  REPUBLIC: "Republic.webp",
  CIS: "CIS.webp",
  RESISTANCE: "Resistance.webp",
  "FIRST ORDER": "First Order.webp",
  SCUM: "Scum.webp",
};
function factionIconSrc(faction?: string | null) {
  const key = (faction || "").toUpperCase().trim();
  const file = FACTION_FILE[key];
  return file ? `/factions/${file}` : "";
}

type Table4Row = {
  factionVs: string;
  republic: string;
  cis: string;
  rebels: string;
  empire: string;
  resistance: string;
  firstOrder: string;
  scum: string;
};

const FACTION_T4_KEY: Record<string, keyof Table4Row> = {
  REPUBLIC: "republic",
  CIS: "cis",
  REBELS: "rebels",
  EMPIRE: "empire",
  RESISTANCE: "resistance",
  "FIRST ORDER": "firstOrder",
  SCUM: "scum",
};

function teamColor(teamName?: string | null): string {
  if (!teamName) return "#0f172a";
  return TEAM_COLOR_MAP[teamName.trim().toUpperCase()] ?? "#0f172a";
}

function gameNumInt(g: string | null | undefined): number {
  if (!g) return 0;
  const m = String(g).match(/^\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function seriesRangeFor(game: number): { series: number; lo: number; hi: number } {
  if (!game || game <= 0) return { series: 0, lo: 0, hi: 0 };
  const series = Math.ceil(game / 7);
  return { series, lo: (series - 1) * 7 + 1, hi: series * 7 };
}

function seriesScore(
  matchups: Matchup[] | undefined,
  awayTeam: string,
  homeTeam: string,
  game: number
): { awayWins: number; homeWins: number; played: number } {
  if (!matchups || !awayTeam || !homeTeam) {
    return { awayWins: 0, homeWins: 0, played: 0 };
  }
  const { lo, hi } = seriesRangeFor(game);
  let awayWins = 0;
  let homeWins = 0;
  let played = 0;
  const aUp = awayTeam.trim().toUpperCase();
  const hUp = homeTeam.trim().toUpperCase();

  for (const m of matchups) {
    const g = gameNumInt(m.game);
    if (g < lo || g > hi) continue;
    const mAway = (m.away_team ?? "").trim().toUpperCase();
    const mHome = (m.home_team ?? "").trim().toUpperCase();
    if (!(mAway === aUp && mHome === hUp) && !(mAway === hUp && mHome === aUp)) {
      continue;
    }
    const ap = Number(m.away_pts ?? 0);
    const hp = Number(m.home_pts ?? 0);
    if (ap === 0 && hp === 0) continue;
    played++;
    const awayWonThisGame = mAway === aUp ? ap > hp : hp > ap;
    if (awayWonThisGame) awayWins++;
    else homeWins++;
  }

  return { awayWins, homeWins, played };
}

function fvfCell(
  t4: Table4Row[] | null | undefined,
  awayFaction?: string | null,
  homeFaction?: string | null
): string | null {
  if (!t4 || !awayFaction || !homeFaction) return null;
  const aKey = awayFaction.trim().toUpperCase();
  const hColKey = FACTION_T4_KEY[homeFaction.trim().toUpperCase()];
  if (!hColKey) return null;
  const row = t4.find(
    (r) => (r.factionVs || "").trim().toUpperCase() === aKey
  );
  if (!row) return null;
  const v = row[hColKey];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

const LIVE_MAX_MS = 2 * 60 * 60 * 1000;
const LIVE_CHANGED_EVENT = "ncx:live-changed";

function parseStartedAtMs(s?: string | null): number {
  if (!s) return 0;
  const t = Date.parse(s);
  if (Number.isFinite(t)) return t;
  const m = String(s).match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/
  );
  if (!m) return 0;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

function gameNum(g: string): number {
  const m = (g || "").match(/^\d+/);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
}

type Embed =
  | { kind: "twitch"; channel: string }
  | { kind: "youtube"; videoId: string }
  | { kind: "youtube-channel"; channelId: string }
  | { kind: "unsupported"; url: string };

function parseEmbed(raw: string): Embed {
  const url = (raw || "").trim();
  if (!url) return { kind: "unsupported", url };

  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "twitch.tv" || host.endsWith(".twitch.tv")) {
      const seg = u.pathname.split("/").filter(Boolean);
      if (seg.length >= 1 && seg[0]) {
        return { kind: "twitch", channel: seg[0] };
      }
    }

    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return { kind: "youtube", videoId: id };
    }

    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return { kind: "youtube", videoId: v };

      const seg = u.pathname.split("/").filter(Boolean);
      if (seg[0] === "live" && seg[1]) {
        return { kind: "youtube", videoId: seg[1] };
      }
      if (seg[0] === "embed" && seg[1]) {
        if (seg[1] === "live_stream") {
          const ch = u.searchParams.get("channel");
          if (ch) return { kind: "youtube-channel", channelId: ch };
        } else {
          return { kind: "youtube", videoId: seg[1] };
        }
      }
    }
  } catch {
    // fall through
  }

  return { kind: "unsupported", url };
}

function embedSrc(embed: Embed, parent: string): string | null {
  switch (embed.kind) {
    case "twitch":
      return `https://player.twitch.tv/?channel=${encodeURIComponent(
        embed.channel
      )}&parent=${encodeURIComponent(parent)}&muted=true`;
    case "youtube":
      return `https://www.youtube.com/embed/${encodeURIComponent(
        embed.videoId
      )}?autoplay=1&mute=1`;
    case "youtube-channel":
      return `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(
        embed.channelId
      )}&autoplay=1&mute=1`;
    default:
      return null;
  }
}

function gridClassForCount(n: number): string {
  if (n <= 1) return "grid-cols-1";
  if (n === 2) return "grid-cols-1 lg:grid-cols-2";
  if (n === 3) return "grid-cols-1 lg:grid-cols-3";
  return "grid-cols-1 lg:grid-cols-2";
}

export default function XZonePanel() {
  const [live, setLive] = useState<LiveEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [parent, setParent] = useState<string>("");
  const [matchupsByWeek, setMatchupsByWeek] = useState<Record<string, Matchup[]>>({});
  const [t4, setT4] = useState<Table4Row[] | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setParent(window.location.hostname || "localhost");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/live-matchups", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const list: LiveEntry[] = Array.isArray(json?.live) ? json.live : [];
        if (!cancelled) {
          setLive(list);
          setLoaded(true);
        }
      } catch {
        // ignore transient errors
      }
    }

    load();
    const poll = setInterval(load, 30_000);
    const tick = setInterval(() => setNowMs(Date.now()), 30_000);
    const onLiveChanged = () => load();
    window.addEventListener(LIVE_CHANGED_EVENT, onLiveChanged);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(tick);
      window.removeEventListener(LIVE_CHANGED_EVENT, onLiveChanged);
    };
  }, []);

  const liveWeekKey = useMemo(
    () => Array.from(new Set(live.map((e) => e.weekLabel))).sort().join("|"),
    [live]
  );

  useEffect(() => {
    const weeks = liveWeekKey ? liveWeekKey.split("|") : [];
    if (weeks.length === 0) {
      setMatchupsByWeek({});
      return;
    }

    let cancelled = false;

    (async () => {
      const results = await Promise.all(
        weeks.map(async (w) => {
          try {
            const res = await fetch(
              `/api/matchups?week=${encodeURIComponent(w)}`,
              { cache: "no-store" }
            );
            if (!res.ok) return null;
            const json = await res.json();
            const rows: Matchup[] = Array.isArray(json?.matchups)
              ? json.matchups
              : [];
            return { week: w, rows };
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const map: Record<string, Matchup[]> = {};
      for (const r of results) {
        if (!r) continue;
        map[r.week] = r.rows;
      }
      setMatchupsByWeek(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [liveWeekKey]);

  // FvF matrix (t4) — fetched once, refreshed every 5 min.
  useEffect(() => {
    let cancelled = false;

    async function loadT4() {
      try {
        const res = await fetch("/api/advstats", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && Array.isArray(json?.t4)) {
          setT4(json.t4 as Table4Row[]);
        }
      } catch {
        // ignore
      }
    }
    loadT4();
    const id = setInterval(loadT4, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const effective = useMemo(() => {
    const fresh = live.filter((e) => {
      const t = parseStartedAtMs(e.startedAt);
      return t > 0 && nowMs - t < LIVE_MAX_MS;
    });
    fresh.sort((a, b) => {
      const wA = (a.weekLabel || "").toUpperCase();
      const wB = (b.weekLabel || "").toUpperCase();
      if (wA !== wB) return wA.localeCompare(wB);
      return gameNum(a.game) - gameNum(b.game);
    });
    return fresh.slice(0, 4);
  }, [live, nowMs]);

  const count = effective.length;
  const gridCls = gridClassForCount(count);

  if (!loaded) {
    return (
      <div className="w-full py-20 text-center text-zinc-400">
        Loading X-ZONE…
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="w-full py-24 text-center">
        <div className="mx-auto max-w-lg rounded-2xl border border-zinc-700/60 bg-zinc-900/60 px-6 py-10">
          <div className="text-3xl font-extrabold ncx-hero-title ncx-hero-glow mb-2">
            X-ZONE
          </div>
          <p className="text-zinc-300">
            No live games right now. When a matchup goes LIVE, it&apos;ll show up
            here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-center gap-2">
        <span className="ncx-live-dot-lg" aria-hidden="true" />
        <h2 className="text-2xl font-extrabold tracking-wide ncx-hero-title ncx-hero-glow">
          X-ZONE
        </h2>
        <span className="ml-2 text-xs text-zinc-400">
          {count} live {count === 1 ? "stream" : "streams"}
        </span>
      </div>

      <div className={`grid ${gridCls} gap-3`}>
        {effective.map((entry) => {
          const weekList = matchupsByWeek[entry.weekLabel] ?? [];
          const matchup = weekList.find(
            (m) => (m.game ?? "") === entry.game
          );

          return (
            <StreamTile
              key={`${entry.weekLabel}:${entry.game}`}
              entry={entry}
              matchup={matchup}
              weekList={weekList}
              t4={t4}
              parent={parent}
            />
          );
        })}
      </div>
    </div>
  );
}

function StreamTile({
  entry,
  matchup,
  weekList,
  t4,
  parent,
}: {
  entry: LiveEntry;
  matchup: Matchup | undefined;
  weekList: Matchup[];
  t4: Table4Row[] | null;
  parent: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const embed = parseEmbed(entry.streamUrl);
  const src = parent ? embedSrc(embed, parent) : null;
  const title =
    entry.streamName?.trim() || entry.provider || "Live stream";
  const label = `${entry.weekLabel} • GAME ${entry.game}`;

  return (
    <div className="ncx-live-fire rounded-xl border border-red-500 overflow-hidden bg-black">
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/80">
        <div className="flex items-center gap-2 min-w-0">
          <span className="ncx-live-dot" aria-hidden="true" />
          <span className="text-sm font-semibold text-white truncate">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-zinc-400">
            {label}
          </span>
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? "Hide info panel" : "Show info panel"}
            title={sidebarOpen ? "Hide info panel" : "Show info panel"}
            className="text-[11px] font-semibold text-zinc-300 hover:text-white px-1.5 py-0.5 rounded border border-zinc-700 hover:border-zinc-500 transition-colors"
          >
            {sidebarOpen ? "Hide ›" : "‹ Info"}
          </button>
          <a
            href={entry.streamUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-semibold text-cyan-300 hover:text-cyan-200"
          >
            Open ↗
          </a>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div className="relative flex-1 aspect-video bg-black">
          {src ? (
            <iframe
              src={src}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
              title={`${title} — ${label}`}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-zinc-300">
              Stream can&apos;t be embedded.{" "}
              <a
                href={entry.streamUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-1 text-cyan-300 underline"
              >
                Watch on {entry.provider}
              </a>
            </div>
          )}
        </div>

        {sidebarOpen && (
          <MatchupSidebar
            entry={entry}
            matchup={matchup}
            weekList={weekList}
            t4={t4}
          />
        )}
      </div>
    </div>
  );
}

function MatchupSidebar({
  entry,
  matchup,
  weekList,
  t4,
}: {
  entry: LiveEntry;
  matchup: Matchup | undefined;
  weekList: Matchup[];
  t4: Table4Row[] | null;
}) {
  const gameN = gameNumInt(entry.game);
  const { series, lo } = seriesRangeFor(gameN);
  const gameInSeries = gameN > 0 ? gameN - lo + 1 : 0;

  const awayTeam = matchup?.away_team ?? "";
  const homeTeam = matchup?.home_team ?? "";
  const awayFaction = matchup?.away_faction ?? "";
  const homeFaction = matchup?.home_faction ?? "";

  const { awayWins, homeWins, played } = seriesScore(
    weekList,
    awayTeam,
    homeTeam,
    gameN
  );

  const fvf = fvfCell(t4, awayFaction, homeFaction);
  const fvfReverse = fvfCell(t4, homeFaction, awayFaction);

  const awayColor = teamColor(awayTeam);
  const homeColor = teamColor(homeTeam);

  const awayLogo = awayTeam ? `/logos/${teamSlug(awayTeam)}.webp` : "";
  const homeLogo = homeTeam ? `/logos/${teamSlug(homeTeam)}.webp` : "";
  const awayFactionImg = factionIconSrc(awayFaction);
  const homeFactionImg = factionIconSrc(homeFaction);

  return (
    <aside className="w-full lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-800 bg-zinc-950/85 p-3 text-zinc-100">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-zinc-400">
          {entry.weekLabel}
        </div>
        {series > 0 && (
          <div className="text-[11px] uppercase tracking-wider text-zinc-400">
            Series {series} • G{gameInSeries}/7
          </div>
        )}
      </div>

      {/* Series score */}
      {awayTeam && homeTeam && (
        <div
          className="mb-3 rounded-lg border border-zinc-800 bg-black/40 px-2 py-2 text-center"
          title={played ? `${played} games played in series` : "No games played yet"}
        >
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
            Series Score
          </div>
          <div className="flex items-center justify-center gap-2 font-bold">
            <span style={{ color: awayColor }} className="truncate max-w-[6rem]">
              {awayTeam}
            </span>
            <span className="text-white text-lg tabular-nums">
              {awayWins}
            </span>
            <span className="text-zinc-500">–</span>
            <span className="text-white text-lg tabular-nums">
              {homeWins}
            </span>
            <span style={{ color: homeColor }} className="truncate max-w-[6rem]">
              {homeTeam}
            </span>
          </div>
        </div>
      )}

      {/* Players */}
      {matchup ? (
        <div className="space-y-2">
          <SideRow
            label="AWAY"
            team={awayTeam}
            teamColor={awayColor}
            playerName={matchup.away_name ?? ""}
            playerNcxid={matchup.away_id ?? ""}
            faction={awayFaction}
            factionImg={awayFactionImg}
            teamLogo={awayLogo}
            pts={matchup.away_pts}
          />
          <div className="text-center text-xs font-bold text-zinc-500">vs</div>
          <SideRow
            label="HOME"
            team={homeTeam}
            teamColor={homeColor}
            playerName={matchup.home_name ?? ""}
            playerNcxid={matchup.home_id ?? ""}
            faction={homeFaction}
            factionImg={homeFactionImg}
            teamLogo={homeLogo}
            pts={matchup.home_pts}
          />
        </div>
      ) : (
        <div className="text-xs text-zinc-500 italic">Matchup data unavailable</div>
      )}

      {/* Scenario */}
      {matchup?.scenario && (
        <div className="mt-3 rounded border border-zinc-800 bg-black/30 px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Scenario
          </div>
          <div className="text-sm text-zinc-200">{matchup.scenario}</div>
        </div>
      )}

      {/* Faction vs Faction */}
      {awayFaction && homeFaction && (fvf || fvfReverse) && (
        <div className="mt-3 rounded border border-zinc-800 bg-black/30 px-2 py-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
            Faction vs Faction
          </div>
          <div className="flex items-center gap-2 text-sm">
            {awayFactionImg && (
              <img
                src={awayFactionImg}
                alt={awayFaction}
                className="w-5 h-5 object-contain"
              />
            )}
            <span className="text-zinc-300">{awayFaction}</span>
            <span className="text-zinc-500">vs</span>
            {homeFactionImg && (
              <img
                src={homeFactionImg}
                alt={homeFaction}
                className="w-5 h-5 object-contain"
              />
            )}
            <span className="text-zinc-300">{homeFaction}</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-white tabular-nums">
            {fvf ?? "—"}
          </div>
          {fvfReverse && (
            <div className="mt-0.5 text-[11px] text-zinc-500">
              {homeFaction} vs {awayFaction}: {fvfReverse}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function SideRow({
  label,
  team,
  teamColor,
  playerName,
  playerNcxid,
  faction,
  factionImg,
  teamLogo,
  pts,
}: {
  label: string;
  team: string;
  teamColor: string;
  playerName: string;
  playerNcxid: string;
  faction: string;
  factionImg: string;
  teamLogo: string;
  pts: number | null;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-black/40 px-2 py-2"
      style={{ borderLeft: `4px solid ${teamColor}` }}
    >
      {teamLogo ? (
        <img
          src={teamLogo}
          alt={team}
          className="w-9 h-9 object-contain shrink-0"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
      ) : (
        <div className="w-9 h-9 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
          <span>{label}</span>
          {playerNcxid && (
            <span className="text-zinc-600">• {playerNcxid}</span>
          )}
        </div>
        <div className="text-sm font-semibold truncate" style={{ color: teamColor }}>
          {team || "—"}
        </div>
        <div className="text-xs text-zinc-300 truncate">
          {playerName || "—"}
        </div>
        {faction && (
          <div className="mt-0.5 flex items-center gap-1">
            {factionImg && (
              <img
                src={factionImg}
                alt={faction}
                className="w-3.5 h-3.5 object-contain"
              />
            )}
            <span className="text-[11px] text-zinc-400">{faction}</span>
          </div>
        )}
      </div>
      {pts != null && pts > 0 && (
        <div className="text-lg font-bold text-white tabular-nums">{pts}</div>
      )}
    </div>
  );
}
