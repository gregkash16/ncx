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
