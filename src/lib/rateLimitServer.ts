import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

type LimitResult = { success: boolean; limit: number; remaining: number; reset: number };

const inMemoryBuckets = new Map<string, { count: number; resetAt: number }>();

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

function inMemoryLimit(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now();
  const bucket = inMemoryBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    inMemoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, limit, remaining: limit - 1, reset: now + windowMs };
  }
  if (bucket.count >= limit) {
    return { success: false, limit, remaining: 0, reset: bucket.resetAt };
  }
  bucket.count++;
  return { success: true, limit, remaining: limit - bucket.count, reset: bucket.resetAt };
}

const limiterCache = new Map<string, Ratelimit>();

function getLimiter(name: string, requests: number, window: `${number} s` | `${number} m` | `${number} h`): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const cacheKey = `${name}:${requests}:${window}`;
  if (!limiterCache.has(cacheKey)) {
    limiterCache.set(
      cacheKey,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(requests, window),
        prefix: `flixverse:${name}`,
      })
    );
  }
  return limiterCache.get(cacheKey)!;
}

export async function rateLimitByIp(
  request: NextRequest,
  name: string,
  requests = 60,
  window: `${number} s` | `${number} m` | `${number} h` = "1 m"
): Promise<LimitResult> {
  const ip = getClientIp(request);
  const key = `ip:${ip}`;

  const limiter = getLimiter(name, requests, window);
  if (limiter) {
    const result = await limiter.limit(key);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  }

  const windowMs =
    window.endsWith("h") ? parseInt(window) * 3_600_000 :
    window.endsWith("m") ? parseInt(window) * 60_000 :
    parseInt(window) * 1_000;

  return inMemoryLimit(`${name}:${key}`, requests, windowMs);
}

export async function rateLimitByUser(
  uid: string,
  name: string,
  requests = 30,
  window: `${number} s` | `${number} m` | `${number} h` = "1 m"
): Promise<LimitResult> {
  const key = `uid:${uid}`;
  const limiter = getLimiter(name, requests, window);
  if (limiter) {
    const result = await limiter.limit(key);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  }
  const windowMs =
    window.endsWith("h") ? parseInt(window) * 3_600_000 :
    window.endsWith("m") ? parseInt(window) * 60_000 :
    parseInt(window) * 1_000;
  return inMemoryLimit(`${name}:${key}`, requests, windowMs);
}

export function rateLimitResponse(result: LimitResult): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
        "Retry-After": String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))),
      },
    }
  );
}
