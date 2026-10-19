const CACHE_NAME = "fortalfy-app-v6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./food-social.css",
  "./food-social.js",
  "./assets/fortalfy-app-icon.svg",
  "./assets/fortalfy_mensagem.mp3",
  "./assets/fortalfy_notificacao.mp3",
  "./assets/fortalfy_pagamento.mp3",
  "./assets/fortalfy-alimentacao.svg",
  "./assets/fortalfy-aprender.svg",
  "./assets/fortalfy-cuidado-profissional.svg",
  "./assets/fortalfy-movimento-academia.svg",
  "./assets/fortalfy-movimento.svg",
  "./assets/fortalfy-wallpaper.jpg",
  "./assets/food-bowl.jpg",
  "./assets/food-burger.jpg",
  "./assets/food-grilled-chicken.jpg",
  "./assets/food-juice.jpg",
  "./assets/food-salad.jpg",
  "./assets/pass-demo-gym-ironfit.jpg",
  "./assets/pass-demo-gym-nextfit.jpg",
  "./assets/pass-functional-space.svg",
  "./assets/pass-hero-gym.jpg",
  "./assets/pass-map-discovery.svg",
  "./assets/pass-mobility-space.svg",
  "./assets/pass-strength-space.svg",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith("fortalfy-app-") && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data?.json() || {}; } catch { payload = { body: event.data?.text() || "Você tem uma nova atualização." }; }
    const title = String(payload.title || "Fortalfy").slice(0, 120);
    const body = String(payload.body || "Você tem uma nova atualização.").slice(0, 240);
    const route = typeof payload.route === "string" && payload.route.startsWith("/") ? payload.route : "/notifications";
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      client.postMessage({
        type: "FORTALFY_PUSH_NOTIFICATION",
        id: payload.id,
        route,
        notificationType: payload.type,
        soundEnabled: payload.soundEnabled !== false,
      });
    }
    const targetConversation = new URLSearchParams(route.split("?")[1] || "").get("conversation");
    const alreadyInConversation = payload.type === "chat.message" && targetConversation && windows.some(client => {
      if (!client.focused) return false;
      const hashRoute = new URL(client.url).hash.replace(/^#\/?/, "");
      const [pathname, query = ""] = hashRoute.split("?");
      return pathname === "messages" && new URLSearchParams(query).get("conversation") === targetConversation;
    });
    if (alreadyInConversation) return;
    await self.registration.showNotification(title, {
      body,
      icon: "./assets/fortalfy-app-icon.svg",
      badge: "./assets/fortalfy-app-icon.svg",
      tag: payload.tag || String(payload.id || "fortalfy-notification").slice(0, 80),
      renotify: true,
      data: { id: payload.id, route, type: payload.type },
      ...(Array.isArray(payload.vibration) ? { vibrate: payload.vibration } : {}),
    });
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const route = event.notification.data?.route || "/notifications";
  const target = new URL(`./#${route}`, self.location.href).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async clients => {
    const existing = clients.find(client => client.url.startsWith(self.location.origin));
    if (existing) {
      existing.postMessage({ type: "FORTALFY_NOTIFICATION_OPEN", id: event.notification.data?.id, route });
      await existing.focus();
      return;
    }
    await self.clients.openWindow(target);
  }));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(async response => {
        if (response.ok) {
          await caches.open(CACHE_NAME).then(cache => cache.put("./index.html", response.clone()));
        }
        return response;
      }).catch(async error => {
        const cachedPage = await caches.match(request, { ignoreSearch: true })
          || await caches.match("./index.html");
        if (cachedPage) return cachedPage;
        throw error;
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(async cached => {
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        await caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      }
      return response;
    })
  );
});
