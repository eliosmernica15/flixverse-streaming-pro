import { NextRequest, NextResponse } from "next/server";

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
  const { path } = await params;
  const tmdbPath = path.join("/");

  // Build query string from the incoming request
  const url = new URL(request.url);
  const tmdbParams = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    tmdbParams.set(key, value);
  }

  // Inject the API key
  const apiKey = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB API key not configured" },
      { status: 500 }
    );
  }
  tmdbParams.set("api_key", apiKey);

  const tmdbUrl = `${TMDB_BASE}/${tmdbPath}?${tmdbParams.toString()}`;

  try {
    const res = await fetch(tmdbUrl, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

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
