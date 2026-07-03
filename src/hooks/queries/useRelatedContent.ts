import { useQuery } from "@tanstack/react-query";
import {
  TMDBMovie,
  fetchSimilarTVShows,
  fetchTVShowRecommendations,
} from "@/utils/tmdbApi";
import { getSimilarMoviesForMovie } from "@/utils/movieSimilarity";

async function loadRelatedContent(
  content: TMDBMovie,
  mediaType?: "movie" | "tv"
): Promise<TMDBMovie[]> {
  const isTV = content.media_type === "tv" || mediaType === "tv";
  const id = content.id;

  if (isTV) {
    const [similar, recs] = await Promise.all([
      fetchSimilarTVShows(id),
      fetchTVShowRecommendations(id),
    ]);
    const combined = [...(similar || []), ...(recs || [])]
      .filter((m) => m && m.id && m.id !== id)
      .map((m) => ({ ...m, media_type: "tv" as const }));
    const seen = new Set<number>();
    return combined
      .filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      })
      .slice(0, 4);
  }

  return getSimilarMoviesForMovie(content, { maxResults: 4 });
}

export function useRelatedContent(content: TMDBMovie | null, mediaType?: "movie" | "tv") {
  const contentId = content?.id;
  const type = content?.media_type === "tv" || mediaType === "tv" ? "tv" : "movie";

  return useQuery({
    queryKey: ["related-content", contentId, type],
    queryFn: () => loadRelatedContent(content!, mediaType),
    enabled: Boolean(contentId),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
