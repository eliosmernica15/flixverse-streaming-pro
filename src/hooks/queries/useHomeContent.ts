import { useQuery } from "@tanstack/react-query";
import {
  fetchTrendingMovies,
  fetchTopRatedMovies,
  fetchPopularMovies,
  fetchTrendingTVShows,
  fetchPopularTVShows,
  fetchNowPlayingMovies,
  fetchUpcomingMovies,
  fetchUpcomingTVShows,
  isNotReleasedYet,
  TMDBMovie,
} from "@/utils/tmdbApi";
import { getHeroMovieOfTheWeek } from "@/utils/popularMoviesRotator";

export const HOME_CONTENT_KEY = ["home-content"] as const;
export const HOME_PRIORITY_KEY = ["home-content", "priority"] as const;
export const HOME_DEFERRED_KEY = ["home-content", "deferred"] as const;

const STALE = 10 * 60 * 1000;
const GC = 30 * 60 * 1000;

async function loadHomePriority() {
  const [heroMovie, trendingMovies, nowPlayingMovies] = await Promise.all([
    getHeroMovieOfTheWeek(),
    fetchTrendingMovies(),
    fetchNowPlayingMovies(),
  ]);

  const hero =
    heroMovie && !Array.isArray(heroMovie) ? heroMovie : trendingMovies?.[0] ?? null;

  return {
    hero,
    trendingMovies: trendingMovies || [],
    nowPlayingMovies: nowPlayingMovies || [],
  };
}

async function loadHomeDeferred() {
  const [
    topRatedMovies,
    popularMovies,
    trendingTVShows,
    popularTVShows,
    upcomingMoviesRaw,
    upcomingTVRaw,
  ] = await Promise.all([
    fetchTopRatedMovies(),
    fetchPopularMovies(),
    fetchTrendingTVShows(),
    fetchPopularTVShows(),
    fetchUpcomingMovies(),
    fetchUpcomingTVShows(),
  ]);

  const notReleasedMovies = (upcomingMoviesRaw || []).filter((movie) => isNotReleasedYet(movie));
  const notReleasedTV = (upcomingTVRaw || []).filter((show) => isNotReleasedYet(show));
  const comingSoon = [...notReleasedMovies, ...notReleasedTV].sort((a, b) => {
    const dateA = a.release_date || a.first_air_date || "";
    const dateB = b.release_date || b.first_air_date || "";
    return dateA.localeCompare(dateB);
  });

  return {
    topRatedMovies: topRatedMovies || [],
    popularMovies: popularMovies || [],
    trendingTVShows: trendingTVShows || [],
    popularTVShows: popularTVShows || [],
    comingSoon,
  };
}

/** Full load for route prefetch — keeps a single cache entry warm. */
export async function loadHomeContent() {
  const [priority, deferred] = await Promise.all([loadHomePriority(), loadHomeDeferred()]);
  return { ...priority, ...deferred };
}

export type HomeContent = Awaited<ReturnType<typeof loadHomeContent>>;

export function useHomeContent() {
  const priority = useQuery({
    queryKey: HOME_PRIORITY_KEY,
    queryFn: loadHomePriority,
    staleTime: STALE,
    gcTime: GC,
  });

  const deferred = useQuery({
    queryKey: HOME_DEFERRED_KEY,
    queryFn: loadHomeDeferred,
    enabled: priority.isSuccess,
    staleTime: STALE,
    gcTime: GC,
  });

  const data =
    priority.data && deferred.data
      ? ({ ...priority.data, ...deferred.data } satisfies HomeContent)
      : priority.data
        ? ({
            ...priority.data,
            topRatedMovies: [],
            popularMovies: [],
            trendingTVShows: [],
            popularTVShows: [],
            comingSoon: [],
          } satisfies HomeContent)
        : undefined;

  return {
    data,
    isLoading: priority.isLoading,
    isFetching: priority.isFetching || deferred.isFetching,
    isError: priority.isError || deferred.isError,
    refetch: () => Promise.all([priority.refetch(), deferred.refetch()]),
  };
}

export type CatalogSection = Record<string, TMDBMovie[]>;
