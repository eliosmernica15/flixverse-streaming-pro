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

async function fetchMoviePages(pages: number[]): Promise<SitemapContentItem[]> {
  const results = await Promise.all(
    pages.map((page) => fetchTmdbPage(`/movie/popular?language=en-US&page=${page}`))
  );
  return results.flatMap((r) => toSitemapItems(r, "movie"));
}

async function fetchTvPages(pages: number[]): Promise<SitemapContentItem[]> {
  const results = await Promise.all(
    pages.map((page) => fetchTmdbPage(`/tv/popular?language=en-US&page=${page}`))
  );
  return results.flatMap((r) => toSitemapItems(r, "tv"));
}

function dedupeItems(items: SitemapContentItem[], limit: number): SitemapContentItem[] {
  const seen = new Set<string>();
  const unique: SitemapContentItem[] = [];
  for (const item of items) {
    const key = `${item.type}-${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= limit) break;
  }
  return unique;
}

export async function fetchAllSitemapContent(): Promise<SitemapContentItem[]> {
  const [
    trendingWeek,
    trendingDay,
    topRatedMovies,
    topRatedTv,
    nowPlaying,
    onTheAir,
    popularMovies,
    popularTv,
  ] = await Promise.all([
    fetchTmdbPage("/trending/all/week?language=en-US"),
    fetchTmdbPage("/trending/all/day?language=en-US"),
    fetchTmdbPage("/movie/top_rated?language=en-US&page=1"),
    fetchTmdbPage("/tv/top_rated?language=en-US&page=1"),
    fetchTmdbPage("/movie/now_playing?language=en-US&page=1"),
    fetchTmdbPage("/tv/on_the_air?language=en-US&page=1"),
    fetchMoviePages([1, 2, 3, 4, 5]),
    fetchTvPages([1, 2, 3, 4, 5]),
  ]);

  const merged = [
    ...toSitemapItems(trendingWeek),
    ...toSitemapItems(trendingDay),
    ...toSitemapItems(topRatedMovies, "movie"),
    ...toSitemapItems(topRatedTv, "tv"),
    ...toSitemapItems(nowPlaying, "movie"),
    ...toSitemapItems(onTheAir, "tv"),
    ...popularMovies,
    ...popularTv,
  ];

  return dedupeItems(merged, 500);
}

/** @deprecated Use fetchAllSitemapContent */
export async function fetchTrendingForSitemap(): Promise<SitemapContentItem[]> {
  return fetchAllSitemapContent();
}
