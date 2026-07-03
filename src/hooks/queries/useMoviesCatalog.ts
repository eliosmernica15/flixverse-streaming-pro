import { useQuery } from "@tanstack/react-query";
import { getUpcomingMoviesOnly } from "@/utils/popularMoviesRotator";
import {
  fetchTrendingMovies,
  fetchTopRatedMovies,
  fetchPopularMovies,
  fetchNowPlayingMovies,
  fetchActionMovies,
  fetchComedyMovies,
  fetchHorrorMovies,
  fetchRomanceMovies,
  fetchSciFiMovies,
  fetchDramaMovies,
  fetchThrillerMovies,
  fetchAnimationMovies,
  fetchFantasyMovies,
  fetchAdventureMovies,
  TMDBMovie,
} from "@/utils/tmdbApi";

export const MOVIES_CATALOG_KEY = ["movies-catalog"] as const;
export const MOVIES_PRIORITY_KEY = ["movies-catalog", "priority"] as const;
export const MOVIES_DEFERRED_KEY = ["movies-catalog", "deferred"] as const;

const STALE = 10 * 60 * 1000;
const GC = 30 * 60 * 1000;

const PRIORITY_SECTIONS = [
  { id: "trending", fetch: fetchTrendingMovies },
  { id: "nowPlaying", fetch: fetchNowPlayingMovies },
  { id: "topRated", fetch: fetchTopRatedMovies },
  { id: "popular", fetch: fetchPopularMovies },
] as const;

const DEFERRED_SECTIONS = [
  { id: "upcoming", fetch: getUpcomingMoviesOnly },
  { id: "action", fetch: fetchActionMovies },
  { id: "comedy", fetch: fetchComedyMovies },
  { id: "horror", fetch: fetchHorrorMovies },
  { id: "romance", fetch: fetchRomanceMovies },
  { id: "sciFi", fetch: fetchSciFiMovies },
  { id: "drama", fetch: fetchDramaMovies },
  { id: "thriller", fetch: fetchThrillerMovies },
  { id: "animation", fetch: fetchAnimationMovies },
  { id: "fantasy", fetch: fetchFantasyMovies },
  { id: "adventure", fetch: fetchAdventureMovies },
] as const;

async function loadSections(
  sections: readonly { id: string; fetch: () => Promise<TMDBMovie[]> }[]
): Promise<Record<string, TMDBMovie[]>> {
  const results = await Promise.all(
    sections.map(async (section) => ({
      id: section.id,
      data: await section.fetch(),
    }))
  );

  const catalog: Record<string, TMDBMovie[]> = {};
  results.forEach(({ id, data }) => {
    if (data?.length) catalog[id] = data;
  });
  return catalog;
}

/** Full load for route prefetch. */
export async function loadMoviesCatalog(): Promise<Record<string, TMDBMovie[]>> {
  const [priority, deferred] = await Promise.all([
    loadSections(PRIORITY_SECTIONS),
    loadSections(DEFERRED_SECTIONS),
  ]);
  return { ...priority, ...deferred };
}

export function useMoviesCatalog() {
  const priority = useQuery({
    queryKey: MOVIES_PRIORITY_KEY,
    queryFn: () => loadSections(PRIORITY_SECTIONS),
    staleTime: STALE,
    gcTime: GC,
  });

  const deferred = useQuery({
    queryKey: MOVIES_DEFERRED_KEY,
    queryFn: () => loadSections(DEFERRED_SECTIONS),
    enabled: priority.isSuccess,
    staleTime: STALE,
    gcTime: GC,
  });

  const data = { ...(priority.data ?? {}), ...(deferred.data ?? {}) };

  return {
    data,
    isLoading: priority.isLoading,
    isFetching: priority.isFetching || deferred.isFetching,
    isError: priority.isError || deferred.isError,
    refetch: () => Promise.all([priority.refetch(), deferred.refetch()]),
  };
}
