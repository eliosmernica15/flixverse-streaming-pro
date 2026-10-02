import { NextRequest, NextResponse } from "next/server";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";
import {
  defaultLocale,
  isValidLocale,
  LOCALE_STORAGE_KEY,
  localeToTmdbLanguage,
} from "@/i18n/config";
import { getServerTmdbAuth, hasServerTmdbCredentials } from "@/lib/tmdb/serverCredentials";

const TMDB_BASE = "https://api.themoviedb.org/3";
const PATH_SAFE = /^[a-z0-9/_-]+$/i;

/**
 * Server-side TMDB proxy. Client calls /api/tmdb/* — credentials stay on the server.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const limit = await rateLimitByIp(request, "tmdb", 120, "1 m");
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

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    const res = await fetch(tmdbUrl, {
      headers: auth.headers,
      next: { revalidate: 3600 },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { error: `TMDB returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch from TMDB" },
      { status: 502 }
    );
  }
}
