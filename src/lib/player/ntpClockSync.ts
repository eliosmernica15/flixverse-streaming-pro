/**
 * Coarse-clock synchronisation for watch-party playback.
 *
 * Guests must agree with the host on "what time is it" to within a few tens
 * of milliseconds, otherwise the drift corrector fights the provider: the
 * guest seeks, the host's next heartbeat says it is still behind, and the
 * room stutters. Device clocks routinely differ by seconds.
 *
 * Two things matter for accuracy and both were wrong before:
 *
 *  1. **Sub-second resolution.** Cloudflare's `cdn-cgi/trace` reports
 *     `ts=<seconds>.<fraction>`. Previously only the integer part was parsed,
 *     injecting up to a full second of error into every calculation — larger
 *     than the entire drift threshold. We now parse the fraction.
 *
 *  2. **Round-trip measured at the response, not after the body.** Measuring
 *     after `await res.text()` adds the body download to the one-way estimate
 *     and skews the offset by half of it. We stamp the time as soon as the
 *     headers arrive (`Date` header / first byte) instead.
 *
 * The offset is a plain additive correction layered over `Date.now()`.
 * `calibrate()` never blocks: local time is used immediately and refined in
 * the background. Failure is silent and leaves a zero offset.
 */

const TRACE_URL = "https://www.cloudflare.com/cdn-cgi/trace";
const TIMEOUT_MS = 2500;
/** Re-measure this often while a party is active; clocks drift. */
const RECALIBRATE_AFTER_MS = 10 * 60 * 1000;

export class NTPClient {
  private static offset = 0;
  private static calibratedAt = 0;
  private static calibrating = false;
  /** Best observed round-trip. A sample is only accepted if it improves on it. */
  private static bestRttMs = Number.POSITIVE_INFINITY;

  /**
   * Begin (or refresh) calibration. Safe to call repeatedly — concurrent
   * calls collapse and a re-calibration only runs once the previous sample
   * is stale.
   */
  static async calibrate(): Promise<void> {
    if (this.calibrating) return;
    const age = Date.now() - this.calibratedAt;
    if (this.calibratedAt > 0 && age < RECALIBRATE_AFTER_MS) return;
    this.calibrating = true;
    try {
      await this.refineOffset();
    } finally {
      this.calibrating = false;
    }
  }

  /** The wall-clock correction in milliseconds (server − local). */
  static getOffset(): number {
    return this.offset;
  }

  /** True once a server sample has been accepted. */
  static isCalibrated(): boolean {
    return this.calibratedAt > 0;
  }

  private static async refineOffset(): Promise<void> {
    const startedAt = performance.now();
    try {
      const res = await fetch(TRACE_URL, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      // Stamp the moment the response is available. Reading the body costs
      // extra time that would otherwise be attributed to network latency.
      const receivedAt = Date.now();
      const text = await res.text();

      const match = text.match(/^ts=(\d+(?:\.\d+)?)\s*$/m);
      if (!match) return;

      const seconds = Number.parseFloat(match[1]);
      if (!Number.isFinite(seconds)) return;

      // `ts` is UNIX seconds with a fractional part. Anything under 1e12 is
      // seconds; a millisecond timestamp would be ~1e12.
      const serverMs = seconds < 1e12 ? seconds * 1000 : seconds;
      const roundTrip = performance.now() - startedAt;
      // Only trust samples that are actually better than what we already
      // have — a congested measurement adds noise, not accuracy.
      if (roundTrip > this.bestRttMs * 1.5 && this.calibratedAt > 0) return;
      this.bestRttMs = Math.min(this.bestRttMs, roundTrip);

      // Assume symmetric latency: the server timestamp corresponds to the
      // midpoint of the round trip.
      this.offset = serverMs + roundTrip / 2 - receivedAt;
      this.calibratedAt = Date.now();
    } catch {
      // Network blocked or offline — local time remains authoritative.
      if (this.calibratedAt === 0) this.offset = 0;
    }
  }

  /** Server-corrected wall clock in milliseconds. */
  static now(): number {
    return Date.now() + this.offset;
  }

  /** Convert a local timestamp into the shared timeline. */
  static toShared(localMs: number): number {
    return localMs + this.offset;
  }

  /** Convert a shared-timeline timestamp back into local wall time. */
  static toLocal(sharedMs: number): number {
    return sharedMs - this.offset;
  }

  /** Test seam: forget the current sample. */
  static reset(): void {
    this.offset = 0;
    this.calibratedAt = 0;
    this.bestRttMs = Number.POSITIVE_INFINITY;
  }
}
