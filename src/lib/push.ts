// Minimal helpers
function b64urlToBytes(s: string) {
  const p = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + p).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function fetchVapidKey(): Promise<string> {
  const r = await fetch("/api/push/vapidPublicKey", { cache: "no-store" });
  if (!r.ok) throw new Error(`vapidPublicKey responded ${r.status}`);
  const j = await r.json();
  const key = j.key || j.publicKey;
  if (!key) throw new Error("vapidPublicKey missing 'key'");
  return key;
}

// One-time reload handoff key
const HANDOFF_KEY = "ncx_sw_handoff";

export async function enableNotifications(): Promise<boolean> {
  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("This browser doesn't support web push."); 
      return false;
    }

    // If coming back from the one-time reload, skip straight to subscribe
    const comingFromReload = localStorage.getItem(HANDOFF_KEY) === "1";

    // Ask permission (shows Allow prompt)
    if (!comingFromReload) {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { alert("Permission was not granted."); return false; }
    }

    // Ensure the SW is registered (safe even if already done)
    await navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});

    // Wait until SW is active
    const reg = await navigator.serviceWorker.ready;

    // If the page is not yet controlled by the SW, do a one-time reload handoff
    if (!navigator.serviceWorker.controller && !comingFromReload) {
      localStorage.setItem(HANDOFF_KEY, "1");
      // after reload SW will control the page
      location.reload();
      return false;
    }

    // Clear the handoff flag if present
    if (comingFromReload) localStorage.removeItem(HANDOFF_KEY);

    // Get the public key from server
    const PUBLIC = await fetchVapidKey();

    // Clean any old sub
    try {
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();
    } catch {}

    // Subscribe
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64urlToBytes(PUBLIC),
    });

    // Save in DB (this is where your MySQL write happens)
    const save = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: sub,
        origin: location.origin,
        userAgent: navigator.userAgent,
      }),
    });

    if (!save.ok) {
      try { await sub.unsubscribe(); } catch {}
      const msg = `/api/push/subscribe responded ${save.status}`;
      alert(msg);
      return false;
    }

    return true;
  } catch (e: any) {
    alert(e?.message || String(e));
    return false;
  }
}
