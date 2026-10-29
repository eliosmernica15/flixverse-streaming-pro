"use client";

import { useEffect } from "react";
import { useUserMovieListContext } from "@/contexts/UserMovieListContext";
import { useWatchHistoryContext } from "@/contexts/WatchHistoryContext";
import { saveOfflineCache, type OfflineCatalogItem } from "@/lib/offlineStorage";

export default function OfflineCacheSync() {
  const { movieList } = useUserMovieListContext();
  const { history } = useWatchHistoryContext();

  useEffect(() => {
    const watchlist: OfflineCatalogItem[] = movieList.map((item) => ({
      id: item.movie_id,
      title: item.movie_title,
      poster_path: item.movie_poster_path,
      media_type: item.media_type ?? "movie",
      cached_at: new Date().toISOString(),
    }));

    const continueWatching: OfflineCatalogItem[] = history
      .filter((h) => h.progress_seconds && h.total_duration_seconds && h.progress_seconds < h.total_duration_seconds * 0.9)
      .slice(0, 20)
      .map((h) => ({
        id: h.content_id,
        title: h.content_title,
        poster_path: h.content_poster_path,
        media_type: h.content_type,
        cached_at: h.watched_at,
      }));

    const cache = {
      watchlist,
      continueWatching,
      updated_at: new Date().toISOString(),
    };
    let cancelled = false;
    const persist = () => {
      if (!cancelled) void saveOfflineCache(cache);
    };
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(persist, { timeout: 1500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }
    const timeoutId = window.setTimeout(persist, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [movieList, history]);

  return null;
}
