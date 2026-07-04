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
  title?: string;
  name?: string;
}

export interface SitemapContentItem {
  id: number;
  type: "movie" | "tv";
  title?: string;
}

async function fetchTmdbPage(path: string): Promise<TmdbTrendingItem[]> {
  try {
    const res = await fetch(`${TMDB_BASE}${path}`, {
      headers: getTmdbHeaders(),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []) as TmdbTrendingItem[];
  } catch {
    return [];
  }
}

function toSitemapItems(results: TmdbTrendingItem[], type?: "movie" | "tv"): SitemapContentItem[] {
  return results
    .filter((item) => item?.id)
    .map((item) => ({
      id: item.id,
      type: (type ?? (item.media_type === "tv" ? "tv" : "movie")) as "movie" | "tv",
      title: item.title || item.name,
    }));
}

export async function fetchTrendingForSitemap(): Promise<SitemapContentItem[]> {
  const [trendingWeek, trendingDay, popularMovies, popularTv] = await Promise.all([
    fetchTmdbPage("/trending/all/week?language=en-US"),
    fetchTmdbPage("/trending/all/day?language=en-US"),
    fetchTmdbPage("/movie/popular?language=en-US&page=1"),
    fetchTmdbPage("/tv/popular?language=en-US&page=1"),
  ]);

  const merged = [
    ...toSitemapItems(trendingWeek),
    ...toSitemapItems(trendingDay),
    ...toSitemapItems(popularMovies, "movie"),
    ...toSitemapItems(popularTv, "tv"),
  ];

  const seen = new Set<string>();
  const unique: SitemapContentItem[] = [];
  for (const item of merged) {
    const key = `${item.type}-${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= 250) break;
  }

  return unique;
}
