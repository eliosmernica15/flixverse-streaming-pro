const TMDB_BASE = "https://api.themoviedb.org/3";

function getTmdbHeaders(): HeadersInit {
  const token = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;
  if (!token) return { accept: "application/json" };
  return {
    accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}

interface TmdbTrendingItem {
  id: number;
  media_type?: string;
}

export async function fetchTrendingForSitemap(): Promise<
  { id: number; type: "movie" | "tv" }[]
> {
  try {
    const res = await fetch(`${TMDB_BASE}/trending/all/week?language=en-US`, {
      headers: getTmdbHeaders(),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const results = (data.results ?? []) as TmdbTrendingItem[];
    return results
      .filter((item) => item.media_type === "movie" || item.media_type === "tv")
      .slice(0, 100)
      .map((item) => ({
        id: item.id,
        type: item.media_type as "movie" | "tv",
      }));
  } catch {
    return [];
  }
}
