/**
 * Watch history backed by the Python Postgres API.
 * Falls back to a no-op when the Python backend is not enabled.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { pythonFetch } from "@/lib/pythonApi/client";
import { isPythonBackendEnabled, useHttpTransport } from "@/lib/pythonApi/config";
import { WatchHistory } from "@/integrations/firebase/types";

type WatchHistoryItem = WatchHistory & { id: string };

const POLL_MS = 8000;

export function usePythonWatchHistory() {
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const data = await pythonFetch<{ items: WatchHistoryItem[] }>(
        "/content/watch-history?limit=100"
      );
      setHistory(data.items || []);
    } catch (err) {
      console.error("[watch-history/python] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !isPythonBackendEnabled()) {
      setHistory([]);
      setLoading(false);
      return;
    }
    void refresh();
    if (useHttpTransport()) {
      pollRef.current = setInterval(() => void refresh(), POLL_MS);
      const onVisible = () => {
        if (document.visibilityState === "visible") void refresh();
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
        document.removeEventListener("visibilitychange", onVisible);
      };
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user, isAuthenticated, refresh]);

  const updateProgress = useCallback(
    async (
      contentId: number,
      contentType: "movie" | "tv",
      contentTitle: string,
      contentPosterPath: string | null,
      progressSeconds: number,
      totalDurationSeconds: number,
      season?: number,
      episode?: number
    ) => {
      if (!user) throw new Error("User must be logged in");
      const historyId =
        contentType === "tv" && season && episode
          ? `${user.uid}_${contentId}_s${season}e${episode}`
          : `${user.uid}_${contentId}`;
      const completed = progressSeconds >= totalDurationSeconds * 0.9;
      try {
        await pythonFetch("/content/watch-history", {
          method: "POST",
          body: JSON.stringify({
            historyId,
            contentId,
            contentType,
            contentTitle,
            contentPosterPath,
            progressSeconds,
            totalDurationSeconds,
            season: season ?? null,
            episode: episode ?? null,
            completed,
          }),
        });
        void refresh();
      } catch (err) {
        console.error("[watch-history/python] upsert failed:", err);
        throw err;
      }
    },
    [user, refresh]
  );

  const getProgress = useCallback(
    (contentId: number, season?: number, episode?: number): WatchHistoryItem | undefined => {
      if (season && episode) {
        return history.find(
          (h) => h.content_id === contentId && h.season === season && h.episode === episode
        );
      }
      return history.find((h) => h.content_id === contentId && !h.season);
    },
    [history]
  );

  const removeFromHistory = useCallback(
    async (historyId: string) => {
      try {
        // We don't expose a single-row DELETE on the Python side yet;
        // a no-op keeps the local state in sync until ETL replaces this.
        setHistory((prev) => prev.filter((h) => h.id !== historyId));
      } catch (err) {
        console.error("[watch-history/python] remove failed:", err);
      }
    },
    []
  );

  const clearHistory = useCallback(async () => {
    setHistory((prev) => {
      void prev; // unused
      return [];
    });
    return { success: 0, failed: 0 };
  }, []);

  const getContinueWatching = useCallback(
    () =>
      history.filter(
        (h) =>
          !h.completed &&
          h.progress_seconds > 60 &&
          h.total_duration_seconds != null &&
          h.total_duration_seconds > 0
      ),
    [history]
  );

  const getRecentlyWatched = useCallback(
    () => history.filter((h) => h.completed).slice(0, 20),
    [history]
  );

  return {
    history,
    loading,
    updateProgress,
    getProgress,
    removeFromHistory,
    clearHistory,
    getContinueWatching,
    getRecentlyWatched,
  };
}
