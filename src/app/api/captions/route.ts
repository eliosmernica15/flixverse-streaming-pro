import { NextRequest, NextResponse } from "next/server";
import { parseSubtitles } from "@/lib/player/captionParser";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";
import { getServerTmdbAuth, hasServerTmdbCredentials } from "@/lib/tmdb/serverCredentials";

/**
 * Subtitle API
 *
 * Two modes:
 *  - `?format=json` (default) — returns parsed cues for the in-app overlay
 *  - `?format=vtt`           — returns a WebVTT document suitable for
 *                              `?sub_url=...` on YapGrid / VidLink / etc embeds
 *
 * When a real subtitle file is fetched, the raw cues are returned. When
 * nothing is found, we still emit a tiny VTT containing a single station-Id
 * cue so the player has *something* to display rather than a broken track.
 */

const TMDB_BASE = "https://api.themoviedb.org/3";

async function fetchTmdbTitle(
  tmdbId: number,
  mediaType: "movie" | "tv",
  season?: number,
  episode?: number
): Promise<string> {
  if (!hasServerTmdbCredentials()) return "Now playing";

  const path =
    mediaType === "tv" && season && episode
      ? `/tv/${tmdbId}/season/${season}/episode/${episode}`
      : `/${mediaType}/${tmdbId}`;

  const auth = getServerTmdbAuth();
  let url = `${TMDB_BASE}${path}`;
  if (auth.queryApiKey) url += `?api_key=${encodeURIComponent(auth.queryApiKey)}`;

  try {
    const res = await fetch(url, { headers: auth.headers, next: { revalidate: 86400 } });
    if (!res.ok) return "Now playing";
    const data = await res.json();
    return data.title || data.name || "Now playing";
  } catch {
    return "Now playing";
  }
}

/** Try free subtitle aggregators in priority order. */
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

interface Cue {
  start: number;
  end: number;
  text: string;
}

function buildFallbackCues(title: string, duration: number): Cue[] {
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

function formatVttTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function cuesToVtt(cues: Cue[]): string {
  const header = "WEBVTT\n\n";
  const body = cues
    .map((c, i) => `${i + 1}\n${formatVttTimestamp(c.start)} --> ${formatVttTimestamp(c.end)}\n${c.text}\n`)
    .join("\n");
  return header + body;
}

export async function GET(request: NextRequest) {
  const limit = await rateLimitByIp(request, "captions", 40, "1 m");
  if (!limit.success) return rateLimitResponse(limit);

  const { searchParams } = request.nextUrl;
  const tmdbId = parseInt(searchParams.get("tmdbId") || "0", 10);
  const mediaType = (searchParams.get("type") || "movie") as "movie" | "tv";
  const season = searchParams.get("season") ? parseInt(searchParams.get("season")!, 10) : undefined;
  const episode = searchParams.get("episode") ? parseInt(searchParams.get("episode")!, 10) : undefined;
  const lang = searchParams.get("lang") || "en";
  const duration = parseFloat(searchParams.get("duration") || "7200");
  const format = (searchParams.get("format") || "json").toLowerCase();

  if (!tmdbId) {
    return NextResponse.json({ error: "tmdbId required" }, { status: 400 });
  }

  let rawSrt = await fetchExternalSubtitles(tmdbId, mediaType, season, episode, lang);
  let source: "external" | "fallback" = "external";

  if (!rawSrt) {
    source = "fallback";
    const title = await fetchTmdbTitle(tmdbId, mediaType, season, episode);
    const cues = buildFallbackCues(title, duration);

    if (format === "vtt") {
      // Always emit at least a placeholder VTT so the player has a usable
      // sub_url to load. We add CORS headers so the embed can fetch it.
      return new NextResponse(cuesToVtt(cues), {
        status: 200,
        headers: {
          "Content-Type": "text/vtt; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      });
    }

    return NextResponse.json({ cues, source, lang });
  }

  const cues = parseSubtitles(rawSrt);
  const finalCues: Cue[] =
    cues.length > 0
      ? cues.map((c) => ({ start: c.start, end: c.end, text: c.text }))
      : (() => {
          source = "fallback";
          return buildFallbackCues("Now playing", duration);
        })();

  if (format === "vtt") {
    return new NextResponse(cuesToVtt(finalCues), {
      status: 200,
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  }

  return NextResponse.json(
    { cues, source, lang },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
