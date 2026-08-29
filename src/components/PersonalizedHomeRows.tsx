"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Heart } from "lucide-react";
import MovieCarousel from "@/components/MovieCarousel";
import { useWatchHistoryContext } from "@/contexts/WatchHistoryContext";
import { useUserPreferencesContext } from "@/contexts/UserPreferencesContext";
import { useLocale } from "@/hooks/useLocale";
import { localeQueryKey } from "@/i18n/config";
import { fetchSimilarMovies, fetchSimilarTVShows, TMDBMovie } from "@/utils/tmdbApi";
import { BROWSE_CATEGORIES, FAVORITE_GENRE_BROWSE } from "@/utils/browseCategories";
import { useTranslations } from "next-intl";

async function loadSimilarForWatch(id: number, type: "movie" | "tv"): Promise<TMDBMovie[]> {
  const results = type === "tv" ? await fetchSimilarTVShows(id) : await fetchSimilarMovies(id);
  return (results || [])
    .filter((m) => m?.id && m.id !== id && (m.title || m.name) && m.poster_path)
    .slice(0, 18)
    .map((m) => ({
      ...m,
      title: m.title || m.name,
      media_type: type,
    }));
}

export default function PersonalizedHomeRows() {
  const t = useTranslations("carousel");
  const locale = useLocale();
  const { history } = useWatchHistoryContext();
  const { preferences } = useUserPreferencesContext();

  const seed = useMemo(() => {
    if (history.length > 0) {
      const item = history[0];
      return {
        id: item.content_id,
        type: item.content_type,
        title: item.content_title,
      };
    }
    const localId = preferences.viewHistory?.[0];
    if (localId) {
      return { id: localId, type: "movie" as const, title: "" };
    }
    return null;
  }, [history, preferences.viewHistory]);

  const favoriteGenre = useMemo(() => {
    const names = preferences.favoriteGenres || [];
    for (let i = names.length - 1; i >= 0; i--) {
      const slug = FAVORITE_GENRE_BROWSE[names[i]];
      if (slug && BROWSE_CATEGORIES[slug]) {
        return { name: names[i], slug };
      }
    }
    return null;
  }, [preferences.favoriteGenres]);

  const enabled = preferences.personalizedRecommendations !== false;

  const similarQuery = useQuery({
    queryKey: localeQueryKey(["because-watched", seed?.id, seed?.type], locale),
    queryFn: () => loadSimilarForWatch(seed!.id, seed!.type),
    enabled: enabled && Boolean(seed?.id),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const genreQuery = useQuery({
    queryKey: localeQueryKey(["because-genre", favoriteGenre?.slug], locale),
    queryFn: () => BROWSE_CATEGORIES[favoriteGenre!.slug].fetch(),
    enabled: enabled && Boolean(favoriteGenre?.slug),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  if (!enabled) return null;

  const similar = similarQuery.data || [];
  const genreMovies = (genreQuery.data || []).filter((m) => m.id !== seed?.id).slice(0, 18);

  return (
    <>
      {similar.length > 0 && (
        <MovieCarousel
          title={t("becauseYouWatched", { title: seed?.title || t("recentTitle") })}
          movies={similar}
          icon={<Sparkles className="h-5 w-5 text-amber-400" />}
        />
      )}
      {genreMovies.length > 0 && favoriteGenre && (
        <MovieCarousel
          title={t("becauseYouLike", { genre: favoriteGenre.name })}
          movies={genreMovies}
          icon={<Heart className="h-5 w-5 text-rose-400" />}
          exploreAllPath={`/browse/${favoriteGenre.slug}`}
        />
      )}
    </>
  );
}
