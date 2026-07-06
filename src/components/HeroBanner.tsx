"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { Play, Star, Plus, Info, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { TMDBMovie, getBackdropUrl, getContentTitle, getContentType } from "@/utils/tmdbApi";
import { useAuth } from "@/hooks/useAuth";
import { useUserMovieListContext } from "@/contexts/UserMovieListContext";
import { useToast } from "@/hooks/use-toast";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchContentDetails } from "@/hooks/queries/useContentDetails";
import { useDominantColors } from "@/hooks/player/useDominantColors";
import { rgbToCss } from "@/lib/player/extractDominantColors";

interface HeroBannerProps {
  /** Single movie or array for rotation */
  movie: TMDBMovie;
  movies?: TMDBMovie[];
}

const ROTATION_INTERVAL_MS = 8000;
const MAX_ROTATION = 5;

const HeroBanner = ({ movie, movies: propMovies }: HeroBannerProps) => {
  const allMovies = (propMovies && propMovies.length > 1
    ? propMovies.slice(0, MAX_ROTATION)
    : [movie]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { isAuthenticated } = useAuth();
  const { addToList, isInList } = useUserMovieListContext();
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();

  const currentMovie = allMovies[activeIndex];
  const contentType = getContentType(currentMovie);
  const { colors } = useDominantColors(
    currentMovie.poster_path ? getBackdropUrl(currentMovie.poster_path, "large") : null,
    currentMovie.genre_ids
  );

  const c1 = colors[0] ? rgbToCss(colors[0], 0.15) : "rgba(239, 68, 68, 0.15)";
  const c2 = colors[1] ? rgbToCss(colors[1], 0.10) : "rgba(168, 85, 247, 0.10)";

  // Prefetch all hero movies
  useEffect(() => {
    for (const m of allMovies) {
      const ct = getContentType(m);
      prefetchContentDetails(queryClient, m.id, ct);
      router.prefetch(`/movie/${m.id}?type=${ct}`);
    }
  }, [allMovies, queryClient, router]);

  // Rotation timer
  useEffect(() => {
    if (allMovies.length <= 1 || reducedMotion) return;

    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % allMovies.length);
    }, ROTATION_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [allMovies.length, reducedMotion]);

  const goToSlide = useCallback((index: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveIndex(index);
      setIsTransitioning(false);
    }, 100);
    // Restart timer
    if (allMovies.length > 1) {
      timerRef.current = setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % allMovies.length);
      }, ROTATION_INTERVAL_MS);
    }
  }, [allMovies.length]);

  const goPrev = useCallback(() => {
    goToSlide(activeIndex === 0 ? allMovies.length - 1 : activeIndex - 1);
  }, [activeIndex, allMovies.length, goToSlide]);

  const goNext = useCallback(() => {
    goToSlide((activeIndex + 1) % allMovies.length);
  }, [activeIndex, allMovies.length, goToSlide]);

  const title = getContentTitle(currentMovie);
  const backdropUrl = currentMovie.backdrop_path ? getBackdropUrl(currentMovie.backdrop_path, "large") : "";
  const releaseYear = currentMovie.release_date
    ? new Date(currentMovie.release_date).getFullYear()
    : currentMovie.first_air_date
      ? new Date(currentMovie.first_air_date).getFullYear()
      : "";
  const isInMyList = isAuthenticated ? isInList(currentMovie.id) : false;

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
    router.push(`/movie/${currentMovie.id}?type=${contentType}&autoplay=true`);
  };

  const handleMoreInfo = () => {
    router.push(`/movie/${currentMovie.id}?type=${contentType}`);
  };

  const handleAddToList = async () => {
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Please sign in to add movies to your list", variant: "destructive" });
      return;
    }
    try {
      await addToList(currentMovie);
      toast({ title: "Added to list", description: `${title} has been added to your list` });
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Something went wrong", variant: "destructive" });
    }
  };

  return (
    <div className="relative h-[88vh] lg:h-[92vh] overflow-hidden contain-paint">
      {/* Backdrops — crossfade between slides */}
      {allMovies.map((m, i) => {
        const url = m.backdrop_path ? getBackdropUrl(m.backdrop_path, "large") : "";
        const isActive = i === activeIndex;
        return (
          <div
            key={m.id}
            className={`absolute inset-0 transition-opacity duration-800 ${isActive && !isTransitioning ? "opacity-100" : "opacity-0"}`}
          >
            <div className={`absolute inset-0 ${isActive && !reducedMotion ? "hero-ken-burns" : ""}`}>
              {url ? (
                <Image src={url} alt={getContentTitle(m)} fill priority={i === 0} sizes="100vw" className="object-cover object-center" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black" />
              )}
            </div>
          </div>
        );
      })}

      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,transparent,rgba(0,0,0,0.45))]" />

      {!reducedMotion && (
        <>
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-colors duration-1000" style={{ backgroundColor: c1 }} />
          <div className="absolute top-1/3 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-colors duration-1000" style={{ backgroundColor: c2 }} />
        </>
      )}

      <div className="relative z-10 flex items-end lg:items-center h-full pb-28 lg:pb-0">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-3xl animate-fade-in-up" key={currentMovie.id}>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="px-4 py-1.5 bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-bold rounded-lg uppercase tracking-wider shadow-lg shadow-red-500/20">
                {currentMovie.media_type === "tv" ? "Series" : "Movie"}
              </span>
              <span className="px-4 py-1.5 glass-card text-white text-xs font-medium rounded-lg flex items-center space-x-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <span>Featured</span>
              </span>
              {releaseYear && (
                <span className="px-4 py-1.5 glass-card text-white text-xs font-medium rounded-lg">{releaseYear}</span>
              )}
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-5 text-white leading-[1.05] tracking-tight">
              {title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center space-x-2 bg-yellow-500/15 px-4 py-2 rounded-xl border border-yellow-500/20">
                <Star className="w-5 h-5 text-yellow-400 fill-current" />
                <span className="text-yellow-400 font-bold text-lg">{currentMovie.vote_average?.toFixed(1)}</span>
              </div>
              <span className="px-4 py-2 glass-card text-white text-sm font-medium rounded-xl">
                {currentMovie.media_type === "tv" ? "TV Series" : "Feature Film"}
              </span>
              <span className="text-gray-400 text-sm hidden sm:inline">HD Available</span>
            </div>

            <p className="text-base sm:text-lg md:text-xl mb-8 text-gray-300 leading-relaxed line-clamp-3 max-w-2xl">
              {currentMovie.overview}
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <button onClick={handlePlayClick} className="group flex items-center space-x-3 bg-white text-black px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-transform duration-200 shadow-2xl shadow-white/15 hover:scale-[1.02] active:scale-[0.98] btn-shine">
                <Play className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" />
                <span>Play Now</span>
              </button>
              <button onClick={handleAddToList} className="group flex items-center space-x-3 glass-premium text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white/15 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]">
                {isInMyList ? <Check className="w-6 h-6 text-green-400" /> : <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />}
                <span>{isInMyList ? "In My List" : "Add to List"}</span>
              </button>
              <button onClick={handleMoreInfo} className="group p-4 glass-card rounded-xl hover:bg-white/15 transition-transform duration-200 hover:scale-105 active:scale-95" title="More Info">
                <Info className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black via-black/70 to-transparent pointer-events-none" />

      {/* Rotation controls */}
      {allMovies.length > 1 && (
        <div className="absolute bottom-8 left-0 right-0 z-20">
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            {/* Prev/Next arrows */}
            <div className="hidden sm:flex items-center gap-2">
              <button onClick={goPrev} className="p-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white hover:bg-white/20 transition-colors" aria-label="Previous title">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={goNext} className="p-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white hover:bg-white/20 transition-colors" aria-label="Next title">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Dot indicators */}
            <div className="flex items-center gap-2 mx-auto sm:mx-0">
              {allMovies.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => goToSlide(i)}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === activeIndex ? "w-8 bg-red-500" : "w-2 bg-white/30 hover:bg-white/50"
                  }`}
                  aria-label={`Go to ${getContentTitle(m)}`}
                />
              ))}
            </div>

            <div className="hidden sm:block w-20" /> {/* Spacer for centering */}
          </div>

          {/* Auto-rotation progress bar */}
          {!reducedMotion && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
              <div
                key={activeIndex}
                className="h-full bg-red-500"
                style={{
                  animation: `hero-progress ${ROTATION_INTERVAL_MS}ms linear`,
                  width: "100%",
                }}
              />
            </div>
          )}
        </div>
      )}

      {!reducedMotion && allMovies.length <= 1 && (
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
