// Robust enable that waits for the SW to be ACTIVE *and* CONTROLLING the page
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

// Waits up to 5s for the page to be controlled by the active SW
async function ensureServiceWorkerControl(): Promise<ServiceWorkerRegistration> {
  // Wait for activation
  const reg = await navigator.serviceWorker.ready;

  // If already controlling, we're done
  if (navigator.serviceWorker.controller) return reg;

  // Otherwise wait for controllerchange (clientsClaim can be async)
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error("Service worker did not take control")); }
    }, 5000);

    const onChange = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        navigator.serviceWorker.removeEventListener("controllerchange", onChange);
        resolve();
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", onChange, { once: true });
    // micro-wait: it might already have claimed
    setTimeout(() => {
      if (!settled && navigator.serviceWorker.controller) {
        onChange();
      }
    }, 50);
  });

  return reg;
}

export async function enableNotifications(): Promise<boolean> {
  try {
    if (!("Notification" in window)) throw new Error("Notifications not supported");
    if (!("serviceWorker" in navigator)) throw new Error("Service worker not supported");
    if (!("PushManager" in window)) throw new Error("Push not supported");

    // 1) Ask permission (triggers Allow prompt)
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Permission was not granted");

    // 2) Ensure SW is active *and* controlling this page
    const reg = await ensureServiceWorkerControl();

    // 3) Get public VAPID key from server
    const PUBLIC = await fetchVapidKey();

    // 4) Clean any old sub (avoids different-key errors)
    try {
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();
    } catch {}

    // 5) Subscribe
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64urlToBytes(PUBLIC),
    });

    // 6) Save in your DB (this is the bit that writes to MySQL)
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
      // if server rejected, clean up the client sub so you don't keep a bad one around
      try { await sub.unsubscribe(); } catch {}
      throw new Error(`/api/push/subscribe responded ${save.status}`);
    }

    return true;
  } catch (err: any) {
    alert(`Enable notifications failed:\n${err?.message || String(err)}`);
    return false;
  }
}
