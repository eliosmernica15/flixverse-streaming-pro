"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { Play, Plus, Heart, Share2, Users, Star, Film, Tv } from "lucide-react";
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

  useEffect(() => {
    if (!anchorEl || !isVisible) return;

    const rect = anchorEl.getBoundingClientRect();
    const panelWidth = 320;
    const panelHeight = 400;

    let left = rect.left + rect.width / 2 - panelWidth / 2;
    let top = rect.top - panelHeight - 8;

    // Clamp to viewport
    if (left < 8) left = 8;
    if (left + panelWidth > window.innerWidth - 8) left = window.innerWidth - panelWidth - 8;
    if (top < 8) top = rect.bottom + 8;

    setPanelStyle({
      position: "fixed",
      left: `${left}px`,
      top: `${top}px`,
      width: `${panelWidth}px`,
      zIndex: 9998,
    });
  }, [anchorEl, isVisible]);

  const handlePlay = useCallback(() => {
    const ct = getContentType(movie);
    router.push(`/movie/${movie.id}?type=${ct}`);
    onClose();
  }, [movie, router, onClose]);

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
        {/* Backdrop */}
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
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent" />

          {/* Play button overlay */}
          <button
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
            aria-label={`Play ${title}`}
          >
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 hover:bg-white/30 transition-colors">
              <Play className="w-7 h-7 text-white fill-white ml-0.5" />
            </div>
          </button>
        </div>

        {/* Info */}
        <div className="p-4">
          {/* Action buttons */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={handlePlay}
              className="press-effect flex-1 flex items-center justify-center gap-1.5 bg-white py-2 rounded-lg font-bold text-xs text-black transition-colors hover:bg-gray-100 focus-ring"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Play
            </button>
            <button
              onClick={handleToggleList}
              className={`press-effect p-2 rounded-lg border transition-colors focus-ring ${
                isInMyList
                  ? "border-red-500/30 bg-red-500/20 text-red-400"
                  : "border-white/10 bg-white/5 text-gray-400 hover:text-white"
              }`}
              aria-label={isInMyList ? "Remove from list" : "Add to list"}
            >
              {isInMyList ? <Heart className="h-4 w-4 fill-current" /> : <Plus className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="press-effect p-2 rounded-lg border border-white/10 bg-white/5 text-gray-400 transition-colors hover:text-white focus-ring"
              aria-label="Share"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleParty}
              className="press-effect p-2 rounded-lg border border-white/10 bg-white/5 text-gray-400 transition-colors hover:text-white focus-ring"
              aria-label="Watch together"
            >
              <Users className="h-4 w-4" />
            </button>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            {rating > 0 && (
              <span className="flex items-center gap-0.5 text-green-400 font-semibold">
                <Star className="w-3 h-3 fill-current" />
                {rating.toFixed(1)}
              </span>
            )}
            {year && <span>{year}</span>}
            <span className="flex items-center gap-0.5">
              {contentType === "tv" ? <Tv className="w-3 h-3" /> : <Film className="w-3 h-3" />}
              {contentType === "tv" ? "Series" : "Movie"}
            </span>
          </div>

          {/* Genres */}
          {genres.length > 0 && (
            <div className="flex items-center gap-1.5 mb-2">
              {genres.map((g) => (
                <span
                  key={g}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-gray-300"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Overview */}
          {movie.overview && (
            <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-3">
              {movie.overview}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default memo(CardPreviewPanel);
