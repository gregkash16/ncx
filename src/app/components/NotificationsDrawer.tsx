"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../../components/ui/sheet";
import { Check, Bell, BellOff } from "lucide-react";

type Props = {
  /** Button that opens the drawer */
  children: React.ReactNode;
  /** Optional custom title for the drawer */
  title?: string;
  /** Optional nav links to render at the top (used on Desktop) */
  navLinks?: { href: string; label: string }[];
};

export type PushPrefs = { allTeams: boolean; teams: string[] };

/* ----------------------------------------------------------
   Helpers
---------------------------------------------------------- */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function saveSubAndPrefs(sub: PushSubscription, prefs: PushPrefs) {
  const body = JSON.stringify({ subscription: sub.toJSON(), prefs });
  const res = await fetch("/api/push/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) throw new Error("Failed to save subscription/prefs");
}

// Capability guards (fixes “Can’t find variable: Notification”)
const hasNotifications = () =>
  typeof window !== "undefined" && typeof Notification !== "undefined";

const hasPush = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window;

/* ----------------------------------------------------------
   Component
---------------------------------------------------------- */
export default function NotificationsDrawer({
  children,
  title = "Notifications",
  navLinks,
}: Props) {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [prefs, setPrefs] = useState<PushPrefs>({ allTeams: true, teams: [] });
  const [teams, setTeams] = useState<string[]>([]);

  // Prefer env; if missing, we’ll fetch from the endpoint
  const [vapidKey, setVapidKey] = useState(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""
  );

  // Load team list via /api/teams
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/teams");
        const data = await res.json();
        if (data?.ok && Array.isArray(data.teams)) setTeams(data.teams);
      } catch (e) {
        console.warn("Failed to load team list", e);
      }
    })();
  }, []);

  // Ensure we have a VAPID key even if env unavailable at build
  useEffect(() => {
    if (vapidKey) return;
    (async () => {
      try {
        const { key } = await fetch("/api/push/vapidPublicKey").then((r) =>
          r.json()
        );
        if (key) setVapidKey(String(key));
      } catch {}
    })();
  }, [vapidKey]);

  // Initial capability check (guard Notification access)
  useEffect(() => {
    setSupported(hasPush() && hasNotifications());
    setPermission(
      hasNotifications() ? (Notification.permission as NotificationPermission) : "default"
    );
  }, []);

  // Load prefs when drawer opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker?.ready;
        const sub = await reg?.pushManager.getSubscription();
        setSubscribed(!!sub);
        if (sub) {
          const res = await fetch("/api/push/save", { method: "GET" });
          if (res.ok) {
            const data = await res.json();
            if (data?.prefs) setPrefs(data.prefs);
          }
        }
      } catch (e) {
        console.warn("Failed to load push prefs", e);
      }
    })();
  }, [open]);

  const selectedSet = useMemo(() => new Set(prefs.teams), [prefs.teams]);

  async function requestPermission() {
    if (!supported || !hasNotifications()) return;
    if (permission === "granted") return;
    const p = await Notification.requestPermission();
    setPermission(p);
  }

  async function toggleSubscribe() {
    try {
      setLoading(true);
      if (!vapidKey) throw new Error("Missing VAPID public key");

      if (!subscribed) {
        if (!hasNotifications()) {
          throw new Error("Notifications are not supported on this device/browser.");
        }
        if (permission !== "granted") {
          const p = await Notification.requestPermission();
          setPermission(p);
          if (p !== "granted") return;
        }
        const reg = await navigator.serviceWorker?.ready;
        if (!reg) throw new Error("No active service worker");
        const key = urlBase64ToUint8Array(vapidKey);
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key as unknown as BufferSource,
        });
        await saveSubAndPrefs(sub, prefs);
        setSubscribed(true);
      } else {
        const reg = await navigator.serviceWorker?.ready;
        const sub = await reg?.pushManager.getSubscription();
        await fetch("/api/push/save", { method: "DELETE" });
        await sub?.unsubscribe();
        setSubscribed(false);
      }
    } catch (e) {
      alert((e as Error).message || "Subscription error");
    } finally {
      setLoading(false);
    }
  }

  async function onToggleAllTeams(v: boolean) {
    const next: PushPrefs = { allTeams: v, teams: v ? [] : prefs.teams };
    setPrefs(next);
    await maybePersist(next);
  }

  async function onToggleTeam(team: string) {
    const next = new Set(prefs.teams);
    next.has(team) ? next.delete(team) : next.add(team);
    const updated: PushPrefs = { allTeams: false, teams: Array.from(next) };
    setPrefs(updated);
    await maybePersist(updated);
  }

  async function maybePersist(next: PushPrefs) {
    try {
      const reg = await navigator.serviceWorker?.ready;
      const sub = await reg?.pushManager.getSubscription();
      if (sub) await saveSubAndPrefs(sub, next);
    } catch (e) {
      console.warn("Prefs save skipped:", e);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="left"
        className="w-[92vw] sm:w-96 bg-neutral-950 text-neutral-100 border-neutral-800 p-0"
      >
        <div className="flex h-[100dvh] flex-col">
          {/* Sticky header */}
          <div className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-3 py-3 pb-[env(safe-area-inset-bottom)]">
            {/* OPTIONAL NAV (for Desktop) */}
            {navLinks?.length ? (
              <nav className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-2 text-sm">
                <ul className="grid gap-1">
                  {navLinks.map((l) => (
                    <li key={l.href}>
                      <a
                        href={l.href}
                        className="block rounded-lg px-2 py-1 hover:bg-neutral-800"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}

            {/* Subscribe/Unsubscribe */}
            <div className="mt-1 space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Push notifications</div>
                  <div className="text-xs text-neutral-400">
                    {supported
                      ? permission === "granted"
                        ? "Enabled in browser"
                        : "Requires browser permission"
                      : "Not supported on this device"}
                  </div>
                </div>
                <button
                  onClick={toggleSubscribe}
                  disabled={!supported || loading}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium border transition ${
                    subscribed
                      ? "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20"
                      : "border-neutral-700 bg-neutral-800 hover:bg-neutral-700"
                  }`}
                >
                  {subscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  {subscribed ? "Subscribed" : "Subscribe"}
                </button>
              </div>

              {permission !== "granted" && supported && (
                <button
                  onClick={requestPermission}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-left text-xs text-neutral-300 hover:bg-neutral-700"
                >
                  Grant browser permission
                </button>
              )}
            </div>

            {/* Team Filters */}
            <div className="mt-4 space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
              <div className="text-sm font-semibold">Teams to notify</div>

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-neutral-700 bg-neutral-900"
                  checked={prefs.allTeams}
                  onChange={(e) => onToggleAllTeams(e.target.checked)}
                />
                Notify for all teams
              </label>

              {!prefs.allTeams && (
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {teams.map((team) => {
                    const selected = selectedSet.has(team);
                    return (
                      <label
                        key={team}
                        className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm"
                      >
                        <div className="truncate pr-3">{team}</div>
                        <button
                          type="button"
                          onClick={() => onToggleTeam(team)}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                            selected
                              ? "border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20"
                              : "border-neutral-700 bg-neutral-800 hover:bg-neutral-700"
                          }`}
                        >
                          {selected && <Check className="h-3.5 w-3.5" />}
                          {selected ? "Selected" : "Select"}
                        </button>
                      </label>
                    );
                  })}
                </div>
              )}

              {!subscribed && (
                <div className="text-xs text-neutral-400">
                  Tip: subscribe first, then your preferences will be saved.
                </div>
              )}
            </div>

            <div className="h-3" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
