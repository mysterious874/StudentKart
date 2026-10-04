/* GlobeDisc Web Push Service Worker */
const CACHE_NAME = "globedisc-shell-v2";

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(["/", "/index.html", "/manifest.json"])
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  event.waitUntil(self.clients.claim());
});

/*
 * Keep normal online behaviour first.
 * If the network is unavailable, use the cached app shell.
 */
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && event.request.destination !== "video") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(cached => cached || caches.match("/"))
      )
  );
});

self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = {
      body: event.data
        ? event.data.text()
        : "You have a new GlobeDisc message."
    };
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
    self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(clients => {
      for (const client of clients) {
        if ("focus" in client) {
          try {
            client.navigate(targetUrl);
          } catch (_) {}
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
