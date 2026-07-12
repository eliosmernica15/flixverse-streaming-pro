"use client";

import { useState, useRef, useCallback, memo, useEffect } from "react";
import { Play, Star, Heart, Film, Tv, Plus, Loader2 } from "lucide-react";
import Image from "next/image";
import {
  getImageUrl,
  getPlaceholderImage,
  TMDBMovie,
  getContentTitle,
  getContentReleaseDate,
  getContentType,
} from "@/utils/tmdbApi";
import { useToast } from "@/hooks/use-toast";
import { useUserPreferencesContext } from "@/contexts/UserPreferencesContext";
import { useAuth } from "@/hooks/useAuth";
import { useUserMovieListContext } from "@/contexts/UserMovieListContext";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { prefetchContentDetails } from "@/hooks/queries/useContentDetails";

interface MovieCardProps {
  movie: TMDBMovie;
  index?: number;
  comingSoon?: boolean;
}

const genreNames: Record<number, string> = {
  28: "Action",
  35: "Comedy",
  18: "Drama",
  27: "Horror",
  10749: "Romance",
  878: "Sci-Fi",
  53: "Thriller",
  16: "Animation",
  14: "Fantasy",
  12: "Adventure",
  80: "Crime",
  99: "Documentary",
  10751: "Family",
  36: "History",
  10402: "Music",
  9648: "Mystery",
  10770: "TV Movie",
  37: "Western",
  10752: "War",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

const MovieCard = ({ movie, comingSoon = false }: MovieCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const t = useTranslations("movieCard");
  const tc = useTranslations("common");
  const { addToHistory, addFavoriteGenre } = useUserPreferencesContext();
  const { isAuthenticated } = useAuth();
  const [isInLocalList, setIsInLocalList] = useState(false);
  const { addToList, removeFromList, isInList, isOperating } = useUserMovieListContext();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) {
      try {
        const myList = JSON.parse(localStorage.getItem("myMovieList") || "[]");
        setIsInLocalList(myList.includes(movie.id));
      } catch {
        setIsInLocalList(false);
      }
    }
  }, [isAuthenticated, movie.id]);

  const isInMyList = isAuthenticated ? isInList(movie.id) : isInLocalList;
  const listBusy = isAuthenticated && isOperating(movie.id);

  const handleCardClick = useCallback(() => {
    addToHistory(movie.id);
    if (movie.genre_ids?.length) {
      movie.genre_ids.forEach((genreId) => {
        if (genreNames[genreId]) addFavoriteGenre(genreNames[genreId]);
      });
    }
    const contentType = getContentType(movie);
    router.push(`/movie/${movie.id}?type=${contentType}`);
  }, [addFavoriteGenre, addToHistory, movie, router]);

  const prefetchMovie = useCallback(() => {
    const contentType = getContentType(movie);
    router.prefetch(`/movie/${movie.id}?type=${contentType}`);
    prefetchContentDetails(queryClient, movie.id, contentType);
  }, [movie, router, queryClient]);

  const schedulePrefetch = useCallback(() => {
    if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
    prefetchTimerRef.current = setTimeout(prefetchMovie, 180);
  }, [prefetchMovie]);

  const cancelPrefetch = useCallback(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    cancelPrefetch();
  }, [cancelPrefetch]);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const contentType = getContentType(movie);
    router.push(`/movie/${movie.id}?type=${contentType}`);
  };

  const handleAddToListClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isAuthenticated) {
      toast({
        title: t("signInRequired"),
        description: t("signInForList"),
        variant: "destructive",
      });
      return;
    }

    const movieTitle = movie.title || movie.name || "Unknown";

    try {
      if (isInMyList) {
        await removeFromList(movie.id);
        toast({
          title: t("removedFromList"),
          description: t("removedDesc", { title: movieTitle }),
        });
      } else {
        await addToList(movie);
        toast({
          title: t("addedToList"),
          description: t("addedDesc", { title: movieTitle }),
        });
      }
    } catch (error: unknown) {
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t("somethingWrong"),
        variant: "destructive",
      });
    }
  };

  const displayTitle = getContentTitle(movie);
  const releaseDate = getContentReleaseDate(movie);
  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;
  const contentType = getContentType(movie);
  const posterUrl = movie.poster_path ? getImageUrl(movie.poster_path, "medium") : null;
  const rating = typeof movie.vote_average === "number" ? movie.vote_average : 0;
  const hasValidRating = rating > 0;
  const finalPosterUrl = !posterUrl || imageError ? getPlaceholderImage() : posterUrl;

  const primaryGenre =
    movie.genre_ids && movie.genre_ids.length > 0 ? genreNames[movie.genre_ids[0]] : null;

  const getRatingColor = (value: number) => {
    if (value >= 7.5) return "from-green-500 to-emerald-500";
    if (value >= 6) return "from-yellow-500 to-amber-500";
    return "from-red-500 to-orange-500";
  };

  return (
    <div
      ref={cardRef}
      className="group relative movie-card content-auto cursor-pointer rounded-2xl outline-none focus-ring"
      role="button"
      tabIndex={0}
      aria-label={`${displayTitle}${year ? ` (${year})` : ""}`}
      onMouseEnter={() => {
        setIsHovered(true);
        schedulePrefetch();
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        cancelPrefetch();
      }}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      <div className="relative overflow-hidden rounded-2xl bg-gray-900/50 movie-card-inner card-glow hover-lift-sm glow-border">
        <div
          className={`pointer-events-none absolute -inset-1 rounded-2xl blur-md bg-gradient-to-r from-red-600/25 to-purple-600/25 transition-opacity duration-300 ${isHovered ? "opacity-100" : "opacity-0"}`}
        />

        <div className="relative aspect-[2/3] overflow-hidden rounded-2xl">
          {!imageLoaded && <div className="absolute inset-0 skeleton-shimmer bg-gray-800/80" />}

          <Image
            src={finalPosterUrl}
            alt={displayTitle}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            className={`object-cover transition-transform duration-500 ease-out ${isHovered ? "scale-105" : "scale-100"}`}
            loading="lazy"
            decoding="async"
            onError={() => setImageError(true)}
            onLoad={() => setImageLoaded(true)}
          />

          <div
            className={`absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent transition-opacity duration-300 ${isHovered ? "opacity-95" : "opacity-55"}`}
          />

          <div className="absolute left-3 top-3 flex items-center space-x-1.5 rounded-md bg-white/10 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-md badge-shine">
            {contentType === "tv" ? <Tv className="h-3 w-3" /> : <Film className="h-3 w-3" />}
            <span>{contentType === "tv" ? tc("series").toUpperCase() : tc("movie").toUpperCase()}</span>
          </div>

          {hasValidRating && (
            <div
              className={`absolute right-3 top-3 flex items-center space-x-1 rounded-md bg-gradient-to-r px-2 py-1 text-[10px] font-black text-white shadow-lg badge-shine ${getRatingColor(rating)}`}
            >
              <Star className="h-3 w-3 fill-current" />
              <span>{rating.toFixed(1)}</span>
            </div>
          )}

          {movie.overview && (
            <p
              className={`pointer-events-none absolute inset-x-3 top-12 z-[5] line-clamp-3 text-[10px] leading-snug text-gray-200/90 transition-opacity duration-200 ${isHovered ? "opacity-100" : "opacity-0"}`}
            >
              {movie.overview}
            </p>
          )}

          <div
            className={`movie-card-actions absolute inset-x-0 bottom-0 z-10 p-4 transition-all duration-200 ${isHovered ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"} [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100`}
          >
            <h3 className="mb-1 line-clamp-1 text-base font-black text-white drop-shadow-md">
              {displayTitle}
            </h3>

            <div className="mb-3 flex items-center space-x-2">
              {year && <span className="text-xs font-medium text-gray-300">{year}</span>}
              {primaryGenre && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                  {primaryGenre}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {comingSoon ? (
                <div className="flex-1 border border-amber-500/30 bg-amber-500/20 py-2 text-center text-[10px] font-bold text-amber-400">
                  {tc("comingSoon").toUpperCase()}
                </div>
              ) : (
                <button
                  className="press-effect flex min-h-[44px] flex-1 items-center justify-center space-x-2 rounded-lg bg-white py-2 font-bold text-xs text-black transition-colors hover:bg-gray-100 focus-ring"
                  onClick={handlePlayClick}
                >
                  <Play className="h-3 w-3 fill-current" />
                  <span>{tc("play").toUpperCase()}</span>
                </button>
              )}

              <button
                type="button"
                className={`press-effect flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors focus-ring ${isInMyList ? "bg-red-500 text-white" : "glass-card text-white"} ${listBusy ? "opacity-70" : ""}`}
                onClick={handleAddToListClick}
                disabled={listBusy}
                aria-label={isInMyList ? tc("removeFromList") : tc("addToList")}
              >
                {listBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isInMyList ? (
                  <Heart className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
              </button>

              <button
                type="button"
                className="press-effect flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg glass-card text-white transition-colors hover:bg-white/20 focus-ring"
                onClick={handleCardClick}
                aria-label={`More about ${displayTitle}`}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`mt-2 transition-opacity duration-200 ${isHovered ? "opacity-0" : "opacity-100"}`}>
        <p className="text-white text-xs font-bold truncate">{displayTitle}</p>
        <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter mt-0.5">
          {year ? `${year} • ` : ""}{hasValidRating ? `${rating.toFixed(1)} ${tc("rating")}` : tc("new")}
        </p>
      </div>
    </div>
  );
};

export default memo(MovieCard);
