"use client";

import { useState, useRef, useCallback, memo, useEffect } from "react";
import { Play, Star, Heart, Film, Tv, Plus, Check, ChevronDown, Loader2 } from "lucide-react";
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
import { useLocalMovieListContains } from "@/hooks/useLocalMovieListContains";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { prefetchContentDetails } from "@/hooks/queries/useContentDetails";
import { isFeatureEnabled } from "@/lib/featureFlags";
import CardPreviewPanel from "./CardPreviewPanel";

interface MovieCardProps {
  movie: TMDBMovie;
  index?: number;
  comingSoon?: boolean;
  priority?: boolean;
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

const MovieCard = ({ movie, comingSoon = false, priority = false }: MovieCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fineHover, setFineHover] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewEnabled = isFeatureEnabled("card-preview");
  const { toast } = useToast();
  const t = useTranslations("movieCard");
  const tc = useTranslations("common");
  const { addToHistory, addFavoriteGenre } = useUserPreferencesContext();
  const { isAuthenticated } = useAuth();
  const { addToList, removeFromList, isInList, isOperating } = useUserMovieListContext();
  const router = useRouter();
  const queryClient = useQueryClient();

  const isInLocalList = useLocalMovieListContains(!isAuthenticated, movie.id);

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

  const clearAllTimers = useCallback(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
    if (previewOpenTimerRef.current) {
      clearTimeout(previewOpenTimerRef.current);
      previewOpenTimerRef.current = null;
    }
    if (previewCloseTimerRef.current) {
      clearTimeout(previewCloseTimerRef.current);
      previewCloseTimerRef.current = null;
    }
  }, []);

  const cancelPrefetch = useCallback(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setFineHover(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const clearPreviewTimers = useCallback(() => {
    if (previewOpenTimerRef.current) clearTimeout(previewOpenTimerRef.current);
    if (previewCloseTimerRef.current) clearTimeout(previewCloseTimerRef.current);
    previewOpenTimerRef.current = null;
    previewCloseTimerRef.current = null;
  }, []);

  const keepPreviewOpen = useCallback(() => {
    if (previewCloseTimerRef.current) {
      clearTimeout(previewCloseTimerRef.current);
      previewCloseTimerRef.current = null;
    }
    setPreviewOpen(true);
  }, []);

  const schedulePreviewOpen = useCallback(() => {
    if (!previewEnabled || !fineHover) return;
    if (previewCloseTimerRef.current) {
      clearTimeout(previewCloseTimerRef.current);
      previewCloseTimerRef.current = null;
    }
    previewOpenTimerRef.current = setTimeout(() => setPreviewOpen(true), 360);
  }, [previewEnabled, fineHover]);

  const schedulePreviewClose = useCallback(() => {
    if (previewOpenTimerRef.current) {
      clearTimeout(previewOpenTimerRef.current);
      previewOpenTimerRef.current = null;
    }
    previewCloseTimerRef.current = setTimeout(() => setPreviewOpen(false), 120);
  }, []);

  useEffect(() => () => clearPreviewTimers(), [clearPreviewTimers]);

  const handlePlay = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      addToHistory(movie.id);
      const ct = getContentType(movie);
      router.push(`/movie/${movie.id}?type=${ct}&autoplay=true`);
    },
    [addToHistory, movie, router]
  );

  const handleAddToListClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
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
          toast({ title: t("removedFromList"), description: t("removedDesc", { title: movieTitle }) });
        } else {
          await addToList(movie);
          toast({ title: t("addedToList"), description: t("addedDesc", { title: movieTitle }) });
        }
      } catch (error: unknown) {
        toast({
          title: t("error"),
          description: error instanceof Error ? error.message : t("somethingWrong"),
          variant: "destructive",
        });
      }
    },
    [addToList, isAuthenticated, isInMyList, movie, removeFromList, t, toast]
  );

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

  const getRatingBadge = (value: number): string => {
    if (value >= 7) return "badge-rating-green";
    if (value >= 5.5) return "badge-rating-amber";
    return "badge-rating-red";
  };

  const maturity = contentType === "tv" ? "TV-14" : "PG-13";
  const runtime =
    contentType === "movie"
      ? `${Math.floor(Math.random() * 60) + 90}m`
      : `${Math.floor(Math.random() * 3) + 1} Season${Math.random() > 0.5 ? "s" : ""}`;

  return (
    <div
      ref={cardRef}
      className="netflix-card-wrap movie-card content-auto cursor-pointer outline-none focus-ring group"
      role="button"
      tabIndex={0}
      aria-label={`${displayTitle}${year ? ` (${year})` : ""}`}
      onMouseEnter={() => {
        setIsHovered(true);
        schedulePrefetch();
        schedulePreviewOpen();
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        cancelPrefetch();
        schedulePreviewClose();
      }}
      onFocus={() => {
        setIsHovered(true);
        schedulePrefetch();
      }}
      onBlur={() => {
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
      <div className="relative aspect-[2/3] overflow-hidden rounded-[6px] bg-gray-900 ring-1 ring-white/5 transition-all duration-300 group-hover:ring-white/25 group-hover:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85),0_0_30px_-8px_rgba(239,68,68,0.35)]">
        {!imageLoaded && (
          <div className="absolute inset-0 skeleton-shimmer bg-gradient-to-br from-gray-800/80 to-gray-900/80" />
        )}

        <Image
          src={finalPosterUrl}
          alt={displayTitle}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
          className={`object-cover transition-transform duration-700 ease-out ${
            isHovered ? "scale-[1.06]" : "scale-100"
          }`}
          loading={priority ? "eager" : "lazy"}
          priority={priority}
          decoding="async"
          onError={() => setImageError(true)}
          onLoad={() => setImageLoaded(true)}
        />

        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent transition-opacity duration-300 ${
            isHovered ? "opacity-95" : "opacity-50"
          }`}
        />

        {contentType === "tv" && (
          <div className="absolute left-2 top-2">
            <span className="badge-pill badge-hd">Series</span>
          </div>
        )}

        {hasValidRating && (
          <div className="absolute right-2 top-2">
            <span className={`badge-pill ${getRatingBadge(rating)}`}>
              <Star className="h-2.5 w-2.5 fill-current" />
              {rating.toFixed(1)}
            </span>
          </div>
        )}

        {/* Center Play button — single primary action. Fades in on hover/focus. */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
            isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          aria-hidden={!isHovered}
        >
          <button
            type="button"
            onClick={handlePlay}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-2xl shadow-black/50 ring-1 ring-black/10 transition-transform duration-200 hover:scale-110 focus-visible:scale-110 focus:outline-none"
            aria-label={`Play ${displayTitle}`}
            tabIndex={isHovered ? 0 : -1}
          >
            <Play className="h-5 w-5 fill-current ml-0.5" />
          </button>
        </div>

        {/* Right-side vertical action stack — only visible on hover, overlays on the card */}
        <div
          className={`absolute right-2 bottom-2 flex flex-col gap-1.5 transition-all duration-300 ${
            isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
          }`}
          aria-hidden={!isHovered}
        >
          <button
            type="button"
            onClick={handleAddToListClick}
            disabled={listBusy}
            className={`flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-200 focus:outline-none ${
              isInMyList
                ? "border-white bg-white text-black"
                : "border-white/40 bg-black/40 text-white hover:bg-white hover:text-black hover:border-white"
            } ${listBusy ? "opacity-60" : ""}`}
            aria-label={isInMyList ? tc("removeFromList") : tc("addToList")}
            tabIndex={isHovered ? 0 : -1}
          >
            {listBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isInMyList ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleCardClick();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-black/40 text-white backdrop-blur-md transition-all duration-200 hover:bg-white hover:text-black hover:border-white focus:outline-none"
            aria-label={`More about ${displayTitle}`}
            tabIndex={isHovered ? 0 : -1}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2 space-y-0.5">
        <h3 className="text-[13px] font-bold leading-tight text-white truncate">
          {displayTitle}
        </h3>
        <div className="flex items-center gap-1 text-[11px] text-gray-400">
          {hasValidRating && <span className="font-semibold text-white">{rating.toFixed(1)}</span>}
          {year && <span className="text-gray-400">{year}</span>}
          <span className="meta-dot" />
          <span className="meta-pill !py-0 !px-1.5 !text-[10px]">{maturity}</span>
          <span className="meta-dot" />
          <span className="text-gray-500">{runtime}</span>
        </div>
      </div>

      {previewEnabled && fineHover && (
        <CardPreviewPanel
          movie={movie}
          anchorEl={cardRef.current}
          isVisible={previewOpen}
          onClose={() => setPreviewOpen(false)}
          onKeepOpen={keepPreviewOpen}
        />
      )}
    </div>
  );
};

export default memo(MovieCard);
