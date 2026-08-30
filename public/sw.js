const CACHE_VERSION = "flixverse-v8";
const OFFLINE_URL = "/offline";

/** Static assets only — never precache HTML (avoids stale pages blocking fonts/clicks). */
const PRECACHE = [OFFLINE_URL, "/manifest.json", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Let the page load TMDB images via img-src. SW fetch() is governed by
  // connect-src and will fail (and break posters) if CSP is stale/strict.

  if (event.request.mode === "navigate") {
    event.respondWith(networkOnlyNavigate(event.request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/favicon") ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(staleWhileRevalidate(event.request, CACHE_VERSION));
  }
});

/** Always fetch fresh HTML — no stale shell that breaks hydration/clicks. */
async function networkOnlyNavigate(request) {
  try {
    return await fetch(request, { cache: "no-store" });
  } catch {
    const cache = await caches.open(CACHE_VERSION);
    const offline = await cache.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}
