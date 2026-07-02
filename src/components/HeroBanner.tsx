"use client";

import Image from "next/image";
import { Play, Star, Plus, Info, Check } from "lucide-react";
import { TMDBMovie, getBackdropUrl, getContentTitle } from "@/utils/tmdbApi";
import { useAuth } from "@/hooks/useAuth";
import { useUserMovieListContext } from "@/contexts/UserMovieListContext";
import { useToast } from "@/hooks/use-toast";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useRouter } from "next/navigation";

interface HeroBannerProps {
  movie: TMDBMovie;
}

const HeroBanner = ({ movie }: HeroBannerProps) => {
  const { isAuthenticated } = useAuth();
  const { addToList, isInList } = useUserMovieListContext();
  const { toast } = useToast();
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const title = getContentTitle(movie);
  const backdropUrl = movie.backdrop_path ? getBackdropUrl(movie.backdrop_path, "large") : "";
  const releaseYear = movie.release_date
    ? new Date(movie.release_date).getFullYear()
    : movie.first_air_date
      ? new Date(movie.first_air_date).getFullYear()
      : "";
  const isInMyList = isAuthenticated ? isInList(movie.id) : false;

  const handlePlayClick = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in or sign up to watch movies and TV shows.",
        variant: "destructive",
      });
      setTimeout(() => router.push("/auth"), 1500);
      return;
    }
    const contentType = movie.media_type === "tv" ? "tv" : "movie";
    router.push(`/movie/${movie.id}?type=${contentType}&autoplay=true`);
  };

  const handleMoreInfo = () => {
    const contentType = movie.media_type === "tv" ? "tv" : "movie";
    router.push(`/movie/${movie.id}?type=${contentType}`);
  };

  const handleAddToList = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add movies to your list",
        variant: "destructive",
      });
      return;
    }

    try {
      await addToList(movie);
      toast({
        title: "Added to list",
        description: `${title} has been added to your list`,
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="relative h-[88vh] lg:h-[92vh] overflow-hidden contain-paint">
      <div className={`absolute inset-0 ${reducedMotion ? "" : "hero-ken-burns"}`}>
        {backdropUrl ? (
          <Image
            src={backdropUrl}
            alt={title}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black" />
        )}

        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,transparent,rgba(0,0,0,0.45))]" />

        {!reducedMotion && (
          <>
            <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-red-500/15 rounded-full blur-3xl hero-glow-red pointer-events-none" />
            <div className="absolute top-1/3 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl hero-glow-purple pointer-events-none" />
          </>
        )}
      </div>

      <div className="relative z-10 flex items-end lg:items-center h-full pb-28 lg:pb-0">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-3xl animate-fade-in-up">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="px-4 py-1.5 bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-bold rounded-lg uppercase tracking-wider shadow-lg shadow-red-500/20">
                {movie.media_type === "tv" ? "Series" : "Movie"}
              </span>
              <span className="px-4 py-1.5 glass-card text-white text-xs font-medium rounded-lg flex items-center space-x-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <span>Featured</span>
              </span>
              {releaseYear && (
                <span className="px-4 py-1.5 glass-card text-white text-xs font-medium rounded-lg">
                  {releaseYear}
                </span>
              )}
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-5 text-white leading-[1.05] tracking-tight">
              {title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center space-x-2 bg-yellow-500/15 px-4 py-2 rounded-xl border border-yellow-500/20">
                <Star className="w-5 h-5 text-yellow-400 fill-current" />
                <span className="text-yellow-400 font-bold text-lg">{movie.vote_average?.toFixed(1)}</span>
              </div>
              <span className="px-4 py-2 glass-card text-white text-sm font-medium rounded-xl">
                {movie.media_type === "tv" ? "TV Series" : "Feature Film"}
              </span>
              <span className="text-gray-400 text-sm hidden sm:inline">HD Available</span>
            </div>

            <p className="text-base sm:text-lg md:text-xl mb-8 text-gray-300 leading-relaxed line-clamp-3 max-w-2xl">
              {movie.overview}
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={handlePlayClick}
                className="group flex items-center space-x-3 bg-white text-black px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-transform duration-200 shadow-2xl shadow-white/15 hover:scale-[1.02] active:scale-[0.98] btn-shine"
              >
                <Play className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" />
                <span>Play Now</span>
              </button>

              <button
                onClick={handleAddToList}
                disabled={!isAuthenticated && isInMyList}
                className="group flex items-center space-x-3 glass-premium text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white/15 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                {isInMyList ? (
                  <Check className="w-6 h-6 text-green-400" />
                ) : (
                  <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                )}
                <span>{isInMyList ? "In My List" : "Add to List"}</span>
              </button>

              <button
                onClick={handleMoreInfo}
                className="group p-4 glass-card rounded-xl hover:bg-white/15 transition-transform duration-200 hover:scale-105 active:scale-95"
                title="More Info"
              >
                <Info className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black via-black/70 to-transparent pointer-events-none" />

      {!reducedMotion && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center space-y-2 animate-fade-in">
          <span className="text-xs text-gray-500 uppercase tracking-widest">Scroll to explore</span>
          <div className="w-6 h-10 border-2 border-gray-600 rounded-full flex justify-center hero-scroll-indicator">
            <div className="w-1.5 h-3 bg-red-500 rounded-full mt-2" />
          </div>
        </div>
      )}
    </div>
  );
};

export default HeroBanner;
