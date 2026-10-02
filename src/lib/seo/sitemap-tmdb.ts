import { getServerTmdbAuth } from "@/lib/tmdb/serverCredentials";

const TMDB_BASE = "https://api.themoviedb.org/3";
const MAX_ITEMS = 300;

function tmdbRequest(path: string): { url: string; headers: HeadersInit } {
  const auth = getServerTmdbAuth();
  let url = `${TMDB_BASE}${path}`;
  if (auth.queryApiKey) {
    const sep = path.includes("?") ? "&" : "?";
    url += `${sep}api_key=${encodeURIComponent(auth.queryApiKey)}`;
  }
  return { url, headers: auth.headers };
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const { url, headers } = tmdbRequest(path);
    const res = await fetch(url, {
      headers,
      signal: controller.signal,
      next: { revalidate: 86400 },
    });
    clearTimeout(timeout);
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
  try {
    const [trendingWeek, popularMovies, popularTv, topRatedMovies] = await Promise.all([
      fetchTmdbPage("/trending/all/week?language=en-US"),
      fetchTmdbPage("/movie/popular?language=en-US&page=1"),
      fetchTmdbPage("/tv/popular?language=en-US&page=1"),
      fetchTmdbPage("/movie/top_rated?language=en-US&page=1"),
    ]);

    const merged = [
      ...toSitemapItems(trendingWeek),
      ...toSitemapItems(popularMovies, "movie"),
      ...toSitemapItems(popularTv, "tv"),
      ...toSitemapItems(topRatedMovies, "movie"),
    ];

    return dedupeItems(merged, MAX_ITEMS);
  } catch {
    return [];
  }
}

/** @deprecated Use fetchAllSitemapContent */
export async function fetchTrendingForSitemap(): Promise<SitemapContentItem[]> {
  return fetchAllSitemapContent();
}
