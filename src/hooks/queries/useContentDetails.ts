import { useQuery, QueryClient } from "@tanstack/react-query";
import { localeQueryKey, type Locale } from "@/i18n/config";
import { useLocale } from "@/hooks/useLocale";
import { fetchContentDetails } from "@/utils/tmdbApi";

export const CONTENT_DETAILS_STALE_TIME = 15 * 60 * 1000;

export function contentDetailsKey(contentId: number, mediaType?: "movie" | "tv", locale?: Locale) {
  return localeQueryKey(["content-details", contentId, mediaType ?? "auto"], locale);
}

export function useContentDetails(contentId: number, mediaType?: "movie" | "tv") {
  const locale = useLocale();
  return useQuery({
    queryKey: contentDetailsKey(contentId, mediaType, locale),
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
