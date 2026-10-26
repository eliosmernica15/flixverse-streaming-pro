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
    if (offline) return offline;
    // `Response.error()` is a network-error response: responding with it for
    // a navigation surfaces the browser's own error page but is at least a
    // valid Response. Prefer a real document so the user sees our UI.
    return new Response(
      "<!doctype html><meta charset=utf-8><title>Offline</title><body style=\"background:#0a0a0c;color:#fff;font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0\"><div style=\"text-align:center\"><h1 style=\"font-size:1.25rem\">You are offline</h1><p style=\"color:#9ca3af;font-size:.875rem\">FlixVerse will resume when your connection returns.</p></div></body>",
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      // Only cache complete, successful, same-origin responses. Caching a
      // partial (206) or an opaque response poisons the cache and produces
      // the "ChunkLoadError" the app then has to reload away from.
      if (response.ok && response.status === 200 && response.type === "basic") {
        void cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => {
      // Nothing cached and the network is gone: a bare 503 with no body is
      // what a chunk request wants (Next retries / the boundary reloads).
      return cached
        ? cached
        : new Response("", {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Cache-Control": "no-store" },
          });
    });

  // Serve the cached copy instantly when present; the revalidation above
  // keeps it fresh. Without a cached copy, wait for the network.
  return cached || fetchPromise;
}
