import type { QueryClient } from "@tanstack/react-query";
import { localeQueryKey, getStoredLocale } from "@/i18n/config";
import { HOME_CONTENT_KEY, loadHomeContent } from "@/hooks/queries/useHomeContent";
import { MOVIES_CATALOG_KEY, loadMoviesCatalog } from "@/hooks/queries/useMoviesCatalog";
import { TV_SHOWS_CATALOG_KEY, loadTVShowsCatalog } from "@/hooks/queries/useTVShowsCatalog";
import { NEW_AND_POPULAR_KEY, loadNewAndPopular } from "@/hooks/queries/useNewAndPopularCatalog";
import { BROWSE_STALE_TIME, loadBrowseCategory } from "@/hooks/queries/useBrowseCategory";

const CATALOG_STALE_TIME = 10 * 60 * 1000;

function withLocale<T extends readonly unknown[]>(key: T) {
  return localeQueryKey(key, getStoredLocale());
}

const ROUTE_PREFETCHERS: Record<string, (queryClient: QueryClient) => void> = {
  "/": (queryClient) => {
    void queryClient.prefetchQuery({
      queryKey: withLocale(HOME_CONTENT_KEY),
      queryFn: loadHomeContent,
      staleTime: CATALOG_STALE_TIME,
    });
  },
  "/movies": (queryClient) => {
    void queryClient.prefetchQuery({
      queryKey: withLocale(MOVIES_CATALOG_KEY),
      queryFn: loadMoviesCatalog,
      staleTime: CATALOG_STALE_TIME,
    });
  },
  "/tv-shows": (queryClient) => {
    void queryClient.prefetchQuery({
      queryKey: withLocale(TV_SHOWS_CATALOG_KEY),
      queryFn: loadTVShowsCatalog,
      staleTime: CATALOG_STALE_TIME,
    });
  },
  "/new-and-popular": (queryClient) => {
    void queryClient.prefetchQuery({
      queryKey: withLocale(NEW_AND_POPULAR_KEY),
      queryFn: loadNewAndPopular,
      staleTime: CATALOG_STALE_TIME,
    });
  },
};

export function prefetchBrowseCategory(queryClient: QueryClient, category: string) {
  void queryClient.prefetchQuery({
    queryKey: withLocale(["browse", category]),
    queryFn: () => loadBrowseCategory(category),
    staleTime: BROWSE_STALE_TIME,
  });
}

export function prefetchRouteData(queryClient: QueryClient, path: string) {
  if (path.startsWith("/browse/")) {
    const category = path.slice("/browse/".length).split("/")[0];
    if (category) {
      prefetchBrowseCategory(queryClient, category);
    }
    return;
  }

  ROUTE_PREFETCHERS[path]?.(queryClient);
}
