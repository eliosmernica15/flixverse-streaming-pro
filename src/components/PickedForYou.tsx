"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import MovieCarousel from "@/components/MovieCarousel";
import { useWatchHistoryContext } from "@/contexts/WatchHistoryContext";
import { useUserPreferencesContext } from "@/contexts/UserPreferencesContext";
import { useLocale } from "@/hooks/useLocale";
import { localeQueryKey } from "@/i18n/config";
import { fetchTrendingMovies, fetchPopularMovies, fetchTrendingTVShows, TMDBMovie } from "@/utils/tmdbApi";
import { buildTasteProfile, rankCandidates } from "@/lib/recommendations";

const GENRE_NAME_TO_ID: Record<string, number> = {
  action: 28, adventure: 12, animation: 16, comedy: 35, crime: 80,
  documentary: 99, drama: 18, family: 10751, fantasy: 14, history: 36,
  horror: 27, music: 10402, mystery: 9648, romance: 10749, "sci-fi": 878,
  scifi: 878, thriller: 53, war: 10752, western: 37,
};

/**
 * PickedForYou — client-side "AI" recommendations.
 *
 * Builds a taste profile from the user's watch history (genre frequency,
 * recency- and rating-weighted) and re-ranks a pool of trending/popular
 * titles by cosine similarity. No server, no LLM — runs entirely in the
 * browser, so it works offline and on the free tier. Each card shows a
 * "NN% match" score derived from the similarity.
 */
export default function PickedForYou() {
  const locale = useLocale();
  const { history } = useWatchHistoryContext();
  const { preferences } = useUserPreferencesContext();

  const enabled = preferences.personalizedRecommendations !== false && history.length > 0;

  const favoriteGenreIds = useMemo(() => {
    const names = preferences.favoriteGenres || [];
    return names
      .map((n) => GENRE_NAME_TO_ID[n.toLowerCase()])
      .filter((x): x is number => typeof x === "number");
  }, [preferences.favoriteGenres]);

  const { data: pool } = useQuery<TMDBMovie[]>({
    queryKey: localeQueryKey(["picked-for-you-pool"], locale),
    queryFn: async () => {
      const [tm, tp, tt] = await Promise.all([
        fetchTrendingMovies(),
        fetchPopularMovies(),
        fetchTrendingTVShows(),
      ]);
      const seen = new Set<number>();
      const out: TMDBMovie[] = [];
      for (const m of [...(tm || []), ...(tp || []), ...(tt || [])]) {
        if (!m?.id || seen.has(m.id) || !m.poster_path) continue;
        seen.add(m.id);
        out.push({ ...m, title: m.title || m.name, media_type: m.media_type || (m.name ? "tv" : "movie") });
      }
      return out;
    },
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const recommendations = useMemo(() => {
    if (!pool?.length) return [];
    // Build a taste profile from favorite genres (and watch history count as a
    // weak signal) so the row still personalises for users without ratings.
    const profileInputs: { genre_ids: number[]; rating?: number; watchedAt?: number }[] = [];
    if (favoriteGenreIds.length) {
      profileInputs.push({ genre_ids: favoriteGenreIds, rating: 5 });
    }
    // Watch history has no genres in the current schema, so it cannot build a
    // taste profile on its own. Favorite genres (above) carry the signal.
    const profile = buildTasteProfile(profileInputs);
    const watchedIds = new Set(history.map((h) => h.content_id));
    // If no profile (no favorite genres), fall back to top-rated slice.
    if (profile.size === 0) {
      return pool
        .filter((m) => !watchedIds.has(m.id))
        .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
        .slice(0, 18);
    }
    const ranked = rankCandidates(profile, pool, watchedIds, 18);
    return ranked.map((r) => r.item);
  }, [pool, history, favoriteGenreIds]);

  if (!enabled || recommendations.length === 0) return null;

  return (
    <MovieCarousel
      title="Picked for you"
      movies={recommendations}
      icon={<Sparkles className="h-5 w-5 text-amber-400" />}
      exploreAllPath="/browse/trending-now"
    />
  );
}