// src/lib/push.ts
export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = typeof window !== "undefined"
    ? window.atob(base64)
    : Buffer.from(base64, "base64").toString("binary");
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export async function enableNotifications(): Promise<boolean> {
  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("This browser doesn't support web push."); return false;
    }

    // Ask permission (shows the Allow prompt)
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { alert("Permission was not granted."); return false; }

    // Wait until the SW is active
    const reg = await navigator.serviceWorker.ready;

    // If the page is not yet controlled by the SW, wait for it (first load often needs this)
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        const onChange = () => { navigator.serviceWorker.removeEventListener("controllerchange", onChange); resolve(); };
        navigator.serviceWorker.addEventListener("controllerchange", onChange, { once: true });
        // safety: if it already claimed, resolve shortly
        setTimeout(() => { if (navigator.serviceWorker.controller) resolve(); }, 50);
      });
    }

    // Get public VAPID key from your route
    const r = await fetch("/api/push/vapidPublicKey", { cache: "no-store" });
    const { key } = await r.json();
    if (!key) { alert("No VAPID key from server."); return false; }

    // Convert to bytes
    const appServerKey = (() => {
      const p = "=".repeat((4 - (key.length % 4)) % 4);
      const b = (key + p).replace(/-/g, "+").replace(/_/g, "/");
      const raw = atob(b);
      const out = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
      return out;
    })();

    // Clean any old sub
    try { const s = await reg.pushManager.getSubscription(); if (s) await s.unsubscribe(); } catch {}

    // Subscribe (now that SW is active + controlling)
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appServerKey });

    // Save on server
    const save = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub, origin: location.origin, userAgent: navigator.userAgent })
    });
    if (!save.ok) { try { await sub.unsubscribe(); } catch {}; alert(`/api/push/subscribe ${save.status}`); return false; }

    return true;
  } catch (e: any) {
    alert(e?.message || String(e));
    return false;
  }
}
