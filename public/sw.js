/* Service Worker for Attendance App PWA */
const CACHE_NAME = "attendance-app-v3";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/* Install: precache app shell */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

/* Activate: clean old caches */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* Fetch: network-first with cache fallback */
self.addEventListener("fetch", (event) => {
  // Skip non-GET and chrome-extension requests
  if (event.request.method !== "GET") return;
  if (event.request.url.startsWith("chrome-extension")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache successful responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // For navigation requests, return the index
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
          return new Response("Offline", { status: 503 });
        });
      })
  );
});
