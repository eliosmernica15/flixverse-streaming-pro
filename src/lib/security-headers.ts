/** Security headers applied via Next.js config and proxy. */
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
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://image.tmdb.org https://images.unsplash.com https://firebasestorage.googleapis.com https://res.cloudinary.com https://lovable.dev",
      "font-src 'self' data:",
      "connect-src 'self' https://api.themoviedb.org https://*.googleapis.com https://*.firebaseio.com https://*.cloudinary.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com wss://*.firebaseio.com",
      // Player iframes load via /api/embed (same-origin 'self'); external hosts kept as fallback.
      "frame-src 'self' blob: https://vidsrc.cc https://vidsrc.xyz https://vidsrc.icu https://vidlink.pro https://embed.su https://multiembed.mov https://player.autoembed.cc https://player.smashy.stream https://www.youtube.com https://www.youtube-nocookie.com",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];
