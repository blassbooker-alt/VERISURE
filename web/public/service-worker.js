const CACHE = "fortalfy-pwa-v22";
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const response = await fetch("./precache-manifest.json", { cache: "reload" });
    if (!response.ok) throw new Error("Não foi possível carregar os arquivos de inicialização do Fortalfy.");
    const files = Array.from(new Set(["./", ...(await response.json())]));
    const previousCaches = await Promise.all((await caches.keys())
      .filter(name => name.startsWith("fortalfy-pwa-") && name !== CACHE)
      .map(name => caches.open(name)));
    const cache = await caches.open(CACHE);
    await Promise.all(files.map(async file => {
      const request = new Request(new URL(file, self.registration.scope).href);
      let cachedResponse;
      const isAppShell = ["./", "./index.html", "./manifest.webmanifest"].includes(file);
      if (!isAppShell) {
        for (const previousCache of previousCaches) {
          cachedResponse = await previousCache.match(request);
          if (cachedResponse) break;
        }
      }
      if (cachedResponse) {
        await cache.put(request, cachedResponse.clone());
        return;
      }
      const freshResponse = await fetch(new Request(request, { cache: "reload" }));
      if (!freshResponse.ok) throw new Error(`Unable to prepare ${file} for offline use.`);
      await cache.put(request, freshResponse);
    }));
    await self.skipWaiting();
  })());
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
  const notificationType = String(message.type || "");
  const id = String(message.id || "");
  const soundEnabled = message.soundEnabled !== false;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async clients => {
    const focusedClient = clients.find(client => client.focused && client.visibilityState === "visible");
    if (focusedClient) {
      const currentUrl = new URL(focusedClient.url);
      const currentRoute = currentUrl.hash.replace(/^#/, "") || "/";
      const targetConversation = new URLSearchParams(route.split("?")[1] || "").get("conversation");
      const currentConversation = new URLSearchParams(currentRoute.split("?")[1] || "").get("conversation");
      if (notificationType === "chat.message" && currentRoute.split("?")[0] === "/messages" && targetConversation && targetConversation === currentConversation) return;
      focusedClient.postMessage({ type: "FORTALFY_PUSH_NOTIFICATION", id, notificationType, route, soundEnabled });
      return;
    }
  const options = {
    body: String(message.body || "Você tem uma nova atualização no Fortalfy.").slice(0, 240),
    icon: new URL("assets/fortalfy-icon-192.png", self.registration.scope).href,
    badge: new URL("assets/fortalfy-notification-badge.svg", self.registration.scope).href,
    tag: String(message.tag || message.id || "fortalfy-notification").slice(0, 100),
    // Notifications share tags to keep the tray tidy. Ask the OS to alert
    // again when a new event replaces an existing grouped notification.
    renotify: true,
    silent: !soundEnabled,
    data: { id, route },
  };
  if (Array.isArray(message.vibration) && message.vibration.length) options.vibrate = message.vibration.slice(0, 8);
    await self.registration.showNotification(String(message.title || "Fortalfy").slice(0, 120), options);
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const { id, route } = event.notification.data || {};
  const safeRoute = typeof route === "string" && /^\/[A-Za-z0-9/_?=&.%+-]*$/.test(route) ? route : "/home";
  const appUrl = new URL(self.registration.scope);
  const destination = new URLSearchParams(safeRoute.split("?")[1] || "");
  if (id && /^[a-zA-Z0-9-]{1,80}$/.test(id)) destination.set("notificationId", id);
  const destinationQuery = destination.toString();
  appUrl.hash = `${safeRoute.split("?")[0]}${destinationQuery ? `?${destinationQuery}` : ""}`;
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

self.addEventListener("message", event => {
  if (event.data?.type !== "FORTALFY_NOTIFICATION_READ") return;
  const id = String(event.data.id || "");
  event.waitUntil(self.registration.getNotifications().then(notifications => {
    for (const notification of notifications) {
      if (id ? notification.data?.id === id : true) notification.close();
    }
  }));
});
