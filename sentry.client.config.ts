import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: process.env.NODE_ENV === "production",
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    beforeSend(event) {
      // Don't send events for known non-errors
      if (event.exception?.values?.[0]?.type === "ChunkLoadError") {
        return null;
      }
      return event;
    },
  });
}
