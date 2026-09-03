/**
 * Adaptive re-sync for FlixParty.
 * - Soft drift (3–30s): send postMessage seek commands to the embed iframe
 * - Hard resync (>30s): reload iframe with corrected start URL (guest-only, heavily throttled)
 */

export type SyncAction =
  | { kind: "soft"; deltaSeconds: number }
  | { kind: "hard"; seekUrl: string }
  | { kind: "none" };

const SOFT_DRIFT_THRESHOLD = 3;
const HARD_DRIFT_THRESHOLD = 30;

/**
 * Given host time, guest time, and the embed URL, decide whether to soft-seek,
 * hard-resync (URL rewrite), or do nothing.
 */
export function computeResync(
  hostTimeSeconds: number,
  guestTimeSeconds: number,
  embedUrl: string,
  serverId: string
): SyncAction {
  const drift = Math.abs(hostTimeSeconds - guestTimeSeconds);

  if (drift < SOFT_DRIFT_THRESHOLD) {
    return { kind: "none" };
  }

  if (drift <= HARD_DRIFT_THRESHOLD) {
    return { kind: "soft", deltaSeconds: hostTimeSeconds - guestTimeSeconds };
  }

  // Hard resync: rebuild URL with &start= param
  const seekUrl = injectSeekParam(embedUrl, hostTimeSeconds);
  return { kind: "hard", seekUrl };
}

/**
 * Build a seek URL for a given embed provider by injecting a start-time parameter.
 * Supports VidSrc (vidsrcme.ru / vidsrc.to / vidsrc.me), VidLink, Videasy, VidFast, YapGrid.
 */
export function injectSeekParam(url: string, startSeconds: number): string {
  const t = Math.max(0, Math.floor(startSeconds));

  // VidSrc family (canonical vidsrcme.ru + per-domain mirror vidsrc.to +
  // legacy vidsrc.me): add &t= param.
  if (/vidsrc(me\.ru|\.to|\.me)/.test(url)) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}t=${t}`;
  }

  // VidLink: add #t= hash
  if (url.includes("vidlink.pro")) {
    return `${url}#t=${t}`;
  }

  // Videasy (canonical player.videasy.to + root videasy.to + legacy
  // player.videasy.net): add &progress= param (seconds).
  if (/player\.videasy\.to|videasy\.to/.test(url)) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}progress=${t}`;
  }

  // VidFast: add &startAt= param
  if (url.includes("vidfast.pro")) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}startAt=${t}`;
  }

  // YapGrid: add &start= param (the builder's known querystring).
  if (url.includes("yapgrid.com")) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}start=${t}`;
  }

  // Unknown provider: best effort with &start=
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}start=${t}`;
}

/**
 * Send a soft seek command to an embed iframe via postMessage.
 */
export function sendSoftSeek(
  iframe: HTMLIFrameElement | null,
  deltaSeconds: number
) {
  const win = iframe?.contentWindow;
  if (!win) return;

  const payloads = [
    { event: "command", func: "seek", args: [deltaSeconds] },
    { method: "seek", value: deltaSeconds },
    { action: "seek", seconds: deltaSeconds },
    { type: "seek", direction: deltaSeconds > 0 ? "forward" : "back", amount: Math.abs(deltaSeconds) },
  ];

  for (const payload of payloads) {
    try {
      win.postMessage(typeof payload === "string" ? payload : JSON.stringify(payload), "*");
    } catch {
      // cross-origin postMessage failures are ignored
    }
  }
}
