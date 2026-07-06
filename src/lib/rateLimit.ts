/**
 * Client-side rate limiting using a sliding window.
 * For production, pair with @upstash/ratelimit on the server.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

function cleanup(key: string, windowMs: number) {
  const entry = store.get(key);
  if (!entry) return;
  const cutoff = Date.now() - windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (entry.timestamps.length === 0) {
    store.delete(key);
  }
}

/**
 * Check if an action is allowed under the rate limit.
 * Returns true if allowed, false if rate-limited.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  cleanup(key, windowMs);
  const entry = store.get(key) || { timestamps: [] };

  if (entry.timestamps.length >= maxRequests) {
    return false;
  }

  entry.timestamps.push(Date.now());
  store.set(key, entry);
  return true;
}

/**
 * Get the number of remaining requests in the current window.
 */
export function getRemainingRequests(
  key: string,
  maxRequests: number,
  windowMs: number
): number {
  cleanup(key, windowMs);
  const entry = store.get(key);
  if (!entry) return maxRequests;
  return Math.max(0, maxRequests - entry.timestamps.length);
}

// Pre-defined rate limits for common actions
export const RATE_LIMITS = {
  /** Max comments per hour per user */
  TIMELINE_COMMENT: { max: 10, windowMs: 60 * 60 * 1000 },
  /** Max party chat messages per minute per user */
  PARTY_CHAT: { max: 60, windowMs: 60 * 1000 },
  /** Max reviews per day per user */
  REVIEW: { max: 5, windowMs: 24 * 60 * 60 * 1000 },
  /** Max search requests per minute */
  SEARCH: { max: 30, windowMs: 60 * 1000 },
  /** Max report submissions per hour */
  REPORT: { max: 10, windowMs: 60 * 60 * 1000 },
} as const;

export function isRateLimited(action: keyof typeof RATE_LIMITS, userId: string): boolean {
  const limit = RATE_LIMITS[action];
  return !checkRateLimit(`${action}:${userId}`, limit.max, limit.windowMs);
}
