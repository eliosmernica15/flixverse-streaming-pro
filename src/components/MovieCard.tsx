"use client";

import { useState, useRef, useCallback, memo, useEffect } from "react";
import { Play, Star, Heart, Film, Tv, Plus } from "lucide-react";
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
  const { toast } = useToast();
  const { addToHistory, addFavoriteGenre } = useUserPreferencesContext();
  const { isAuthenticated } = useAuth();
  const [isInLocalList, setIsInLocalList] = useState(false);
  const { addToList, removeFromList, isInList } = useUserMovieListContext();
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

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const contentType = getContentType(movie);
    router.push(`/movie/${movie.id}?type=${contentType}`);
  };

  const handleAddToListClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add movies to your list",
        variant: "destructive",
      });
      return;
    }

    const movieTitle = movie.title || movie.name || "Unknown";

    try {
      if (isInMyList) {
        await removeFromList(movie.id);
        toast({
          title: "Removed from My List",
          description: `${movieTitle} has been removed from your list.`,
        });
      } else {
        await addToList(movie);
        toast({
          title: "Added to My List",
          description: `${movieTitle} has been added to your list.`,
        });
      }
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
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
      className="relative group cursor-pointer movie-card"
      onMouseEnter={() => {
        setIsHovered(true);
        prefetchMovie();
      }}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <div className="relative overflow-hidden rounded-2xl bg-gray-900/50 movie-card-inner">
        <div
          className={`absolute -inset-1 rounded-2xl blur-md bg-gradient-to-r from-red-600/25 to-purple-600/25 transition-opacity duration-300 pointer-events-none ${isHovered ? "opacity-100" : "opacity-0"}`}
        />

        <div className="relative aspect-[2/3] overflow-hidden rounded-2xl">
          {!imageLoaded && <div className="absolute inset-0 bg-gray-800/80 skeleton-shimmer" />}

          <Image
            src={finalPosterUrl}
            alt={displayTitle}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            className={`object-cover transition-transform duration-500 ease-out ${isHovered ? "scale-105" : "scale-100"}`}
            loading="lazy"
            onError={() => setImageError(true)}
            onLoad={() => setImageLoaded(true)}
          />

          <div
            className={`absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent transition-opacity duration-300 ${isHovered ? "opacity-95" : "opacity-55"}`}
          />

          <div className="absolute top-3 left-3 flex items-center space-x-1.5 glass-card text-white text-[10px] font-bold px-2 py-1 rounded-md">
            {contentType === "tv" ? <Tv className="w-3 h-3" /> : <Film className="w-3 h-3" />}
            <span>{contentType === "tv" ? "SERIES" : "MOVIE"}</span>
          </div>

          {hasValidRating && (
            <div
              className={`absolute top-3 right-3 flex items-center space-x-1 bg-gradient-to-r ${getRatingColor(rating)} text-white text-[10px] font-black px-2 py-1 rounded-md shadow-lg`}
            >
              <Star className="w-3 h-3 fill-current" />
              <span>{rating.toFixed(1)}</span>
            </div>
          )}

          <div
            className={`absolute inset-x-0 bottom-0 p-4 z-10 transition-all duration-200 ${isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}
          >
            <h3 className="text-white font-black text-base mb-1 line-clamp-1 drop-shadow-md">
              {displayTitle}
            </h3>

            <div className="flex items-center space-x-2 mb-3">
              {year && <span className="text-gray-300 text-xs font-medium">{year}</span>}
              {primaryGenre && (
                <span className="text-red-500 text-[10px] font-bold uppercase tracking-wider">
                  {primaryGenre}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {comingSoon ? (
                <div className="flex-1 bg-amber-500/20 text-amber-400 py-2 rounded-lg font-bold text-[10px] text-center border border-amber-500/30">
                  COMING SOON
                </div>
              ) : (
                <button
                  className="flex-1 flex items-center justify-center space-x-2 bg-white text-black py-2 rounded-lg font-bold text-xs hover:bg-gray-100 transition-colors"
                  onClick={handlePlayClick}
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>PLAY</span>
                </button>
              )}

              <button
                className={`p-2 rounded-lg transition-colors ${isInMyList ? "bg-red-500 text-white" : "glass-card text-white"}`}
                onClick={handleAddToListClick}
              >
                {isInMyList ? (
                  <Heart className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`mt-2 transition-opacity duration-200 ${isHovered ? "opacity-0" : "opacity-100"}`}>
        <p className="text-white text-xs font-bold truncate">{displayTitle}</p>
        <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter mt-0.5">
          {year} • {hasValidRating ? `${rating.toFixed(1)} Rating` : "New"}
        </p>
      </div>
    </div>
  );
};

export default memo(MovieCard);
