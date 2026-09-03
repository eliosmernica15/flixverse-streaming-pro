/**
 * User movie list backed by the Python Postgres API.
 * Used when the Python backend is enabled (Vercel / explicit override).
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { pythonFetch } from "@/lib/pythonApi/client";
import { isPythonBackendEnabled, useHttpTransport } from "@/lib/pythonApi/config";
import { UserMovieListItem } from "@/integrations/firebase/types";
import { trackListAdd, trackListRemove } from "@/lib/analytics";
import { TMDBMovie } from "@/utils/tmdbApi";

const POLL_MS = 10000;

export function usePythonUserMovieList() {
  const [movieList, setMovieList] = useState<UserMovieListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [operatingMovies, setOperatingMovies] = useState<Set<number>>(new Set());
  const { user, isAuthenticated } = useAuth();

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const data = await pythonFetch<{ items: UserMovieListItem[] }>(
        "/content/user-movie-list?limit=500"
      );
      setMovieList(data.items || []);
    } catch (err) {
      console.error("[user-movie-list/python] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !isPythonBackendEnabled()) {
      setMovieList([]);
      setLoading(false);
      return;
    }
    void refresh();
    if (useHttpTransport()) {
      const poll = setInterval(() => void refresh(), POLL_MS);
      const onVisible = () => {
        if (document.visibilityState === "visible") void refresh();
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        clearInterval(poll);
        document.removeEventListener("visibilitychange", onVisible);
      };
    }
  }, [user, isAuthenticated, refresh]);

  const addToList = useCallback(
    async (movie: TMDBMovie) => {
      if (!user) throw new Error("User must be logged in");
      if (operatingMovies.has(movie.id)) return;
      if (movieList.some((it) => it.movie_id === movie.id)) return;

      setOperatingMovies((prev) => new Set(prev).add(movie.id));
      const mediaType: "movie" | "tv" =
        movie.media_type === "tv" || movie.first_air_date ? "tv" : "movie";
      const optimistic: UserMovieListItem = {
        id: `temp-${movie.id}`,
        user_id: user.uid,
        movie_id: movie.id,
        movie_title: movie.title || movie.name || "Unknown Title",
        movie_poster_path: movie.poster_path,
        media_type: mediaType,
        added_at: new Date().toISOString(),
      };
      setMovieList((prev) => [optimistic, ...prev]);

      try {
        await pythonFetch("/content/user-movie-list", {
          method: "POST",
          body: JSON.stringify({
            movieId: movie.id,
            movieTitle: movie.title || movie.name || "Unknown Title",
            moviePosterPath: movie.poster_path,
            mediaType,
          }),
        });
        trackListAdd(movie.id, mediaType);
        void refresh();
      } catch (err) {
        setMovieList((prev) => prev.filter((it) => it.movie_id !== movie.id));
        console.error("[user-movie-list/python] add failed:", err);
        throw err;
      } finally {
        setOperatingMovies((prev) => {
          const next = new Set(prev);
          next.delete(movie.id);
          return next;
        });
      }
    },
    [user, movieList, operatingMovies, refresh]
  );

  const removeFromList = useCallback(
    async (movieId: number) => {
      if (!user) throw new Error("User must be logged in");
      if (operatingMovies.has(movieId)) return;
      const itemToRemove = movieList.find((it) => it.movie_id === movieId);
      if (!itemToRemove) return;

      setOperatingMovies((prev) => new Set(prev).add(movieId));
      const originalList = [...movieList];
      setMovieList((prev) => prev.filter((it) => it.movie_id !== movieId));
      try {
        await pythonFetch(`/content/user-movie-list/${encodeURIComponent(itemToRemove.id)}`, {
          method: "DELETE",
        });
        trackListRemove(movieId);
        void refresh();
      } catch (err) {
        setMovieList(originalList);
        console.error("[user-movie-list/python] remove failed:", err);
        throw err;
      } finally {
        setOperatingMovies((prev) => {
          const next = new Set(prev);
          next.delete(movieId);
          return next;
        });
      }
    },
    [user, movieList, operatingMovies, refresh]
  );

  const isInList = useCallback(
    (movieId: number) => movieList.some((it) => it.movie_id === movieId),
    [movieList]
  );
  const isOperating = useCallback(
    (movieId: number) => operatingMovies.has(movieId),
    [operatingMovies]
  );

  return {
    movieList,
    loading,
    addToList,
    removeFromList,
    isInList,
    isOperating,
    refetch: refresh,
  };
}
