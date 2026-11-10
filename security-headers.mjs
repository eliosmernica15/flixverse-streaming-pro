import EMBED_HOSTS from "./src/lib/embedHosts.json" with { type: "json" };

const embedFrameSources = EMBED_HOSTS.flatMap((host) => [
  `https://${host}`,
  `https://*.${host}`,
]).join(" ");

/** Shared CSP + security header values (used by next.config and src/lib). */
export const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com https://www.googletagmanager.com https://www.google.com https://www.recaptcha.net https://browser.sentry-cdn.com",
  "font-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://image.tmdb.org https://images.unsplash.com https://firebasestorage.googleapis.com https://res.cloudinary.com https://lovable.dev https://lh3.googleusercontent.com https://i.ytimg.com",
  "connect-src 'self' https://image.tmdb.org https://images.unsplash.com https://firebasestorage.googleapis.com https://res.cloudinary.com https://lovable.dev https://lh3.googleusercontent.com https://api.themoviedb.org https://www.cloudflare.com https://worldtimeapi.org https://*.googleapis.com https://*.firebaseio.com https://*.cloudinary.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.google-analytics.com https://*.ingest.sentry.io https://*.sentry.io https://www.google.com https://www.recaptcha.net wss://*.firebaseio.com",
  `frame-src 'self' blob: https://accounts.google.com https://*.firebaseapp.com https://www.google.com https://www.recaptcha.net ${embedFrameSources} https://www.youtube.com https://www.youtube-nocookie.com https://*.youtube.com https://*.youtube-nocookie.com`,
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
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none",
  },
  {
    key: "Origin-Agent-Cluster",
    value: "?1",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-site",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(self), geolocation=(), interest-cohort=(), autoplay=(self), fullscreen=(self), picture-in-picture=(self), clipboard-write=(self), encrypted-media=(self), display-capture=(), payment=()",
  },
  {
    key: "Content-Security-Policy",
    value: cspDirectives.join("; "),
  },
];

export const cspValue = cspDirectives.join("; ");

/** Global headers without CSP, which is applied by middleware.ts. */
export const securityHeadersWithoutCsp = securityHeaders.filter(
  (h) => h.key !== "Content-Security-Policy"
);
