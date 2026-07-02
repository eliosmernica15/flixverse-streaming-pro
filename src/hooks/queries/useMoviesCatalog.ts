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

const SECTIONS = [
  { id: "trending", fetch: fetchTrendingMovies },
  { id: "topRated", fetch: fetchTopRatedMovies },
  { id: "popular", fetch: fetchPopularMovies },
  { id: "upcoming", fetch: getUpcomingMoviesOnly },
  { id: "nowPlaying", fetch: fetchNowPlayingMovies },
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

async function loadMoviesCatalog(): Promise<Record<string, TMDBMovie[]>> {
  const results = await Promise.all(
    SECTIONS.map(async (section) => ({
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

export function useMoviesCatalog() {
  return useQuery({
    queryKey: MOVIES_CATALOG_KEY,
    queryFn: loadMoviesCatalog,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
