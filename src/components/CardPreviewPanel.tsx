"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { Plus, Heart, Share2, Users, Star, Film, Tv } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  getImageUrl,
  TMDBMovie,
  getContentTitle,
  getContentReleaseDate,
  getContentType,
} from "@/utils/tmdbApi";
import { useUserMovieListContext } from "@/contexts/UserMovieListContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface CardPreviewPanelProps {
  movie: TMDBMovie;
  anchorEl: HTMLElement | null;
  isVisible: boolean;
  onClose: () => void;
  onKeepOpen?: () => void;
}

const genreNames: Record<number, string> = {
  28: "Action", 35: "Comedy", 18: "Drama", 27: "Horror", 10749: "Romance",
  878: "Sci-Fi", 53: "Thriller", 16: "Animation", 14: "Fantasy", 12: "Adventure",
  80: "Crime", 99: "Documentary", 10751: "Family",
};

function CardPreviewPanel({ movie, anchorEl, isVisible, onClose, onKeepOpen }: CardPreviewPanelProps) {
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { addToList, removeFromList, isInList, isOperating } = useUserMovieListContext();

  const title = getContentTitle(movie);
  const releaseDate = getContentReleaseDate(movie);
  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;
  const contentType = getContentType(movie);
  const rating = typeof movie.vote_average === "number" ? movie.vote_average : 0;
  const backdropUrl = movie.backdrop_path ? getImageUrl(movie.backdrop_path, "medium") : null;
  const posterUrl = movie.poster_path ? getImageUrl(movie.poster_path, "medium") : null;
  const isInMyList = isInList(movie.id);

  const genres = (movie.genre_ids || [])
    .slice(0, 3)
    .map((id) => genreNames[id])
    .filter(Boolean);

  const primaryGenre = genres[0];

  useEffect(() => {
    if (!anchorEl || !isVisible) return;

    const updatePosition = () => {
      const rect = anchorEl.getBoundingClientRect();
      const panelWidth = 320;
      const panelHeight = 380;

      let left = rect.left + rect.width / 2 - panelWidth / 2;
      let top = rect.top - panelHeight - 12;

      // Clamp to viewport with safe padding
      if (left < 12) left = 12;
      if (left + panelWidth > window.innerWidth - 12) left = window.innerWidth - panelWidth - 12;
      if (top < 12) top = rect.bottom + 12;
      // If still off bottom, flip above with smaller offset
      if (top + panelHeight > window.innerHeight - 12 && rect.top - panelHeight - 12 > 12) {
        top = rect.top - panelHeight - 12;
      }

      setPanelStyle({
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        width: `${panelWidth}px`,
        zIndex: 9998,
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, { passive: true });
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [anchorEl, isVisible, movie.id]);

  const handleToggleList = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Sign in to manage your list.", variant: "destructive" });
      return;
    }
    try {
      if (isInMyList) {
        await removeFromList(movie.id);
      } else {
        await addToList(movie);
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    }
  }, [isAuthenticated, isInMyList, movie, addToList, removeFromList, toast]);

  const handleParty = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/movie/${movie.id}?type=${getContentType(movie)}&autoplay=true`);
    onClose();
  }, [movie, router, onClose]);

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/movie/${movie.id}?type=${getContentType(movie)}`;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied!" });
    }
  }, [movie, title, toast]);

  if (!isVisible || !anchorEl) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={panelStyle}
      className="card-preview-panel pointer-events-auto animate-scale-in glass-strong rounded-2xl"
      onMouseEnter={onKeepOpen}
      onMouseLeave={onClose}
    >
      <div className="rounded-2xl border border-white/10 shadow-2xl overflow-hidden bg-transparent">
        {/* Backdrop — auto-rotating still frame, no overlay button (Play lives on the card) */}
        <div className="relative h-40 overflow-hidden">
          {backdropUrl ? (
            <Image
              src={backdropUrl}
              alt={title}
              fill
              className="object-cover"
              sizes="320px"
            />
          ) : posterUrl ? (
            <Image
              src={posterUrl}
              alt={title}
              fill
              className="object-cover"
              sizes="320px"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-600/30 to-zinc-800" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/50 to-transparent" />
        </div>

        {/* Info — Netflix-style metadata + actions, no duplicate Play button */}
        <div className="p-4">
          <h4 className="text-[15px] font-bold text-white leading-tight mb-2 line-clamp-2">{title}</h4>

          <div className="flex items-center gap-2 text-[11px] text-gray-300 mb-3">
            {rating > 0 && (
              <span className="inline-flex items-center gap-0.5 font-semibold text-green-400">
                <Star className="w-3 h-3 fill-current" />
                {rating.toFixed(1)}
              </span>
            )}
            {year && <span>{year}</span>}
            <span className="meta-dot" />
            <span className="inline-flex items-center gap-0.5">
              {contentType === "tv" ? <Tv className="w-3 h-3" /> : <Film className="w-3 h-3" />}
              {contentType === "tv" ? "Series" : "Movie"}
            </span>
            {primaryGenre && (
              <>
                <span className="meta-dot" />
                <span className="text-gray-400">{primaryGenre}</span>
              </>
            )}
          </div>

          {genres.length > 0 && (
            <div className="flex items-center gap-1.5 mb-2">
              {genres.map((g) => (
                <span
                  key={g}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {movie.overview && (
            <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-3 mb-3">
              {movie.overview}
            </p>
          )}

          {/* Secondary actions: list / share / party — no Play button (Play is on the card itself) */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleToggleList}
              disabled={isOperating(movie.id)}
              className={`press-effect flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold border transition-colors focus-ring ${
                isInMyList
                  ? "border-white/30 bg-white/10 text-white"
                  : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
              } ${isOperating(movie.id) ? "opacity-60" : ""}`}
              aria-label={isInMyList ? "Remove from list" : "Add to list"}
            >
              {isInMyList ? <Heart className="h-3.5 w-3.5 fill-current" /> : <Plus className="h-3.5 w-3.5" />}
              {isInMyList ? "In My List" : "My List"}
            </button>
            <button
              type="button"
              onClick={handleParty}
              className="press-effect p-2 rounded-md border border-white/10 bg-white/5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white focus-ring"
              aria-label="Watch together"
              title="Watch together"
            >
              <Users className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="press-effect p-2 rounded-md border border-white/10 bg-white/5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white focus-ring"
              aria-label="Share"
              title="Share"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default memo(CardPreviewPanel);
