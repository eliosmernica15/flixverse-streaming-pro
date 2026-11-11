// FlixVerse service worker.
// Design contract:
//  - Navigations ALWAYS hit the network first; only on total failure do we
//    serve a *self-contained* branded offline page (inline CSS/JS, no external
//    chunks, so it can never render half-styled).
//  - No HTML is precached — stale HTML + fresh build = broken chunk hashes.
//  - Only long-lived, content-addressed assets (immutable chunks/icons) are
//    cached for offline reuse, with LRU bounds for IMAGES.
//  - Everything else goes to the network; failures surface real errors, not
//    synthetic 503s masquerading as the app.
const CACHE_VERSION = "flixverse-v12";
const IMAGES_CACHE = "flixverse-images-v2";
const MAX_CACHED_IMAGES = 200;

const NAV_TIMEOUT_MS = 4500;
const NAV_RETRY_DELAY_MS = 800;
const STATIC_TIMEOUT_MS = 5000;
const STATIC_RETRY_DELAY_MS = 400;

const PRECACHE = ["/favicon.svg", "/manifest.json", "/icons/icon-192.png"];

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
        keys.map((key) => (key === CACHE_VERSION || key === IMAGES_CACHE ? undefined : caches.delete(key)))
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

  // Page navigations: network first, then a self-contained branded offline
  // page on total failure. NEVER serve stale HTML.
  if (event.request.mode === "navigate") {
    event.respondWith(networkOnlyNavigate(event.request));
    return;
  }

  // Content-addressed framework assets (JS/CSS chunks): serve fresh from the
  // network; fall back to cache only when the network is gone. These are
  // immutable content hashes, so stale-while-revalidate is safe here.
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  if (url.origin === self.location.origin && /\.(svg|png|ico|webp|woff2?)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Cross-origin catalog art: cache aggressively with LRU bounds so slow
  // networks and offline Library still render posters.
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

  const fetchPromise = fetch(request, {
    mode: "cors",
    credentials: "omit",
    referrerPolicy: "no-referrer",
  })
    .then(async (response) => {
      const cacheable =
        (response && response.type === "opaque") ||
        (response && response.ok && response.status === 200);
      if (cacheable) {
        void cache.put(request, response.clone());
        void trimImageCache(cache);
      }
      return response;
    })
    .catch(() => cached || new Response("", { status: 504 }));

  return cached || fetchPromise;
}

function brandedOfflinePage() {
  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#000000">
<title>Offline — FlixVerse</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  html,body{height:100%}
  body{margin:0;background:radial-gradient(120% 90% at 50% 0%,#16060f 0%,#000 60%);color:#f3f4f6;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:grid;place-items:center;text-align:center;padding:24px}
  .brand{letter-spacing:.28em;font-size:11px;font-weight:800;color:#ef4444;text-transform:uppercase;margin-bottom:18px}
  .mark{width:84px;height:84px;border-radius:26px;background:linear-gradient(135deg,#ef4444,#f97316);display:flex;align-items:center;justify-content:center;box-shadow:0 24px 60px -18px rgba(239,68,68,.45);margin:0 auto 26px}
  .mark svg{width:38px;height:38px;stroke:#fff;stroke-width:2.4;fill:none;stroke-linecap:round;stroke-linejoin:round}
  h1{margin:0 0 12px;font-size:clamp(1.9rem,6vw,2.5rem);font-weight:900;letter-spacing:-.02em}
  h1 span{background:linear-gradient(90deg,#fca5a5,#fdba74,#fca5a5);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  p{margin:0 auto 28px;max-width:26rem;color:#9ca3af;font-size:.85rem;line-height:1.6}
  .row{display:flex;flex-direction:column;gap:12px;align-items:center}
  .btn{display:inline-flex;align-items:center;gap:10px;padding:14px 26px;border-radius:14px;font-size:.8rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;text-decoration:none;border:0;cursor:pointer;transition:transform .15s ease,filter .15s ease;font-family:inherit}
  .btn:active{transform:scale(.97)}
  .primary{color:#fff;background:linear-gradient(135deg,#ef4444,#dc2626);box-shadow:0 14px 38px -12px rgba(239,68,68,.55)}
  .primary:hover{filter:brightness(1.08)}
  .ghost{color:#d1d5db;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
  .ghost:hover{color:#fff;border-color:rgba(255,255,255,.16)}
  .meta{margin-top:34px;font-size:10px;color:#6b7280;letter-spacing:.18em;text-transform:uppercase}
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand">FLIXVERSE</div>
    <div class="mark" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M3 9.5v5a2 2 0 0 1 2-2h4l5-4v10l-5-4H5a2 2 0 0 1-2-2z"/><path d="M18 8a4 4 0 0 1 0 8"/></svg>
    </div>
    <h1>You're <span>offline</span></h1>
    <p>Streaming needs an internet connection. We'll put you back together as soon as the network is back.</p>
    <div class="row">
      <button class="btn primary" onclick="location.reload()">Try again</button>
      <a class="btn ghost" href="/offline-library">Open offline library</a>
    </div>
    <div class="meta">FlixVerse · offline mode</div>
  </div>
  <script>
    addEventListener('online', function () { location.reload(); });
    // Also poll, because 'online' can fire reliably only on real state changes.
    setInterval(function () { fetch('/', { method: 'HEAD', cache: 'no-store' }).then(function (r) { if (r.ok) location.reload(); }).catch(function () {}); }, 5000);
  </script>
</body>
</html>`;
  return new Response(doc, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function networkOnlyNavigate(request) {
  const response = await fetchWithRetry(request, NAV_TIMEOUT_MS, NAV_RETRY_DELAY_MS, {
    failOn5xx: true,
  });
  if (response) return response;
  return brandedOfflinePage();
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  const fetchPromise = fetchWithRetry(request, STATIC_TIMEOUT_MS, STATIC_RETRY_DELAY_MS)
    .then((response) => {
      // Only cache complete, successful, same-origin basic responses.
      if (response && response.ok && response.status === 200 && response.type === "basic") {
        void cache.put(request, response.clone());
      }
      return response || cached || new Response("", { status: 503, headers: { "Cache-Control": "no-store" } });
    })
    .catch(() => cached || new Response("", { status: 503, headers: { "Cache-Control": "no-store" } }));

  return cached || fetchPromise;
}
