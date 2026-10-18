const CACHE = "fortalfy-pwa-v14";
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add("./")).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("fortalfy-pwa-") && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(async () => (await caches.match(event.request)) || caches.match("./")));
    return;
  }
  event.respondWith(caches.match(event.request).then(async cached => {
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(event.request, response.clone());
    }
    return response;
  }));
});

self.addEventListener("push", event => {
  if (!event.data) return;
  let message;
  try { message = event.data.json(); }
  catch { message = { title: "Fortalfy", body: event.data.text() }; }
  const route = typeof message.route === "string" && /^\/[A-Za-z0-9/_?=&.%+-]*$/.test(message.route) ? message.route : "/home";
  const options = {
    body: String(message.body || "Você tem uma nova atualização no Fortalfy.").slice(0, 240),
    icon: new URL("assets/fortalfy-icon-192.png", self.registration.scope).href,
    badge: new URL("assets/fortalfy-icon-192.png", self.registration.scope).href,
    tag: String(message.tag || message.id || "fortalfy-notification").slice(0, 100),
    renotify: false,
    data: { id: String(message.id || ""), route },
  };
  if (Array.isArray(message.vibration) && message.vibration.length) options.vibrate = message.vibration.slice(0, 8);
  event.waitUntil(self.registration.showNotification(String(message.title || "Fortalfy").slice(0, 120), options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const { id, route } = event.notification.data || {};
  const safeRoute = typeof route === "string" && /^\/[A-Za-z0-9/_?=&.%+-]*$/.test(route) ? route : "/home";
  const appUrl = new URL(self.registration.scope);
  appUrl.hash = safeRoute;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async clients => {
    for (const client of clients) {
      if (new URL(client.url).origin !== appUrl.origin) continue;
      await client.focus();
      if ("navigate" in client) await client.navigate(appUrl.href);
      client.postMessage({ type: "FORTALFY_NOTIFICATION_OPEN", id, route: safeRoute });
      return;
    }
    await self.clients.openWindow(appUrl.href);
  }));
});
