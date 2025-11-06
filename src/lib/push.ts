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

export async function enableNotifications() {
  try {
    if (!("Notification" in window)) throw new Error("Notifications not supported");
    if (!("serviceWorker" in navigator)) throw new Error("Service worker not supported");
    if (!("PushManager" in window)) throw new Error("Push not supported");

    // Ask permission (should trigger the Allow prompt)
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      throw new Error(
        perm === "denied"
          ? "Notifications are blocked. Lock icon → Site settings → Notifications → Allow."
          : "Permission was not granted."
      );
    }

    // Ensure SW is installed/active
    const reg = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      location.reload(); // let the SW take control, then click again
      return false;
    }

    const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!PUBLIC) throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY in client bundle");

    // Clean rotate any old sub
    const existing = await reg.pushManager.getSubscription();
    if (existing) { try { await existing.unsubscribe(); } catch {} }

    const appServerKey = urlBase64ToUint8Array(PUBLIC);
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    });

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: sub,
        origin: location.origin,
        userAgent: navigator.userAgent,
      }),
    });

    if (!res.ok) {
      try { await sub.unsubscribe(); } catch {}
      throw new Error(`/api/push/subscribe responded ${res.status}`);
    }

    return true;
  } catch (e: any) {
    alert(`Enable notifications failed:\n${e?.name || "Error"}: ${e?.message || e}`);
    return false;
  }
}
