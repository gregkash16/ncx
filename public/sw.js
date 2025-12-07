// public/sw.js
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
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
      data: { url }, // this is used on click
    })
  );
});

// 🔧 single, URL-aware click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });

    // If a client is already at that URL, just focus it
    for (const c of allClients) {
      if (c.url && c.url.endsWith(target) && "focus" in c) {
        return c.focus();
      }
    }

    // Otherwise, open a new window/tab to the target
    return clients.openWindow(target);
  })());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/auth")) {
    return; // let NextAuth requests go through untouched
  }
});
