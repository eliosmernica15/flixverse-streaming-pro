/**
 * Adaptive re-sync for FlixParty.
 * - Soft drift (3–8s): send postMessage seek commands to the embed iframe
 * - Hard resync (>8s): reload iframe with corrected start URL
 */

export type SyncAction =
  | { kind: "soft"; deltaSeconds: number }
  | { kind: "hard"; seekUrl: string }
  | { kind: "none" };

const SOFT_DRIFT_THRESHOLD = 3;
const HARD_DRIFT_THRESHOLD = 8;

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
 * Supports VidSrc CC/ICU, VidLink, Embed SU, SuperEmbed, AutoEmbed patterns.
 */
export function injectSeekParam(url: string, startSeconds: number): string {
  const t = Math.max(0, Math.floor(startSeconds));

  // VidSrc family (vidsrc.me / .net / .xyz / .cc / .icu): add &t= param
  if (/vidsrc\.(me|net|in|pm|xyz|cc|icu)/.test(url)) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}t=${t}`;
  }

  // VidLink: add #t= hash
  if (url.includes("vidlink.pro")) {
    return `${url}#t=${t}`;
  }

  // Videasy: add &progress= param (seconds)
  if (url.includes("videasy.net")) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}progress=${t}`;
  }

  // VidFast: add &startAt= param
  if (url.includes("vidfast.pro")) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}startAt=${t}`;
  }

  // Embed SU / SuperEmbed (multiembed): add &start= param
  if (url.includes("embed.su") || url.includes("multiembed.mov")) {
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
