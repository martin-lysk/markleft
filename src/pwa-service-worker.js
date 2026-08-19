const cacheName = `markleft-pwa-shell-${__MARKLEFT_PWA_BUILD__}`;
const applicationShell = ["./", "./index.html", "./pwa.js", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(cacheName).then(async (cache) => {
      await cache.addAll(applicationShell);
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("markleft-pwa-shell-") && key !== cacheName).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
});
