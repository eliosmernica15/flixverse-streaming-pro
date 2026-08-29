/** Security headers — keep in sync with security-headers.mjs (used by next.config). */
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
      "connect-src 'self' https://image.tmdb.org https://images.unsplash.com https://firebasestorage.googleapis.com https://res.cloudinary.com https://lovable.dev https://lh3.googleusercontent.com https://api.themoviedb.org https://worldtimeapi.org https://*.googleapis.com https://*.firebaseio.com https://*.cloudinary.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.google-analytics.com https://*.ingest.sentry.io https://*.sentry.io https://www.google.com https://www.recaptcha.net wss://*.firebaseio.com https://*.ably.io wss://*.ably.io https://*.ably-realtime.com wss://*.ably-realtime.com",
      "frame-src 'self' blob: https://accounts.google.com https://*.firebaseapp.com https://www.google.com https://www.recaptcha.net https://vidlink.pro https://player.videasy.net https://vidfast.pro https://vidsrc.me https://vidsrc.net https://www.2embed.cc https://2embed.cc https://multiembed.mov https://embed.su https://yapgrid.com https://www.yapgrid.com https://www.youtube.com https://www.youtube-nocookie.com",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];
