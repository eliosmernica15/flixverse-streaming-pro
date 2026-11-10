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
    posthog?: { capture: (name: string, props?: Record<string, unknown>) => void; register_once?: (props: Record<string, unknown>) => void };
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

/**
 * Core event tracking functions for specific event types
 */

// Playback events
export function trackPlaybackStart(movieId: number, mediaType: string, serverId: string) {
  trackEvent("playback_start", { movieId, mediaType, serverId });
}

export function trackProviderFailover(
  movieId: number,
  fromServer: string,
  toServer: string,
  reason: string,
  attemptNumber: number
) {
  trackEvent("provider_failover", { movieId, fromServer, toServer, reason, attemptNumber });
}

// Party events
export function trackPartyJoin(roomId: string) {
  trackEvent("party_join", { roomId });
}

export function trackDriftSnap(roomId: string, driftMs: number, correctionType: "soft" | "hard" | "manual") {
  trackEvent("drift_snap", { roomId, driftMs, correctionType });
}

export function trackPartyReconnect(roomId: string, wasDisconnectedMs: number, transport: "webrtc" | "firestore" | "both") {
  trackEvent("party_reconnect", { roomId, wasDisconnectedMs, transport });
}

// Checkout events
export function trackCheckoutStarted(props: {
  planId: string;
  interval: "monthly" | "yearly";
  amount: number;
  currency: string;
}) {
  trackEvent("checkout_started", props);
}

// Install prompt events
export function trackInstallPrompt(props: {
  outcome: "accepted" | "dismissed" | "hidden";
  platform?: string;
}) {
  trackEvent("install_prompt", props);
}

// List events
export function trackListAdd(movieId: number, mediaType: string) {
  trackEvent("list_add", { movieId, mediaType });
}

export function trackListRemove(movieId: number) {
  trackEvent("list_remove", { movieId });
}

// Guest join events
export function trackGuestJoinStarted(props: {
  roomId?: string;
  source: string;
  movieTitle?: string;
}) {
  trackEvent("guest_join_started", props);
}

export function trackGuestJoinNavigated(props: {
  roomId?: string;
  target: string;
  hasMeta: boolean;
}) {
  trackEvent("guest_join_navigated", props);
}

export function trackGuestJoinSynced(props: {
  roomId?: string;
  driftMs: number;
  elapsedMs: number;
}) {
  trackEvent("guest_join_synced", props);
}

export function trackGuestJoinFailed(props: { roomId?: string; reason: string }) {
  trackEvent("guest_join_failed", props);
}

// Search events
export function trackSearch(query: string, resultCount: number) {
  trackEvent("search", { query, resultCount });
}

// Auth events
export function trackSignup(method: string) {
  trackEvent("signup", { method });
}

// Download events
export function trackDownload(movieId: number, mediaType: string) {
  trackEvent("download_start", { movieId, mediaType });
}

/**
 * PostHog Funnel: Browse → Detail → Play → Party
 *
 * This funnel tracks the core user journey from browsing to party creation.
 * Step 1: browse - User views movie list/grid
 * Step 2: detail - User opens movie detail page
 * Step 3: play - User starts playback
 * Step 4: party - User creates or joins a watch party
 */
export function trackBrowseStep(props: { page: string; filters?: string[] }) {
  trackEvent("funnel_browse", { step: "browse", ...props });
}

export function trackDetailStep(props: { movieId: number; mediaType: string; source?: string }) {
  trackEvent("funnel_detail", { step: "detail", ...props });
}

export function trackPlayStep(props: { movieId: number; mediaType: string; serverId: string; isAutoplay?: boolean }) {
  trackEvent("funnel_play", { step: "play", ...props });
}

export function trackPartyStep(props: { roomId: string; isHost: boolean; joinedVia?: "invite" | "code" | "url" }) {
  trackEvent("funnel_party", { step: "party", ...props });
}

/**
 * Custom Breadcrumbs for Party Guard Rails
 *
 * These breadcrumbs provide a trail of events leading up to critical moments
 * like drift corrections, reconnections, and sync failures.
 */
interface Breadcrumb {
  type: "drift_snap" | "reconnect" | "sync_fail" | "stage_hold" | "quality_change" | "server_switch";
  timestamp: number;
  roomId: string;
  data: Record<string, unknown>;
}

const breadcrumbBuffer: Breadcrumb[] = [];
const MAX_BREADCRUMBS = 50;

export function addBreadcrumb(breadcrumb: Omit<Breadcrumb, "timestamp">) {
  if (breadcrumbBuffer.length >= MAX_BREADCRUMBS) {
    breadcrumbBuffer.shift();
  }
  breadcrumbBuffer.push({ ...breadcrumb, timestamp: Date.now() });
}

export function getBreadcrumbs(): Breadcrumb[] {
  return [...breadcrumbBuffer];
}

export function clearBreadcrumbs() {
  breadcrumbBuffer.length = 0;
}

// Party guard rail breadcrumb helpers
export function breadcrumbDriftSnap(roomId: string, driftMs: number, correctionType: "soft" | "hard" | "manual") {
  addBreadcrumb({ type: "drift_snap", roomId, data: { driftMs, correctionType } });
}

export function breadcrumbReconnect(roomId: string, wasDisconnectedMs: number, transport: "webrtc" | "firestore" | "both") {
  addBreadcrumb({ type: "reconnect", roomId, data: { wasDisconnectedMs, transport } });
}

export function breadcrumbSyncFail(roomId: string, reason: string, attemptNumber: number) {
  addBreadcrumb({ type: "sync_fail", roomId, data: { reason, attemptNumber } });
}

export function breadcrumbStageHold(roomId: string, targetTime: number, releaseAt: number) {
  addBreadcrumb({ type: "stage_hold", roomId, data: { targetTime, releaseAt } });
}

export function breadcrumbQualityChange(roomId: string, from: string, to: string) {
  addBreadcrumb({ type: "quality_change", roomId, data: { from, to } });
}

export function breadcrumbServerSwitch(roomId: string, fromServer: number, toServer: number) {
  addBreadcrumb({ type: "server_switch", roomId, data: { fromServer, toServer } });
}

/**
 * Web Vitals Capture (LCP, FID, CLS)
 *
 * Uses the web-vitals library to capture Core Web Vitals and send to analytics.
 */
let webVitalsInitialized = false;

export function initWebVitals() {
  if (typeof window === "undefined" || webVitalsInitialized) return;

  webVitalsInitialized = true;

  // Dynamic import to avoid SSR issues
  import("web-vitals").then(({ onCLS, onFID, onFCP, onLCP, onTTFB }) => {
    const sendToAnalytics = (metric: { name: string; value: number; rating: string; id: string }) => {
      trackEvent(`web_vital_${metric.name.toLowerCase()}`, {
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
      });
    };

    onCLS(sendToAnalytics);
    onFID(sendToAnalytics);
    onFCP(sendToAnalytics);
    onLCP(sendToAnalytics);
    onTTFB(sendToAnalytics);
  }).catch((err) => {
    console.warn("[Analytics] Web Vitals init failed:", err);
  });
}

/**
 * Attach breadcrumbs to events automatically
 * Call this before sending important events to include context
 */
export function withBreadcrumbs<T extends Record<string, unknown>>(eventName: string, properties: T) {
  const breadcrumbs = getBreadcrumbs().slice(-10); // Last 10 breadcrumbs
  return {
    ...properties,
    breadcrumbs: breadcrumbs.map(b => ({
      type: b.type,
      ts: b.timestamp,
      ...b.data,
    })),
  };
}