/**
 * Analytics layer with consent gating.
 * Supports PostHog and GA4 — only fires after user consent.
 */

type AnalyticsProvider = "posthog" | "ga4" | null;

let provider: AnalyticsProvider = null;
let consentGiven = false;

const CONSENT_KEY = "flixverse-analytics-consent";

export function getConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(CONSENT_KEY) === "true";
  } catch {
    return false;
  }
}

export function setConsent(granted: boolean) {
  consentGiven = granted;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CONSENT_KEY, String(granted));
    } catch {
      // ignore
    }
  }

  if (granted && !provider) {
    initProvider();
  }
}

function initProvider() {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const gaId = process.env.NEXT_PUBLIC_GA4_ID;

  if (posthogKey) {
    provider = "posthog";
    // PostHog init would go here
    console.log("[Analytics] PostHog initialized");
  } else if (gaId) {
    provider = "ga4";
    // GA4 init would go here
    console.log("[Analytics] GA4 initialized");
  }
}

export function trackEvent(name: string, properties?: Record<string, unknown>) {
  if (!consentGiven && !getConsent()) return;

  // Development logging
  if (process.env.NODE_ENV === "development") {
    console.log(`[Analytics] ${name}`, properties);
    return;
  }

  // Production analytics calls would go here
  // PostHog: posthog.capture(name, properties)
  // GA4: gtag('event', name, properties)
}

// Convenience wrappers for common events
export function trackPlaybackStart(movieId: number, mediaType: string, serverId: string) {
  trackEvent("playback_start", { movieId, mediaType, serverId });
}

export function trackListAdd(movieId: number, mediaType: string) {
  trackEvent("list_add", { movieId, mediaType });
}

export function trackListRemove(movieId: number) {
  trackEvent("list_remove", { movieId });
}

export function trackPartyJoin(roomId: string) {
  trackEvent("party_join", { roomId });
}

export function trackSearch(query: string, resultCount: number) {
  trackEvent("search", { query, resultCount });
}

export function trackSignup(method: string) {
  trackEvent("signup", { method });
}
