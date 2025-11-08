// public/sw.js
self.addEventListener("install", (event) => {
  // Activate immediately
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  // Take control of open pages
  clients.claim();
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}
  const title = data.title || "Notification";
  const body = data.body || "";
  const url = data.url || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
      // If there's already an NCX window open, focus it
      for (const c of allClients) {
        if ("focus" in c) return c.focus();
      }
      // Otherwise open the root of the app
      return clients.openWindow("/");
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/auth")) {
    // Never cache or intercept NextAuth
    return; // allow default browser handling
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      // Focus an existing tab and navigate if needed
      if ("focus" in c) {
        await c.focus();
        try { c.navigate && c.navigate(target); } catch {}
        return;
      }
    }
    return clients.openWindow(target);
  })());
});
