/**
 * Analytics layer with consent gating.
 * Supports PostHog and GA4 — only fires after user consent.
 */

type AnalyticsProvider = "posthog" | "ga4" | null;

let provider: AnalyticsProvider = null;
let consentGiven = false;
let posthogClient: { capture: (name: string, props?: Record<string, unknown>) => void } | null = null;

const CONSENT_KEY = "flixverse-analytics-consent";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

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
    void initProvider();
  }
}

async function initProvider() {
  if (typeof window === "undefined") return;

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const gaId = process.env.NEXT_PUBLIC_GA4_ID;

  if (posthogKey) {
    try {
      const posthog = (await import("posthog-js")).default;
      posthog.init(posthogKey, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: true,
        persistence: "localStorage",
      });
      posthogClient = posthog;
      provider = "posthog";
    } catch (err) {
      console.warn("[Analytics] PostHog init failed:", err);
    }
  } else if (gaId) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
    window.gtag("js", new Date());
    window.gtag("config", gaId, { anonymize_ip: true });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script);
    provider = "ga4";
  }
}

export function trackEvent(name: string, properties?: Record<string, unknown>) {
  if (!consentGiven && !getConsent()) return;

  if (process.env.NODE_ENV === "development") {
    console.log(`[Analytics] ${name}`, properties);
  }

  if (provider === "posthog" && posthogClient) {
    posthogClient.capture(name, properties);
  } else if (provider === "ga4" && window.gtag) {
    window.gtag("event", name, properties);
  }
}

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

export function trackDownload(movieId: number, mediaType: string) {
  trackEvent("download_start", { movieId, mediaType });
}
