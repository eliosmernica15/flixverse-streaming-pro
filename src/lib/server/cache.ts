/**
 * Server-side caching utilities for API routes.
 *
 * Vercel serverless functions are frozen and reused between requests, so a
 * module-level map survives warm invocations. Two complementary layers:
 *
 *  1. `singleFlight` — collapses concurrent identical requests into one
 *     upstream fetch. On a cold start the catalog page fans out ~12 TMDB
 *     calls; without this every concurrent visitor re-issues all of them.
 *
 *  2. `TtlCache` — a bounded LRU-ish map with per-entry expiry. Keeps the
 *     hot "trending", "popular" and detail payloads in memory so repeat
 *     requests never leave the function.
 *
 * Neither layer is authoritative: Next's `fetch` cache and the CDN
 * `Cache-Control` headers still do the heavy lifting across instances.
 * These just stop a single instance from stampeding its upstream.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private map = new Map<string, CacheEntry<T>>();
  private readonly maxEntries: number;

  constructor(maxEntries = 256) {
    this.maxEntries = maxEntries;
  }

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency: delete + set moves the key to the end.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
    this.evict();
  }

  private evict(): void {
    if (this.map.size <= this.maxEntries) return;
    const overflow = this.map.size - this.maxEntries;
    let removed = 0;
    for (const key of this.map.keys()) {
      if (removed >= overflow) break;
      this.map.delete(key);
      removed += 1;
    }
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Collapse concurrent calls with the same key into a single execution.
 * The in-flight entry is always cleared, so a rejected promise does not
 * poison the key for later callers.
 */
export function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = (async () => {
    try {
      return await fn();
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

export interface RetryOptions {
  attempts?: number;
  /** Base delay in ms; doubled each attempt with jitter. */
  baseDelayMs?: number;
  /** Give up early when the error looks permanent. */
  shouldRetry?: (error: unknown) => boolean;
}

function defaultShouldRetry(error: unknown): boolean {
  // Retry transport failures and 5xx. A 4xx (bad key, 404 title) will not
  // change on a retry and would just burn the caller's latency budget.
  const status = (error as { status?: unknown })?.status;
  if (typeof status === "number") return status >= 500 || status === 429;
  return true;
}

/** Retry an async operation with exponential backoff + jitter. */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelay = Math.max(0, options.baseDelayMs ?? 120);
  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !shouldRetry(error)) break;
      const backoff = baseDelay * 2 ** (attempt - 1);
      const jitter = Math.random() * backoff * 0.3;
      await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
    }
  }
  throw lastError;
}
