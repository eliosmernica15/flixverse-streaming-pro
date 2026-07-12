import { NextRequest, NextResponse } from "next/server";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";
import {
  defaultLocale,
  isValidLocale,
  LOCALE_STORAGE_KEY,
  localeToTmdbLanguage,
} from "@/i18n/config";

const TMDB_BASE = "https://api.themoviedb.org/3";

/**
 * Server-side TMDB proxy.
 * Hides the API key from client bundles — all TMDB requests go through this route.
 * In production, move the key to a server-only env var (NEXT_PUBLIC_ removed).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const limit = await rateLimitByIp(request, "tmdb", 120, "1 m");
  if (!limit.success) return rateLimitResponse(limit);

  const { path } = await params;
  const tmdbPath = path.join("/");

  // Build query string from the incoming request
  const url = new URL(request.url);
  const tmdbParams = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    tmdbParams.set(key, value);
  }

  if (!tmdbParams.has("language")) {
    const cookieLocale = request.cookies.get(LOCALE_STORAGE_KEY)?.value;
    const locale = isValidLocale(cookieLocale) ? cookieLocale : defaultLocale;
    tmdbParams.set("language", localeToTmdbLanguage(locale));
  }

  // Inject API key or Bearer token
  const apiKey = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;
  const accessToken = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;

  const headers: Record<string, string> = { Accept: "application/json" };
  let tmdbUrl: string;

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
    tmdbUrl = `${TMDB_BASE}/${tmdbPath}?${tmdbParams.toString()}`;
  } else if (apiKey) {
    tmdbParams.set("api_key", apiKey);
    tmdbUrl = `${TMDB_BASE}/${tmdbPath}?${tmdbParams.toString()}`;
  } else {
    return NextResponse.json(
      { error: "TMDB API key or access token not configured" },
      { status: 500 }
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    const res = await fetch(tmdbUrl, {
      headers,
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
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch from TMDB" },
      { status: 502 }
    );
  }
}
