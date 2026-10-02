import { useQuery } from "@tanstack/react-query";
import { localeQueryKey } from "@/i18n/config";
import { useLocale } from "@/hooks/useLocale";
import { getUpcomingMoviesOnly } from "@/utils/popularMoviesRotator";
import {
  fetchTrendingMovies,
  fetchPopularMovies,
  fetchNowPlayingMovies,
  fetchTrendingTVShows,
  fetchAiringTodayTVShows,
  fetchOnTheAirTVShows,
  TMDBMovie,
} from "@/utils/tmdbApi";

export const NEW_AND_POPULAR_KEY = ["new-and-popular"] as const;

export async function loadNewAndPopular() {
  const [
    trending,
    popular,
    trulyUpcoming,
    trendingTV,
    nowPlayingMovies,
    airingTodayShows,
    onTheAirShows,
  ] = await Promise.all([
    fetchTrendingMovies(),
    fetchPopularMovies(),
    getUpcomingMoviesOnly(),
    fetchTrendingTVShows(),
    fetchNowPlayingMovies(),
    fetchAiringTodayTVShows(),
    fetchOnTheAirTVShows(),
  ]);

  const newReleases = [...trending]
    .filter((movie) => movie?.id && (movie.title || movie.name))
    .sort((a, b) => {
      const dateA = new Date(b.release_date || b.first_air_date || "").getTime();
      const dateB = new Date(a.release_date || a.first_air_date || "").getTime();
      return dateA - dateB;
    });

  const filterValid = (items: TMDBMovie[]) => items.filter((item) => item?.id);

  return {
    newReleases,
    popularContent: filterValid(popular),
    upcomingMovies: filterValid(trulyUpcoming),
    trendingShows: filterValid(trendingTV),
    nowPlaying: filterValid(nowPlayingMovies),
    airingToday: filterValid(airingTodayShows),
    onTheAir: filterValid(onTheAirShows),
  };
}

export function useNewAndPopularCatalog() {
  const locale = useLocale();
  return useQuery({
    queryKey: localeQueryKey(NEW_AND_POPULAR_KEY, locale),
    queryFn: loadNewAndPopular,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
