const CACHE_NAME = "zpos-offline-v2";
const APP_SHELL = [
  "/",
  "/onboarding",
  "/auth/login",
  "/src/assests/site.webmanifest",
  "/src/assests/favicon-96x96.png",
  "/web-app-manifest-192x192.png",
  "/web-app-manifest-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/@") || url.pathname.startsWith("/node_modules/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/").then((shell) => shell)),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) =>
      fetch(request)
        .then((response) => {
          if (response.ok && shouldCache(url)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached),
    ),
  );
});

function shouldCache(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/src/assests/") ||
    url.pathname.includes(".")
  );
}
