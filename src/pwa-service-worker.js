const cacheName = `markleft-pwa-shell-${__MARKLEFT_PWA_BUILD__}`;
const applicationShell = [
  "./",
  "./index.html",
  `./pwa.js?v=${__MARKLEFT_PWA_BUILD__}`,
  "./manifest.webmanifest",
  "./icon.svg",
];

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
  const requestUrl = new URL(event.request.url);
  const isApplicationShellRequest =
    event.request.mode === "navigate" ||
    (requestUrl.origin === self.location.origin &&
      ["/", "/index.html", "/pwa.js", "/manifest.webmanifest", "/icon.svg"].some(
        (path) => requestUrl.pathname.endsWith(path),
      ));
  if (isApplicationShellRequest) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            void caches.open(cacheName).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
});
