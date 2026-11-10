const CACHE_VERSION = "flixverse-v11";
const OFFLINE_URL = "/offline";
const IMAGES_CACHE = "flixverse-images-v1";
const MAX_CACHED_IMAGES = 200;

const NAV_TIMEOUT_MS = 4500; // per attempt
const NAV_RETRY_DELAY_MS = 800;
const STATIC_TIMEOUT_MS = 5000;
const STATIC_RETRY_DELAY_MS = 400;

/** Static shell + offline-library page so the "Offline library" link works without a network. */
const PRECACHE = [OFFLINE_URL, "/offline-library", "/manifest.json", "/favicon.svg", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION && key !== IMAGES_CACHE)
          .map((key) => caches.delete(key))
      )
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

/** One network attempt, then a short pause and one retry. Null on total failure (or upstream 5xx when failOn5xx is set). */
async function fetchWithRetry(request, timeoutMs, retryDelayMs, { failOn5xx = false } = {}) {
  const attempt = async () => {
    const response = await fetchWithTimeout(request, timeoutMs);
    if (failOn5xx && response.status >= 500) {
      throw new Error(`upstream ${response.status}`);
    }
    return response;
  };
  try {
    return await attempt();
  } catch {
    await delay(retryDelayMs);
    try {
      return await attempt();
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
    return;
  }

  // Cross-origin catalog art (TMDB posters, ytimg thumbnails, Google avatars,
  // Cloudinary uploads): cache aggressively so the offline library and slow
  // networks still render posters instead of broken frames. Bounded via LRU.
  if (isCacheableImageHost(url)) {
    event.respondWith(staleWhileRevalidateImages(event.request));
  }
});

const IMAGE_HOSTS = new Set([
  "image.tmdb.org",
  "i.ytimg.com",
  "lh3.googleusercontent.com",
  "res.cloudinary.com",
  "cus.cloudinary.com",
]);

function isCacheableImageHost(url) {
  return IMAGE_HOSTS.has(url.hostname.toLowerCase());
}

/** Keep the image cache bounded: delete oldest entries when we're over the cap. */
async function trimImageCache(cache, max = MAX_CACHED_IMAGES) {
  const keys = await cache.keys();
  if (keys.length <= max) return;
  const excess = keys.length - max;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

/** stale-while-revalidate for cross-origin images; opaque responses are cacheable. */
async function staleWhileRevalidateImages(request) {
  const cache = await caches.open(IMAGES_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer" })
    .then(async (response) => {
      // Opaque (type === "opaque") responses can't be inspected; put() them anyway.
      // Basic CORS responses with status 200 are ideal. Anything else: skip caching.
      const cacheable =
        (response && response.type === "opaque") ||
        (response && response.ok && response.status === 200);
      if (cacheable) {
        void cache.put(request, response.clone());
        void trimImageCache(cache);
      }
      return response;
    })
    .catch(() => cached || Response.error());

  return cached || fetchPromise;
}

/**
 * Always fetch fresh HTML - no stale shell that breaks hydration/clicks.
 * But give the network *two* chances (with a timeout) before falling back to
 * the offline page: a single dropped packet should never flash the offline UI.
 */
async function networkOnlyNavigate(request) {
  // An upstream 5xx is as useless to the user as a dropped connection — retry,
  // then show the branded auto-recovering offline page instead of a raw error.
  const response = await fetchWithRetry(request, NAV_TIMEOUT_MS, NAV_RETRY_DELAY_MS, {
    failOn5xx: true,
  });
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
