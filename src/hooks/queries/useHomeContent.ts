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

async function loadHomeContent() {
  const [
    heroMovie,
    trendingMovies,
    topRatedMovies,
    popularMovies,
    trendingTVShows,
    popularTVShows,
    nowPlayingMovies,
    upcomingMoviesRaw,
    upcomingTVRaw,
  ] = await Promise.all([
    getHeroMovieOfTheWeek(),
    fetchTrendingMovies(),
    fetchTopRatedMovies(),
    fetchPopularMovies(),
    fetchTrendingTVShows(),
    fetchPopularTVShows(),
    fetchNowPlayingMovies(),
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

  const hero =
    heroMovie && !Array.isArray(heroMovie) ? heroMovie : trendingMovies?.[0] ?? null;

  return {
    hero,
    trendingMovies: trendingMovies || [],
    topRatedMovies: topRatedMovies || [],
    popularMovies: popularMovies || [],
    trendingTVShows: trendingTVShows || [],
    popularTVShows: popularTVShows || [],
    nowPlayingMovies: nowPlayingMovies || [],
    comingSoon,
  };
}

export type HomeContent = Awaited<ReturnType<typeof loadHomeContent>>;

export function useHomeContent() {
  return useQuery({
    queryKey: HOME_CONTENT_KEY,
    queryFn: loadHomeContent,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export type CatalogSection = Record<string, TMDBMovie[]>;
