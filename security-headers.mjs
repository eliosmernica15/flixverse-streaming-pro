/** Shared CSP + security header values (used by next.config and src/lib). */
export const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://www.googletagmanager.com https://www.google.com https://www.recaptcha.net https://browser.sentry-cdn.com",
  "font-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://image.tmdb.org https://images.unsplash.com https://firebasestorage.googleapis.com https://res.cloudinary.com https://lovable.dev https://lh3.googleusercontent.com",
  "connect-src 'self' https://image.tmdb.org https://images.unsplash.com https://firebasestorage.googleapis.com https://res.cloudinary.com https://lovable.dev https://lh3.googleusercontent.com https://api.themoviedb.org https://www.cloudflare.com https://worldtimeapi.org https://*.googleapis.com https://*.firebaseio.com https://*.cloudinary.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.google-analytics.com https://*.ingest.sentry.io https://*.sentry.io https://www.google.com https://www.recaptcha.net wss://*.firebaseio.com https://*.ably.io wss://*.ably.io https://*.ably-realtime.com wss://*.ably-realtime.com",
  // frame-src must list every host the player iframes. Keep in sync with
  // src/lib/streamingSources.ts -> ALLOWED_EMBED_HOSTS. The canonical VidSrc
  // domain is vidsrcme.ru (vidsrc.to is the per-domain mirror). The
  // canonical Videasy domain is player.videasy.to. The legacy mirrors
  // (vidsrc.me/.net/.pm/.in/.su, player.videasy.net, embed.su, 2embed.cc,
  // multiembed.mov) are all blocked or 404 and have been removed.
  "frame-src 'self' blob: https://accounts.google.com https://*.firebaseapp.com https://www.google.com https://www.recaptcha.net https://vidsrcme.ru https://*.vidsrcme.ru https://vidsrc.to https://*.vidsrc.to https://vidlink.pro https://*.vidlink.pro https://player.videasy.to https://*.player.videasy.to https://videasy.to https://*.videasy.to https://vidfast.pro https://*.vidfast.pro https://yapgrid.com https://*.yapgrid.com https://www.yapgrid.com https://www.youtube.com https://www.youtube-nocookie.com https://*.youtube.com https://*.youtube-nocookie.com",
  "upgrade-insecure-requests",
];

export const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: cspDirectives.join("; "),
  },
];
