import { useQuery, QueryClient } from "@tanstack/react-query";
import { fetchContentDetails } from "@/utils/tmdbApi";

export const CONTENT_DETAILS_STALE_TIME = 15 * 60 * 1000;

export function contentDetailsKey(contentId: number, mediaType?: "movie" | "tv") {
  return ["content-details", contentId, mediaType ?? "auto"] as const;
}

export function useContentDetails(contentId: number, mediaType?: "movie" | "tv") {
  return useQuery({
    queryKey: contentDetailsKey(contentId, mediaType),
    queryFn: () => fetchContentDetails(contentId, mediaType),
    staleTime: CONTENT_DETAILS_STALE_TIME,
    gcTime: 60 * 60 * 1000,
  });
}

export function prefetchContentDetails(
  queryClient: QueryClient,
  contentId: number,
  mediaType?: "movie" | "tv"
) {
  void queryClient.prefetchQuery({
    queryKey: contentDetailsKey(contentId, mediaType),
    queryFn: () => fetchContentDetails(contentId, mediaType),
    staleTime: CONTENT_DETAILS_STALE_TIME,
  });
}
