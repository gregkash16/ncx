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
// public/sw.js
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const raw = (event.notification.data && event.notification.data.url) || "/";
  const target = new URL(raw, self.location.origin).href; // ✅ always absolute

  console.log("[SW click] opening:", target);

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });

    for (const c of allClients) {
      if (c.url === target && "focus" in c) {
        return c.focus();
      }
    }

    return clients.openWindow(target);
  })());
});


self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/auth")) {
    return; // let NextAuth requests go through untouched
  }
});
