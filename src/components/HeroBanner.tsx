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
import { useTranslations } from "next-intl";

interface HeroBannerProps {
  /** Single movie or array for rotation */
  movie: TMDBMovie;
  movies?: TMDBMovie[];
}

const ROTATION_INTERVAL_MS = 8000;
const MAX_ROTATION = 5;
const HINT_TIMEOUT_MS = 10000;

const HeroBanner = ({ movie, movies: propMovies }: HeroBannerProps) => {
  const allMovies = (propMovies && propMovies.length > 1
    ? propMovies.slice(0, MAX_ROTATION)
    : [movie]);
  const [activeIndex, setActiveIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const t = useTranslations("hero");
  const tCommon = useTranslations("common");
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

  const c1 = colors[0] ? rgbToCss(colors[0], 0.15) : "hsl(var(--primary) / 0.15)";
  const c2 = colors[1] ? rgbToCss(colors[1], 0.10) : "hsl(var(--neon-purple) / 0.10)";

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

    const startTimer = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % allMovies.length);
      }, ROTATION_INTERVAL_MS);
    };
    const stopTimer = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) stopTimer();
      else startTimer();
    };

    if (!document.hidden) startTimer();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopTimer();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [allMovies.length, reducedMotion]);

  const goToSlide = useCallback((index: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveIndex(index);
    if (allMovies.length > 1 && !reducedMotion) {
      timerRef.current = setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % allMovies.length);
      }, ROTATION_INTERVAL_MS);
    }
  }, [allMovies.length, reducedMotion]);

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
        title: t("signInRequired"),
        description: t("signInToWatch"),
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
      toast({ title: t("signInRequired"), description: t("signInForList"), variant: "destructive" });
      return;
    }
    try {
      await addToList(currentMovie);
      toast({ title: t("addedToList"), description: t("addedDesc", { title }) });
    } catch (error: unknown) {
      toast({ title: t("error"), description: error instanceof Error ? error.message : t("somethingWrong"), variant: "destructive" });
    }
  };

  return (
    <div
      className="relative h-[72vh] sm:h-[88vh] lg:h-[92vh] overflow-hidden contain-paint"
      onMouseEnter={() => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }}
      onMouseLeave={() => {
        if (allMovies.length <= 1 || reducedMotion) return;
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setActiveIndex((prev) => (prev + 1) % allMovies.length);
        }, ROTATION_INTERVAL_MS);
      }}
    >
      {/* Backdrops — crossfade between slides */}
      {allMovies.map((m, i) => {
        const url = m.backdrop_path ? getBackdropUrl(m.backdrop_path, "large") : "";
        const isActive = i === activeIndex;
        const slideKey = `${m.id}-${m.media_type ?? "movie"}`;
        return (
          <div
            key={slideKey}
            className={`absolute inset-0 transition-opacity duration-[800ms] ${isActive ? "opacity-100" : "opacity-0"}`}
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
      <div className="absolute inset-0 bg-gradient-to-tr from-black/85 via-black/25 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,transparent,rgba(0,0,0,0.45))]" />

      {!reducedMotion && (
        <>
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-colors duration-1000" style={{ backgroundColor: c1 }} />
          <div className="absolute top-1/3 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-colors duration-1000" style={{ backgroundColor: c2 }} />
        </>
      )}

      <div className="relative z-10 flex items-end lg:items-center h-full pb-20 sm:pb-28 lg:pb-0">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
           <div className="max-w-3xl animate-fade-in-up" key={currentMovie.id}>
             <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-5">
               <span className="eyebrow">{releaseYear ? `${releaseYear}` : t("nowStreaming")}</span>
               <span className="chip bg-gradient-to-r from-red-600 to-red-500 text-white border-0 shadow-lg shadow-red-500/20">
                 {currentMovie.media_type === "tv" ? tCommon("series") : tCommon("movie")}
               </span>
               <span className="chip glass-card">
                 <span className="h-2 w-2 rounded-full bg-green-500" />
                 <span>{t("featured")}</span>
               </span>
             </div>

             <h1 className="display-title gradient-text text-balance mb-3 sm:mb-5 text-3xl sm:text-4xl md:text-5xl lg:text-6xl">
               {title}
             </h1>

             <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
               <span className="chip bg-yellow-500/15 border-yellow-500/20 font-bold text-yellow-400">
                 <Star className="h-3.5 w-3.5 fill-current" />
                 <span>{currentMovie.vote_average?.toFixed(1)}</span>
               </span>
               <span className="chip glass-card">
                 {currentMovie.media_type === "tv" ? t("tvSeries") : t("featureFilm")}
               </span>
               <span className="chip glass-card">{t("hdAvailable")}</span>
             </div>

            <p className="text-sm sm:text-base md:text-lg mb-6 sm:mb-8 text-gray-300 leading-relaxed line-clamp-3 max-w-2xl">
              {currentMovie.overview}
            </p>

            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <button onClick={handlePlayClick} className="btn-primary group flex items-center space-x-2 sm:space-x-3 px-5 py-3 sm:px-8 sm:py-4 text-base sm:text-lg hover:scale-[1.02] active:scale-[0.98] press-effect btn-shine focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black">
                <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current group-hover:scale-110 transition-transform" />
                <span>{t("playNow")}</span>
              </button>
              <button onClick={handleAddToList} className="btn-glass group flex items-center space-x-2 sm:space-x-3 px-5 py-3 sm:px-8 sm:py-4 text-base sm:text-lg font-semibold hover:scale-[1.02] active:scale-[0.98] press-effect focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/70">
                {isInMyList ? <Check className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" /> : <Plus className="w-5 h-5 sm:w-6 sm:h-6 group-hover:rotate-90 transition-transform duration-300" />}
                <span>{isInMyList ? t("inList") : t("addToList")}</span>
              </button>
              <button onClick={handleMoreInfo} className="group p-3 sm:p-4 glass-card rounded-xl hover:bg-white/15 transition-transform duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black" title={t("moreInfo")}>
                <Info className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
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
              <button onClick={goPrev} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/70" aria-label={t("prevTitle")}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={goNext} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/70" aria-label={t("nextTitle")}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Dot indicators */}
            <div className="flex items-center gap-2 mx-auto sm:mx-0">
              {allMovies.map((m, i) => (
                <button
                  key={`${m.id}-${m.media_type ?? "movie"}`}
                  onClick={() => goToSlide(i)}
                  className={`h-1 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/70 ${
                    i === activeIndex ? "w-8 bg-red-500" : "w-2 bg-white/30 hover:bg-white/50"
                  }`}
                  aria-label={`Go to ${getContentTitle(m)}`}
                />
              ))}
            </div>

            <div className="hidden sm:block w-20" /> {/* Spacer for centering */}
          </div>

          {/* Auto-rotation progress bar — subtle, Netflix-style, white translucent */}
          {!reducedMotion && allMovies.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10">
              <div
                key={activeIndex}
                className="h-full bg-white/60"
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
