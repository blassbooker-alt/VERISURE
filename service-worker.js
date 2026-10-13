const CACHE_NAME = "fortalfy-app-v5";
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
