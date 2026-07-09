import { NextRequest, NextResponse } from "next/server";
import { parseSubtitles } from "@/lib/player/captionParser";

const TMDB_BASE = "https://api.themoviedb.org/3";

async function fetchTmdbTitle(
  tmdbId: number,
  mediaType: "movie" | "tv",
  season?: number,
  episode?: number
): Promise<string> {
  const apiKey = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;
  const token = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;
  if (!apiKey && !token) return "Now playing";

  const path =
    mediaType === "tv" && season && episode
      ? `/tv/${tmdbId}/season/${season}/episode/${episode}`
      : `/${mediaType}/${tmdbId}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = token
    ? `${TMDB_BASE}${path}`
    : `${TMDB_BASE}${path}?api_key=${apiKey}`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return "Now playing";
    const data = await res.json();
    return data.title || data.name || "Now playing";
  } catch {
    return "Now playing";
  }
}

/** Try free subtitle aggregator (wyzie). */
async function fetchExternalSubtitles(
  tmdbId: number,
  mediaType: "movie" | "tv",
  season?: number,
  episode?: number,
  lang = "en"
): Promise<string | null> {
  const params = new URLSearchParams({
    id: String(tmdbId),
    format: "srt",
    language: lang,
  });
  if (mediaType === "tv" && season && episode) {
    params.set("season", String(season));
    params.set("episode", String(episode));
  }

  const endpoints = [
    `https://sub.wyzie.ru/search?${params}`,
    `https://subs.yifysubtitles.ch/api/v1/subtitles?imdb=${tmdbId}&lang=${lang}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: { Accept: "application/json, text/plain" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("json")) {
        const data = await res.json();
        const url = data?.[0]?.url || data?.subtitles?.[0]?.url || data?.url;
        if (url) {
          const srtRes = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (srtRes.ok) return await srtRes.text();
        }
      } else {
        const text = await res.text();
        if (text.includes("-->")) return text;
      }
    } catch {
      // try next source
    }
  }
  return null;
}

/** Generate readable fallback cues from title when no subtitle file is found. */
function buildFallbackCues(title: string, duration: number): ReturnType<typeof parseSubtitles> {
  const phrases = [
    `[ ${title} ]`,
    "Subtitles will appear here when available.",
    "Enable captions in player settings.",
  ];
  const segment = Math.max(8, duration / phrases.length);
  return phrases.map((text, i) => ({
    start: i * segment,
    end: (i + 1) * segment,
    text,
  }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tmdbId = parseInt(searchParams.get("tmdbId") || "0", 10);
  const mediaType = (searchParams.get("type") || "movie") as "movie" | "tv";
  const season = searchParams.get("season") ? parseInt(searchParams.get("season")!, 10) : undefined;
  const episode = searchParams.get("episode") ? parseInt(searchParams.get("episode")!, 10) : undefined;
  const lang = searchParams.get("lang") || "en";
  const duration = parseFloat(searchParams.get("duration") || "7200");

  if (!tmdbId) {
    return NextResponse.json({ error: "tmdbId required" }, { status: 400 });
  }

  let rawSrt = await fetchExternalSubtitles(tmdbId, mediaType, season, episode, lang);
  let source: "external" | "fallback" = "external";

  if (!rawSrt) {
    source = "fallback";
    const title = await fetchTmdbTitle(tmdbId, mediaType, season, episode);
    const cues = buildFallbackCues(title, duration);
    return NextResponse.json({ cues, source, lang });
  }

  const cues = parseSubtitles(rawSrt);
  if (cues.length === 0) {
    source = "fallback";
    const title = await fetchTmdbTitle(tmdbId, mediaType, season, episode);
    return NextResponse.json({ cues: buildFallbackCues(title, duration), source, lang });
  }

  return NextResponse.json(
    { cues, source, lang },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
  );
}
