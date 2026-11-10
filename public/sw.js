const CACHE_VERSION = "flixverse-v9";
const OFFLINE_URL = "/offline";

const NAV_TIMEOUT_MS = 4500; // per attempt
const NAV_RETRY_DELAY_MS = 800;
const STATIC_TIMEOUT_MS = 5000;
const STATIC_RETRY_DELAY_MS = 400;

/** Static assets only - never precache HTML (avoids stale pages blocking fonts/clicks). */
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { cache: "no-store", signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

/** One network attempt, then a short pause and one retry. Null on total failure. */
async function fetchWithRetry(request, timeoutMs, retryDelayMs) {
  try {
    return await fetchWithTimeout(request, timeoutMs);
  } catch {
    await delay(retryDelayMs);
    try {
      return await fetchWithTimeout(request, timeoutMs);
    } catch {
      return null;
    }
  }
}

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

/**
 * Always fetch fresh HTML - no stale shell that breaks hydration/clicks.
 * But give the network *two* chances (with a timeout) before falling back to
 * the offline page: a single dropped packet should never flash the offline UI.
 */
async function networkOnlyNavigate(request) {
  const response = await fetchWithRetry(request, NAV_TIMEOUT_MS, NAV_RETRY_DELAY_MS);
  if (response) return response;

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

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetchWithRetry(request, STATIC_TIMEOUT_MS, STATIC_RETRY_DELAY_MS)
    .then((response) => {
      // Only cache complete, successful, same-origin responses. Caching a
      // partial (206) or an opaque response poisons the cache and produces
      // the "ChunkLoadError" the app then has to reload away from.
      if (response && response.ok && response.status === 200 && response.type === "basic") {
        void cache.put(request, response.clone());
      }
      // Nothing cached and the network is gone: a bare 503 with no body is
      // what a chunk request wants (Next retries / the boundary reloads).
      return (
        response ||
        cached ||
        new Response("", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Cache-Control": "no-store" },
        })
      );
    })
    .catch(() => {
      return (
        cached ||
        new Response("", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Cache-Control": "no-store" },
        })
      );
    });

  // Serve the cached copy instantly when present; the revalidation above
  // keeps it fresh. Without a cached copy, wait for the network.
  return cached || fetchPromise;
}
