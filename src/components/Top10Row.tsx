"use client";

import { useState, memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Play, Plus, Check, ChevronDown, Loader2 } from "lucide-react";
import { TMDBMovie, getContentType, getContentTitle, getImageUrl, getPlaceholderImage } from "@/utils/tmdbApi";
import { useTranslations } from "next-intl";
import { useUserMovieListContext } from "@/contexts/UserMovieListContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useUserPreferencesContext } from "@/contexts/UserPreferencesContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface Top10RowProps {
  movies: TMDBMovie[];
  title?: string;
}

const MovieCardTop10 = memo(({ movie, rank, isInList, onAdd, onPlay, listBusy }: {
  movie: TMDBMovie;
  rank: number;
  isInList: boolean;
  onAdd: (e: React.MouseEvent) => void;
  onPlay: () => void;
  listBusy: boolean;
}) => {
  const [imageError, setImageError] = useState(false);
  const displayTitle = getContentTitle(movie);
  const posterUrl = movie.poster_path ? getImageUrl(movie.poster_path, "medium") : null;
  const finalPoster = !posterUrl || imageError ? getPlaceholderImage() : posterUrl;
  const releaseYear = movie.release_date
    ? new Date(movie.release_date).getFullYear()
    : movie.first_air_date
      ? new Date(movie.first_air_date).getFullYear()
      : null;
  const contentType = getContentType(movie);
  const isTV = contentType === "tv";
  const maturity = isTV ? "TV-MA" : "R";
  const rating = typeof movie.vote_average === "number" ? movie.vote_average : 0;

  return (
    <div className="netflix-card-wrap group/num relative cursor-pointer content-auto outline-none focus-ring" tabIndex={0}>
      <div className="flex items-end gap-0">
        <div
          className="rank-number shrink-0 select-none -mr-6 sm:-mr-8 md:-mr-10 lg:-mr-12"
          style={{
            fontSize: "clamp(80px, 14vw, 180px)",
            lineHeight: "0.8",
            zIndex: 0,
            position: "relative",
            transition: "transform 320ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          aria-hidden
        >
          {rank}
        </div>
        <div className="relative aspect-[2/3] w-28 sm:w-32 md:w-36 lg:w-40 rounded-md overflow-hidden bg-gray-900 ring-1 ring-white/5 transition-all duration-300 group-hover/num:ring-white/30 group-hover/num:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8),0_0_30px_-8px_rgba(239,68,68,0.3)]">
          <Image
            src={finalPoster}
            alt={displayTitle}
            fill
            sizes="(max-width: 640px) 112px, (max-width: 1024px) 144px, 160px"
            className="object-cover transition-transform duration-700 group-hover/num:scale-[1.06]"
            loading="lazy"
            decoding="async"
            onError={() => setImageError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-50 group-hover/num:opacity-90 transition-opacity duration-300" />
          <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
            {isTV && (
              <span className="badge-pill badge-hd !text-[9px] !px-1.5 !py-0">Series</span>
            )}
          </div>
          {rating > 0 && (
            <div className="absolute top-1.5 right-1.5">
              <span className={`badge-pill !text-[9px] !px-1.5 !py-0 ${rating >= 7 ? "badge-rating-green" : rating >= 5.5 ? "badge-rating-amber" : "badge-rating-red"}`}>
                ★ {rating.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 px-1">
        <h3 className="text-[12px] font-bold text-white truncate transition-colors group-hover/num:text-white">
          {displayTitle}
        </h3>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-400">
          {releaseYear && <span className="font-medium">{releaseYear}</span>}
          <span className="meta-dot" />
          <span className="meta-pill !text-[9px] !py-0 !px-1">{maturity}</span>
        </div>
        <div className="card-action-row">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPlay(); }}
            className="card-action-btn card-action-btn-primary"
            aria-label={`Play ${displayTitle}`}
          >
            <Play className="h-3 w-3 fill-current" />
          </button>
          <button
            type="button"
            onClick={onAdd}
            disabled={listBusy}
            className="card-action-btn"
            aria-label={isInList ? "Remove from list" : "Add to list"}
          >
            {listBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isInList ? (
              <Check className="h-3 w-3" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPlay(); }}
            className="card-action-btn"
            aria-label={`More about ${displayTitle}`}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
});
MovieCardTop10.displayName = "MovieCardTop10";

const Top10Row = memo(({ movies, title }: Top10RowProps) => {
  const router = useRouter();
  const t = useTranslations("carousel");
  const { isAuthenticated } = useAuth();
  const { addToList, removeFromList, isInList, isOperating } = useUserMovieListContext();
  const { toast } = useToast();
  const { addToHistory } = useUserPreferencesContext();
  const reducedMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);

  const displayTitle = title ?? t("top10Today");
  const top10 = movies.slice(0, 10);

  const handleClick = useCallback(
    (movie: TMDBMovie) => {
      addToHistory(movie.id);
      const ct = getContentType(movie);
      router.push(`/movie/${movie.id}?type=${ct}`);
    },
    [addToHistory, router]
  );

  const handlePlay = useCallback(
    (movie: TMDBMovie) => {
      const ct = getContentType(movie);
      router.push(`/movie/${movie.id}?type=${ct}&autoplay=true`);
    },
    [router]
  );

  const handleAddToList = useCallback(
    async (movie: TMDBMovie, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isAuthenticated) {
        toast({ title: t("signInRequired"), variant: "destructive" });
        return;
      }
      try {
        const movieTitle = getContentTitle(movie);
        if (isInList(movie.id)) {
          await removeFromList(movie.id);
          toast({ title: t("removedFromList"), description: t("removedDesc", { title: movieTitle }) });
        } else {
          await addToList(movie);
          toast({ title: t("addedToList"), description: t("addedDesc", { title: movieTitle }) });
        }
      } catch {
        toast({ title: t("error"), variant: "destructive" });
      }
    },
    [addToList, isAuthenticated, isInList, removeFromList, t, toast]
  );

  if (top10.length === 0) return null;

  return (
    <section
      className="relative group/section content-auto"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-end justify-between mb-4 sm:mb-5">
        <div className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-red-500 mb-1">
            {t("top10Eyebrow")}
          </span>
          <h2 className="row-title">{displayTitle}</h2>
        </div>
      </div>

      <div className="row-shell relative -mx-1 sm:-mx-2" data-edge-left="true" data-edge-right="true">
        <Carousel
          opts={{ align: "start", loop: false, dragFree: true }}
          className="w-full"
        >
          <CarouselContent className="-ml-2 sm:-ml-3 pb-4">
            {top10.map((movie, index) => {
              const rank = index + 1;
              const isIn = isAuthenticated ? isInList(movie.id) : false;
              const busy = isAuthenticated && isOperating(movie.id);

              return (
                <CarouselItem
                  key={movie.id}
                  className="pl-2 sm:pl-3 basis-auto"
                >
                  <div onClick={() => handleClick(movie)}>
                    <MovieCardTop10
                      movie={movie}
                      rank={rank}
                      isInList={isIn}
                      listBusy={busy}
                      onAdd={(e) => handleAddToList(movie, e)}
                      onPlay={() => handlePlay(movie)}
                    />
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>

          {top10.length > 3 && !reducedMotion && (
            <>
              <CarouselPrevious
                aria-label={t("prevSlide")}
                className={`hidden md:inline-flex ${isHovered ? "" : ""}`}
              />
              <CarouselNext
                aria-label={t("nextSlide")}
                className={`hidden md:inline-flex ${isHovered ? "" : ""}`}
              />
            </>
          )}
        </Carousel>
      </div>
    </section>
  );
});

Top10Row.displayName = "Top10Row";

export default Top10Row;
