import { cache } from "react";

const TMDB_BASE = "https://api.themoviedb.org/3";

function getTmdbHeaders(): HeadersInit {
  const token = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;
  if (!token) return { accept: "application/json" };
  return {
    accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
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
    const res = await fetch(`${TMDB_BASE}/${mediaType}/${id}`, {
      headers: getTmdbHeaders(),
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
