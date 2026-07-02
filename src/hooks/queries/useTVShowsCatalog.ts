import { useQuery } from "@tanstack/react-query";
import {
  fetchTrendingTVShows,
  fetchPopularTVShows,
  fetchTopRatedTVShows,
  fetchAiringTodayTVShows,
  fetchOnTheAirTVShows,
  fetchActionTVShows,
  fetchComedyTVShows,
  fetchDramaTVShows,
  fetchSciFiTVShows,
  fetchCrimeTVShows,
  fetchDocumentaryTVShows,
  TMDBMovie,
} from "@/utils/tmdbApi";

export const TV_SHOWS_CATALOG_KEY = ["tv-shows-catalog"] as const;

const SECTIONS = [
  { id: "trending", fetch: fetchTrendingTVShows },
  { id: "popular", fetch: fetchPopularTVShows },
  { id: "topRated", fetch: fetchTopRatedTVShows },
  { id: "airingToday", fetch: fetchAiringTodayTVShows },
  { id: "onTheAir", fetch: fetchOnTheAirTVShows },
  { id: "action", fetch: fetchActionTVShows },
  { id: "comedy", fetch: fetchComedyTVShows },
  { id: "drama", fetch: fetchDramaTVShows },
  { id: "sciFi", fetch: fetchSciFiTVShows },
  { id: "crime", fetch: fetchCrimeTVShows },
  { id: "documentary", fetch: fetchDocumentaryTVShows },
] as const;

async function loadTVShowsCatalog(): Promise<Record<string, TMDBMovie[]>> {
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

export function useTVShowsCatalog() {
  return useQuery({
    queryKey: TV_SHOWS_CATALOG_KEY,
    queryFn: loadTVShowsCatalog,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
