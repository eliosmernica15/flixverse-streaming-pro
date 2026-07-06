"use client";

import { useState, useCallback } from "react";
import { Shuffle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWatchHistoryContext } from "@/contexts/WatchHistoryContext";
import { useUserPreferencesContext } from "@/contexts/UserPreferencesContext";
import {
  fetchTrendingMovies,
  fetchPopularMovies,
  fetchTopRatedMovies,
  TMDBMovie,
} from "@/utils/tmdbApi";

/**
 * "Play Something" — picks a random title from trending/popular
 * weighted by the user's watch history and genre preferences.
 */
export function PlaySomething() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { history } = useWatchHistoryContext();
  const { preferences } = useUserPreferencesContext();
  const favoriteGenres = preferences.favoriteGenres || [];

  const pickRandom = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch a pool of candidates
      const [trending, popular, topRated] = await Promise.all([
        fetchTrendingMovies(),
        fetchPopularMovies(),
        fetchTopRatedMovies(),
      ]);

      const pool = [...new Map([...trending, ...popular, ...topRated].map((m) => [m.id, m])).values()]
        .filter((m) => m?.id && (m.title || m.name) && m.poster_path && m.vote_average > 5);

      if (pool.length === 0) {
        toast({ title: "No titles found", description: "Try again later.", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Weight by user preferences if available
      const watchedIds = new Set(history.map((h) => h.content_id));
      const genrePrefs = favoriteGenres || [];

      const scored = pool.map((m) => {
        let score = m.vote_average || 5;
        // Boost unwatched titles
        if (!watchedIds.has(m.id)) score += 2;
        // Boost matching genres
        if (m.genre_ids && genrePrefs.length > 0) {
          const matchCount = m.genre_ids.filter((g) => genrePrefs.includes(String(g))).length;
          score += matchCount * 1.5;
        }
        return { movie: m, score };
      });

      scored.sort((a, b) => b.score - a.score);

      // Pick from top 20 with slight randomness
      const top = scored.slice(0, 20);
      const pick = top[Math.floor(Math.random() * top.length)];

      const type = pick.movie.media_type || (pick.movie.first_air_date ? "tv" : "movie");
      router.push(`/movie/${pick.movie.id}?type=${type}&autoplay=true`);
    } catch {
      toast({ title: "Error", description: "Could not pick a title.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [history, favoriteGenres, router, toast]);

  return (
    <button
      onClick={pickRandom}
      disabled={loading}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Shuffle className="w-4 h-4" />
      )}
      Play Something
    </button>
  );
}
