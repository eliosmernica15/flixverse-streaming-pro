/**
 * DEAD CODE — unreferenced. The live headers are:
 *   - `security-headers.mjs` (non-CSP headers for next.config `headers()`)
 *   - `middleware.ts` (Content-Security-Policy, so `/api/embed` can be
 *     excluded — next.config headers cannot exclude a path).
 * Kept for reference only; edit those files instead, or delete this one.
 * Last synced with security-headers.mjs CSP frame-src covering:
 * vidsrcme.ru, vidsrc.to, vidlink.pro, player.videasy.to, videasy.to,
 * vidfast.pro + mirrors (.vc/.in/.io/.me/.net/.pm/.xyz/.bz),
 * yapgrid.com (+ www), youtube.
 */
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
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://www.googletagmanager.com https://www.google.com https://www.recaptcha.net https://browser.sentry-cdn.com",
      "font-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://image.tmdb.org https://images.unsplash.com https://firebasestorage.googleapis.com https://res.cloudinary.com https://lovable.dev https://lh3.googleusercontent.com",
      "connect-src 'self' https://image.tmdb.org https://images.unsplash.com https://firebasestorage.googleapis.com https://res.cloudinary.com https://lovable.dev https://lh3.googleusercontent.com https://api.themoviedb.org https://www.cloudflare.com https://worldtimeapi.org https://*.googleapis.com https://*.firebaseio.com https://*.cloudinary.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.google-analytics.com https://*.ingest.sentry.io https://*.sentry.io https://www.google.com https://www.recaptcha.net wss://*.firebaseio.com",
      "frame-src 'self' blob: https://accounts.google.com https://*.firebaseapp.com https://www.google.com https://www.recaptcha.net https://vidsrcme.ru https://*.vidsrcme.ru https://vidsrc.to https://*.vidsrc.to https://vidlink.pro https://*.vidlink.pro https://player.videasy.to https://*.player.videasy.to https://videasy.to https://*.videasy.to https://vidfast.pro https://*.vidfast.pro https://vidfast.vc https://*.vidfast.vc https://vidfast.in https://*.vidfast.in https://vidfast.io https://*.vidfast.io https://vidfast.me https://*.vidfast.me https://vidfast.net https://*.vidfast.net https://vidfast.pm https://*.vidfast.pm https://vidfast.xyz https://*.vidfast.xyz https://vidfast.bz https://*.vidfast.bz https://yapgrid.com https://*.yapgrid.com https://www.yapgrid.com https://www.youtube.com https://www.youtube-nocookie.com https://*.youtube.com https://*.youtube-nocookie.com",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];
