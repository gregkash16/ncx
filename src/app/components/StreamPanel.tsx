"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { teamSlug } from "@/lib/slug";

/* ─── Types ─── */
type PlayerInfo = {
  ncxid: string;
  name: string;
  team: string;
  faction: string;
  wins: string;
  losses: string;
  points: string;
  plms: string;
  games: string;
  winPct: string;
  ppg: string;
  efficiency: string;
  war: string;
};

type Signup = {
  id: number;
  weekLabel: string;
  slotDay: "tuesday" | "thursday";
  slotGame: number;
  ncxid: string;
  opponentNcxid: string | null;
  createdAt: string;
  matchupGame: string | null;
  player: PlayerInfo | null;
  opponent: PlayerInfo | null;
};

type Matchup = {
  game: string;
  awayId: string;
  awayName: string;
  awayTeam: string;
  homeId: string;
  homeName: string;
  homeTeam: string;
  scenario: string;
};

type ApiResponse = {
  currentWeek: string;
  week: string;
  signups: Signup[];
  callerNcxid: string | null;
  callerSignup: { slotDay: string; slotGame: number } | null;
  isAdmin: boolean;
  matchups: Matchup[];
};

/* ─── Faction image map ─── */
const FACTION_FILE: Record<string, string> = {
  REBELS: "Rebels.webp",
  EMPIRE: "Empire.webp",
  REPUBLIC: "Republic.webp",
  CIS: "CIS.webp",
  RESISTANCE: "Resistance.webp",
  "FIRST ORDER": "First Order.webp",
  SCUM: "Scum.webp",
};

function factionImage(faction: string): string | null {
  const key = (faction || "").toUpperCase().trim();
  return FACTION_FILE[key] || null;
}

/* ─── Time zone helpers ─── */
const SLOT_TIMES_ET = ["6:30 PM", "~7:45 PM", "~9:00 PM"];

function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "America/New_York";
  }
}

function convertETtoLocal(etTime: string, tz: string): string {
  try {
    const clean = etTime.replace(/^~/, "");
    const [time, ampm] = clean.split(" ");
    const [hStr, mStr] = time.split(":");
    let hours = parseInt(hStr, 10);
    if (ampm === "PM" && hours !== 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    const minutes = parseInt(mStr, 10);

    const refDate = new Date("2026-04-07T00:00:00-04:00");
    refDate.setUTCHours(hours + 4, minutes, 0, 0);

    return refDate.toLocaleTimeString("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return etTime;
  }
}

function getShortTzLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

/* ─── Component ─── */
export default function StreamPanel() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showTzWidget, setShowTzWidget] = useState(false);

  const localTz = getLocalTimezone();
  const isET =
    localTz === "America/New_York" ||
    localTz === "America/Detroit" ||
    localTz === "US/Eastern";

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/stream-signup");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSignup(slotDay: "tuesday" | "thursday", slotGame: number) {
    const key = `${slotDay}-${slotGame}`;
    setActionLoading(key);
    try {
      const res = await fetch("/api/stream-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotDay, slotGame }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Failed to sign up");
        return;
      }
      await fetchData();
    } catch {
      alert("Network error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAdminAssign(
    slotDay: "tuesday" | "thursday",
    slotGame: number,
    gameNumber: string
  ) {
    const key = `assign-${slotDay}-${slotGame}`;
    setActionLoading(key);
    try {
      const res = await fetch("/api/stream-signup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotDay, slotGame, gameNumber }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Failed to assign");
        return;
      }
      await fetchData();
    } catch {
      alert("Network error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(signupId: number) {
    if (!confirm("Remove this signup?")) return;
    setActionLoading(`del-${signupId}`);
    try {
      const res = await fetch("/api/stream-signup", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: signupId }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Failed to delete");
        return;
      }
      await fetchData();
    } catch {
      alert("Network error");
    } finally {
      setActionLoading(null);
    }
  }

  /* ─── Loading / Error ─── */
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl py-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent opacity-60" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-7xl py-12 text-center text-red-400">
        Failed to load stream schedule. {error}
      </div>
    );
  }

  const { signups, callerNcxid, callerSignup, isAdmin: admin } = data;

  function getSignup(day: "tuesday" | "thursday", game: number): Signup | undefined {
    return signups.find((s) => s.slotDay === day && s.slotGame === game);
  }

  function canSignUp(): boolean {
    return !!callerNcxid && !callerSignup;
  }

  /* ─── Player card ─── */
  function PlayerCard({ info }: { info: PlayerInfo | null }) {
    if (!info) return null;

    const fImg = factionImage(info.faction);
    const logoSlug = teamSlug(info.team);

    return (
      <div className="flex-1 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)" }}>
        {/* Team logo + faction logo row */}
        <div className="flex items-center gap-3 mb-3">
          {/* Team logo */}
          <div className="relative h-12 w-12 flex-shrink-0 rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <Image
              src={`/logos/${logoSlug}.webp`}
              alt={info.team}
              fill
              className="object-contain p-1"
            />
          </div>

          {/* Name + IDs */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold leading-tight" style={{ color: "var(--ncx-text-primary)" }}>
              {info.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-wider"
                style={{ color: "rgba(var(--ncx-primary-rgb), 0.9)" }}
              >
                {info.ncxid}
              </span>
              <span className="text-xs font-semibold" style={{ color: "var(--ncx-text-muted)" }}>
                {info.team}
              </span>
            </div>
          </div>

          {/* Faction logo */}
          {fImg && (
            <div className="relative h-10 w-10 flex-shrink-0">
              <Image
                src={`/factions/${fImg}`}
                alt={info.faction}
                fill
                className="object-contain drop-shadow-lg"
              />
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-5 gap-1 text-center rounded-lg py-2 px-1" style={{ background: "rgba(255,255,255,0.03)" }}>
          <StatCell label="Record" value={`${info.wins}-${info.losses}`} />
          <StatCell label="Win %" value={`${(parseFloat(info.winPct) * 100 || 0).toFixed(0)}%`} />
          <StatCell label="PPG" value={parseFloat(info.ppg).toFixed(1)} />
          <StatCell label="Eff" value={parseFloat(info.efficiency).toFixed(1)} />
          <StatCell label="WAR" value={parseFloat(info.war).toFixed(2)} />
        </div>
      </div>
    );
  }

  function StatCell({ label, value }: { label: string; value: string }) {
    return (
      <div>
        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ncx-text-muted)" }}>
          {label}
        </p>
        <p className="text-sm font-bold" style={{ color: "var(--ncx-text-primary)" }}>
          {value}
        </p>
      </div>
    );
  }

  /* ─── Admin assign dropdown ─── */
  function AdminAssignDropdown({
    day,
    game,
    matchups,
    signups: currentSignups,
    loading: isLoading,
    onAssign,
  }: {
    day: "tuesday" | "thursday";
    game: number;
    matchups: Matchup[];
    signups: Signup[];
    loading: boolean;
    onAssign: (gameNumber: string) => void;
  }) {
    // Filter out matchups already assigned to a slot this week
    const assignedGames = new Set(
      currentSignups.map((s) => s.matchupGame).filter(Boolean)
    );

    const available = matchups.filter((m) => !assignedGames.has(m.game));

    return (
      <div className="flex items-center gap-2">
        <select
          id={`admin-assign-${day}-${game}`}
          disabled={isLoading}
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              onAssign(e.target.value);
              e.target.value = "";
            }
          }}
          className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
          style={{
            background: "var(--ncx-bg-panel)",
            borderColor: "var(--ncx-border)",
            color: "var(--ncx-text-primary)",
          }}
        >
          <option value="" disabled>
            {isLoading ? "Assigning..." : "Assign a game..."}
          </option>
          {available.map((m) => (
            <option key={m.game} value={m.game}>
              Game #{m.game} — {m.awayName} vs {m.homeName}
            </option>
          ))}
          {available.length === 0 && (
            <option value="" disabled>
              All games assigned
            </option>
          )}
        </select>
      </div>
    );
  }

  /* ─── Slot card ─── */
  function SlotCard({ day, game }: { day: "tuesday" | "thursday"; game: number }) {
    const signup = getSignup(day, game);
    const slotKey = `${day}-${game}`;
    const isActioning = actionLoading === slotKey;
    const etTime = SLOT_TIMES_ET[game - 1];
    const localTime = convertETtoLocal(etTime, localTz);

    return (
      <div
        className="relative overflow-hidden rounded-2xl border transition-all duration-300"
        style={{
          background: "var(--ncx-bg-panel)",
          borderColor: signup
            ? "rgba(var(--ncx-primary-rgb), 0.4)"
            : "var(--ncx-border)",
        }}
      >
        {/* Subtle glow on filled slots */}
        {signup && (
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(var(--ncx-primary-rgb), 1) 0%, transparent 70%)",
            }}
          />
        )}

        {/* Slot header bar */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{
            background: signup
              ? "linear-gradient(to right, rgba(var(--ncx-primary-rgb), 0.15), transparent)"
              : "rgba(255,255,255,0.02)",
          }}
        >
          <div className="flex items-baseline gap-3">
            <span
              className="text-lg font-extrabold uppercase tracking-wider"
              style={{ color: "var(--ncx-text-primary)" }}
            >
              Game {game}
            </span>
            {signup?.matchupGame && (
              <span
                className="rounded-md px-2 py-0.5 text-xs font-bold"
                style={{
                  background: "rgba(var(--ncx-primary-rgb), 0.15)",
                  color: "rgba(var(--ncx-primary-rgb), 0.9)",
                }}
              >
                Week Game #{signup.matchupGame}
              </span>
            )}
            <span className="text-xs font-medium" style={{ color: "var(--ncx-text-muted)" }}>
              {etTime} ET
              {!isET && ` / ${localTime} ${getShortTzLabel(localTz)}`}
            </span>
          </div>
          {signup && admin && (
            <button
              onClick={() => handleDelete(signup.id)}
              disabled={actionLoading === `del-${signup.id}`}
              className="rounded-lg px-3 py-1 text-xs font-bold text-red-400 transition-all hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50"
            >
              {actionLoading === `del-${signup.id}` ? "..." : "Remove"}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-5 pb-5 pt-2">
          {signup ? (
            <div className="flex items-stretch gap-3">
              <div className="flex-1 flex flex-col">
                <span className="mb-1 text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--ncx-text-muted)" }}>Away</span>
                <PlayerCard info={signup.player} />
              </div>
              {/* VS divider */}
              <div className="flex flex-col items-center justify-center px-2">
                <div className="h-8 w-px" style={{ background: "var(--ncx-border)" }} />
                <span
                  className="my-1 text-xs font-extrabold tracking-widest"
                  style={{ color: "var(--ncx-text-muted)" }}
                >
                  VS
                </span>
                <div className="h-8 w-px" style={{ background: "var(--ncx-border)" }} />
              </div>
              <div className="flex-1 flex flex-col">
                <span className="mb-1 text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--ncx-text-muted)" }}>Home</span>
                <PlayerCard info={signup.opponent} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-6">
              {/* Player self-signup */}
              {callerNcxid && canSignUp() ? (
                <button
                  onClick={() => handleSignup(day, game)}
                  disabled={isActioning}
                  className="group relative overflow-hidden rounded-xl border px-10 py-3.5 font-bold transition-all duration-300 hover:scale-105 disabled:opacity-50"
                  style={{
                    background: "var(--ncx-bg-panel)",
                    borderColor: "var(--ncx-border)",
                    color: "var(--ncx-text-primary)",
                  }}
                >
                  <span
                    className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{
                      background:
                        "linear-gradient(to right, var(--ncx-hero-from), var(--ncx-hero-via), var(--ncx-hero-to))",
                    }}
                  />
                  <span className="relative z-10">
                    {isActioning ? "Signing up..." : "Sign Up for This Slot"}
                  </span>
                </button>
              ) : callerSignup ? (
                <p className="text-sm italic" style={{ color: "var(--ncx-text-muted)" }}>
                  You&apos;re signed up for{" "}
                  {callerSignup.slotDay.charAt(0).toUpperCase() + callerSignup.slotDay.slice(1)}{" "}
                  Game {callerSignup.slotGame}
                </p>
              ) : callerNcxid === null && !admin ? (
                <p className="text-sm italic" style={{ color: "var(--ncx-text-muted)" }}>
                  Log in with Discord to sign up
                </p>
              ) : !admin ? (
                <p className="text-sm italic" style={{ color: "var(--ncx-text-muted)" }}>
                  Open Slot
                </p>
              ) : null}

              {/* Admin assign dropdown */}
              {admin && data.matchups.length > 0 && (
                <AdminAssignDropdown
                  day={day}
                  game={game}
                  matchups={data.matchups}
                  signups={signups}
                  loading={actionLoading === `assign-${day}-${game}`}
                  onAssign={(gameNumber) => handleAdminAssign(day, game, gameNumber)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─── Day column ─── */
  function DayColumn({ day, label }: { day: "tuesday" | "thursday"; label: string }) {
    return (
      <div className="flex-1 space-y-5">
        <h3
          className="text-center text-3xl font-black uppercase tracking-[0.2em]"
          style={{ color: "var(--ncx-text-primary)" }}
        >
          {label}
        </h3>
        <SlotCard day={day} game={1} />
        <SlotCard day={day} game={2} />
        <SlotCard day={day} game={3} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[90rem] py-6 px-4">
      {/* Header */}
      <div className="mb-10 text-center">
        <h2 className="text-5xl font-black tracking-tight ncx-hero-title ncx-hero-glow">
          STREAM SCHEDULE
        </h2>
        <p className="mt-2 text-xl font-semibold" style={{ color: "rgba(var(--ncx-primary-rgb), 0.8)" }}>
          {data.week}
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--ncx-text-muted)" }}>
          Sign up to play your match on stream
        </p>

        {/* Time info */}
        <div className="mt-4">
          <p className="text-sm" style={{ color: "var(--ncx-text-muted)" }}>
            Game 1 begins at <strong style={{ color: "var(--ncx-text-primary)" }}>6:30 PM Eastern</strong>
            {" "}&middot; Games run approximately every 75 minutes
          </p>
          {!isET && (
            <button
              onClick={() => setShowTzWidget(!showTzWidget)}
              className="mt-2 text-xs underline decoration-dotted underline-offset-2 transition-colors hover:opacity-80"
              style={{ color: "rgba(var(--ncx-primary-rgb), 0.8)" }}
            >
              {showTzWidget ? "Hide" : "Show"} times in your timezone ({getShortTzLabel(localTz)})
            </button>
          )}
          {showTzWidget && !isET && (
            <div
              className="mx-auto mt-4 inline-flex gap-8 rounded-xl border px-8 py-4"
              style={{
                background: "var(--ncx-bg-panel)",
                borderColor: "var(--ncx-border)",
              }}
            >
              {SLOT_TIMES_ET.map((et, i) => (
                <div key={i} className="text-center">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--ncx-text-muted)" }}>
                    Game {i + 1}
                  </p>
                  <p className="mt-1 text-lg font-extrabold" style={{ color: "var(--ncx-text-primary)" }}>
                    {i > 0 ? "~" : ""}{convertETtoLocal(et, localTz)}
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--ncx-text-muted)" }}>
                    {getShortTzLabel(localTz)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <DayColumn day="tuesday" label="Tuesday" />
        <DayColumn day="thursday" label="Thursday" />
      </div>

      {/* Admin: Update Discord button */}
      {admin && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={async () => {
              if (!confirm("Clear the Discord channel and post the updated schedule?")) return;
              setActionLoading("discord");
              try {
                const res = await fetch("/api/stream-signup/discord", { method: "POST" });
                const json = await res.json();
                if (!res.ok) {
                  alert(json.error || "Failed to update Discord");
                  return;
                }
                alert("Discord updated!");
              } catch {
                alert("Network error");
              } finally {
                setActionLoading(null);
              }
            }}
            disabled={actionLoading === "discord"}
            className="group relative overflow-hidden rounded-xl border px-8 py-3 font-bold transition-all duration-300 hover:scale-105 disabled:opacity-50"
            style={{
              background: "var(--ncx-bg-panel)",
              borderColor: "#5865F2",
              color: "var(--ncx-text-primary)",
            }}
          >
            <span
              className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: "linear-gradient(to right, #5865F2, #7289DA)" }}
            />
            <span className="relative z-10">
              {actionLoading === "discord" ? "Updating Discord..." : "Update Discord"}
            </span>
          </button>
        </div>
      )}

      {/* Footer note */}
      <p className="mt-6 text-center text-sm italic" style={{ color: "var(--ncx-text-muted)" }}>
        Please speak with Greg to remove your game
      </p>
    </div>
  );
}
