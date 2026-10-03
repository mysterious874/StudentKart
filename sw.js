/* GlobeDisc Web Push Service Worker */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {
    data = { body: event.data ? event.data.text() : "You have a new GlobeDisc message." };
  }

  const title = data.title || "GlobeDisc • New message";
  const options = {
    body: data.body || "You have received a new message.",
    icon: data.icon || "/icons/globedisc-icon-v2.svg",
    badge: data.badge || "/icons/globedisc-icon-v2.svg",
    tag: data.tag || "globedisc-chat",
    renotify: true,
    data: {
      url: data.url || "/#chat"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/#chat";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ("focus" in client) {
          try {
            client.navigate(targetUrl);
          } catch (_) {}
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
