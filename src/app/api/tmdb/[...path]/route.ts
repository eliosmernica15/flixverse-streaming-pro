import { NextRequest, NextResponse } from "next/server";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";
import {
  defaultLocale,
  isValidLocale,
  LOCALE_STORAGE_KEY,
  localeToTmdbLanguage,
} from "@/i18n/config";
import { getServerTmdbAuth, hasServerTmdbCredentials } from "@/lib/tmdb/serverCredentials";
import { TtlCache, singleFlight, withRetry } from "@/lib/server/cache";

const TMDB_BASE = "https://api.themoviedb.org/3";
const PATH_SAFE = /^[a-z0-9/_-]+$/i;

/**
 * Warm-instance cache. Catalog payloads change slowly (TMDB updates trending
 * hourly at most) so a 5-minute in-memory TTL is invisible to users and
 * removes almost all upstream traffic on a warm function.
 *
 * `detail` endpoints (movie/tv/person + credits/videos) get a longer TTL:
 * the data is effectively immutable once a title ships.
 */
const DETAIL_SEGMENTS = new Set(["movie", "tv", "person", "collection", "season", "episode"]);
const CACHE_TTL_MS = 5 * 60 * 1000;
const DETAIL_CACHE_TTL_MS = 60 * 60 * 1000;

const responseCache = new TtlCache<unknown>(512);

/**
 * Secondary store with a long lifetime, consulted only when the upstream
 * fails. It exists so a transient TMDB outage degrades to "slightly stale
 * catalogue" instead of "empty catalogue". Entries are refreshed on every
 * successful fetch, so it always holds the most recent good payload.
 */
const staleCache = new TtlCache<unknown>(512);
const STALE_TTL_MS = 24 * 60 * 60 * 1000;

/** Upstream budget. TMDB's p95 under load is well under this. */
const UPSTREAM_TIMEOUT_MS = 8_000;

function cacheTtlFor(tmdbPath: string): number {
  const head = tmdbPath.split("/")[0]?.toLowerCase() ?? "";
  return DETAIL_SEGMENTS.has(head) ? DETAIL_CACHE_TTL_MS : CACHE_TTL_MS;
}

class UpstreamError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Server-side TMDB proxy. Client calls /api/tmdb/* — credentials stay on the server.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // A single catalog page fans out to ~12 TMDB calls, and a returning visitor
  // re-renders a dozen rows. 120/min throttled ordinary browsing and made the
  // client show fetch failures that looked like cold-start timeouts. The
  // server-side cache and single-flight already protect the upstream, so the
  // per-IP ceiling only needs to stop abuse.
  const limit = await rateLimitByIp(request, "tmdb", 600, "1 m");
  if (!limit.success) return rateLimitResponse(limit);

  const { path } = await params;
  const tmdbPath = path.join("/");

  if (!tmdbPath || tmdbPath.includes("..") || !PATH_SAFE.test(tmdbPath)) {
    return NextResponse.json({ error: "Invalid TMDB path" }, { status: 400 });
  }

  if (!hasServerTmdbCredentials()) {
    return NextResponse.json(
      { error: "TMDB API key or access token not configured" },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const tmdbParams = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (key === "api_key" || key === "api_token") continue;
    tmdbParams.set(key, value);
  }

  if (!tmdbParams.has("language")) {
    const cookieLocale = request.cookies.get(LOCALE_STORAGE_KEY)?.value;
    const locale = isValidLocale(cookieLocale) ? cookieLocale : defaultLocale;
    tmdbParams.set("language", localeToTmdbLanguage(locale));
  }

  const auth = getServerTmdbAuth();
  if (auth.queryApiKey) tmdbParams.set("api_key", auth.queryApiKey);

  const tmdbUrl = `${TMDB_BASE}/${tmdbPath}?${tmdbParams.toString()}`;
  // Key on path + params but NOT on the API key (which is constant anyway).
  const cacheKey = `${tmdbPath}?${tmdbParams.toString()}`;
  const ttl = cacheTtlFor(tmdbPath);

  const cached = responseCache.get(cacheKey);
  if (cached !== undefined) {
    return NextResponse.json(cached, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "X-Cache": "HIT",
      },
    });
  }

  try {
    // Single-flight: a cold instance receiving 20 concurrent requests for
    // "trending/movie/day" issues exactly one upstream call.
    const data = await singleFlight(cacheKey, () =>
      withRetry(
        async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
          try {
            const res = await fetch(tmdbUrl, {
              headers: auth.headers,
              next: { revalidate: 3600 },
              signal: controller.signal,
            });
            if (!res.ok) {
              throw new UpstreamError(`TMDB returned ${res.status}`, res.status);
            }
            return (await res.json()) as unknown;
          } finally {
            clearTimeout(timeout);
          }
        },
        {
          attempts: 3,
          baseDelayMs: 120,
          // 4xx responses are deterministic — don't waste the budget.
          shouldRetry: (err) => {
            if (err instanceof UpstreamError) {
              return err.status >= 500 || err.status === 429;
            }
            // AbortError / network failure — worth one more try.
            return true;
          },
        }
      )
    );

    responseCache.set(cacheKey, data, ttl);
    staleCache.set(cacheKey, data, STALE_TTL_MS);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "X-Cache": "MISS",
      },
    });
  } catch (err) {
    // Upstream failure (5xx, timeout, network). Before giving up, serve a
    // stale copy if one is on hand: `TtlCache` deletes entries on expiry, so
    // the fresh-hit path above can never see one — but the whole point of a
    // stale fallback is to survive exactly the moment the upstream is down.
    // Without this, a TMDB blip blanked the entire catalog even though the
    // instance had every payload in memory a minute earlier.
    const stale = staleCache.get(cacheKey);
    if (stale !== undefined) {
      return NextResponse.json(stale, {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=86400",
          "X-Cache": "STALE",
        },
      });
    }

    // Upstream returned a definite status: surface it so the client can
    // distinguish "title does not exist" from "TMDB is down".
    if (err instanceof UpstreamError) {
      return NextResponse.json(
        { error: `TMDB returned ${err.status}` },
        { status: err.status === 429 ? 429 : err.status >= 500 ? 502 : err.status }
      );
    }

    // Timeout / network: fail fast so the client falls back to its own
    // cached/placeholder state instead of hanging until max duration.
    return NextResponse.json(
      { error: "Failed to fetch from TMDB" },
      {
        status: 504,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
