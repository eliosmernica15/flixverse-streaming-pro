import { cache } from "react";
import { getServerTmdbAuth } from "@/lib/tmdb/serverCredentials";

const TMDB_BASE = "https://api.themoviedb.org/3";

function tmdbUrl(path: string): string {
  const auth = getServerTmdbAuth();
  const url = `${TMDB_BASE}${path}`;
  if (!auth.queryApiKey) return url;
  const sep = path.includes("?") ? "&" : "?";
  return `${url}${sep}api_key=${encodeURIComponent(auth.queryApiKey)}`;
}

export interface TmdbSeoContent {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  media_type: "movie" | "tv";
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
}

async function fetchTmdbSeoContentUncached(
  id: number,
  mediaType: "movie" | "tv"
): Promise<TmdbSeoContent | null> {
  try {
    const res = await fetch(tmdbUrl(`/${mediaType}/${id}`), {
      headers: getServerTmdbAuth().headers,
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: data.id,
      title: data.title || data.name || "Title",
      overview: data.overview || "",
      poster_path: data.poster_path ?? null,
      backdrop_path: data.backdrop_path ?? null,
      media_type: mediaType,
      vote_average: typeof data.vote_average === "number" ? data.vote_average : 0,
      release_date: data.release_date,
      first_air_date: data.first_air_date,
    };
  } catch {
    return null;
  }
}

/** Dedupes TMDB calls within a single server request (metadata + page + OG). */
export const getCachedTmdbSeoContent = cache(fetchTmdbSeoContentUncached);

export function tmdbPosterUrl(path: string | null, size = "w500") {
  if (!path) return undefined;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function tmdbBackdropUrl(path: string | null, size = "w1280") {
  if (!path) return undefined;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
