"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { Play, Plus, Info, Check, ChevronLeft, ChevronRight, Volume2, Sparkles, ChevronDown } from "lucide-react";
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
  movie: TMDBMovie;
  movies?: TMDBMovie[];
}

const ROTATION_INTERVAL_MS = 9000;
const MAX_ROTATION = 5;

const HeroBanner = ({ movie, movies: propMovies }: HeroBannerProps) => {
  const allMovies = (propMovies && propMovies.length > 1
    ? propMovies.slice(0, MAX_ROTATION)
    : [movie]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
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

  const c1 = colors[0] ? rgbToCss(colors[0], 0.18) : "rgba(229, 9, 20, 0.18)";
  const c2 = colors[1] ? rgbToCss(colors[1], 0.12) : "rgba(124, 58, 237, 0.12)";

  useEffect(() => {
    for (const m of allMovies) {
      const ct = getContentType(m);
      prefetchContentDetails(queryClient, m.id, ct);
      router.prefetch(`/movie/${m.id}?type=${ct}`);
    }
  }, [allMovies, queryClient, router]);

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
  const rating = typeof currentMovie.vote_average === "number" ? currentMovie.vote_average : 0;
  const isSeries = currentMovie.media_type === "tv";
  const maturity = isSeries ? "TV-MA" : "R";
  const seasons = isSeries ? `${(currentMovie as TMDBMovie & { number_of_seasons?: number }).number_of_seasons ?? 1} Season${((currentMovie as TMDBMovie & { number_of_seasons?: number }).number_of_seasons ?? 1) > 1 ? "s" : ""}` : `${Math.floor(Math.random() * 60) + 90}m`;

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
      className="group/hero relative h-[78vh] sm:h-[88vh] lg:h-[92vh] min-h-[520px] overflow-hidden contain-paint bg-black"
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
      {allMovies.map((m, i) => {
        const url = m.backdrop_path ? getBackdropUrl(m.backdrop_path, "large") : "";
        const isActive = i === activeIndex;
        const slideKey = `${m.id}-${m.media_type ?? "movie"}`;
        return (
          <div
            key={slideKey}
            className={`absolute inset-0 transition-opacity duration-[1200ms] ease-out ${isActive ? "opacity-100" : "opacity-0"}`}
            aria-hidden={!isActive}
          >
            <div className={`absolute inset-0 ${isActive && !reducedMotion ? "hero-ken-burns" : ""}`}>
              {url ? (
                <Image
                  src={url}
                  alt={getContentTitle(m)}
                  fill
                  priority={i === 0}
                  sizes="100vw"
                  className="object-cover object-center"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black" />
              )}
            </div>
          </div>
        );
      })}

      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/50" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-transparent h-32" />

      {!reducedMotion && (
        <>
          <div
            className="absolute -bottom-32 -left-32 w-[28rem] h-[28rem] rounded-full blur-3xl pointer-events-none transition-colors duration-1000"
            style={{ backgroundColor: c1 }}
          />
          <div
            className="absolute top-1/4 -right-20 w-[24rem] h-[24rem] rounded-full blur-3xl pointer-events-none transition-colors duration-1000"
            style={{ backgroundColor: c2 }}
          />
        </>
      )}

      <div className="relative z-10 flex items-end lg:items-center h-full pb-24 sm:pb-32 lg:pb-0">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-2xl lg:max-w-3xl" key={currentMovie.id}>
            <div className="anim-slide-up-soft flex flex-wrap items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-white/30 bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                <Sparkles className="h-3 w-3 text-yellow-400" />
                {t("featured")}
              </span>
              {rating > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/5 px-2 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                  <span className="text-yellow-400">★</span>
                  {rating.toFixed(1)}
                </span>
              )}
              <span className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                {maturity}
              </span>
              {releaseYear && (
                <span className="text-sm font-medium text-white/80">{releaseYear}</span>
              )}
              <span className="text-white/40">•</span>
              <span className="text-sm font-medium text-white/80">{seasons}</span>
              <span className="text-white/40">•</span>
              <span className="inline-flex items-center gap-1 rounded border border-white/30 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-white">
                HD
              </span>
              {isSeries && (
                <>
                  <span className="text-white/40">•</span>
                  <span className="inline-flex items-center gap-1 rounded border border-purple-400/40 bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-200">
                    Series
                  </span>
                </>
              )}
            </div>

            <h1
              className="hero-text-shadow-strong mb-4 sm:mb-6 text-balance font-black tracking-tight text-white animate-letter text-3xl sm:text-5xl md:text-6xl lg:text-7xl"
              style={{ lineHeight: "1.05" }}
            >
              {title.split(" ").map((word, i) => (
                <span key={i} className="inline-block opacity-0" style={{ animation: `letter-fade 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 50}ms forwards` }}>
                  {word}&nbsp;
                </span>
              ))}
            </h1>

            <p className="hero-text-shadow mb-6 sm:mb-8 max-w-2xl text-sm sm:text-base md:text-lg leading-relaxed text-gray-200/90 line-clamp-3 sm:line-clamp-3">
              {currentMovie.overview}
            </p>

            <div className="anim-slide-left flex flex-wrap items-center gap-2.5 sm:gap-3">
              <button
                onClick={handlePlayClick}
                className="cta-primary !rounded-md !px-6 !py-2.5 sm:!px-8 sm:!py-3.5 !text-sm sm:!text-base shadow-2xl"
                aria-label={`Play ${title}`}
              >
                <Play className="h-5 w-5 sm:h-6 sm:w-6 fill-current" />
                <span>{t("playNow")}</span>
              </button>

              <button
                onClick={handleAddToList}
                className="cta-secondary !rounded-md !px-5 !py-2.5 sm:!px-6 sm:!py-3.5 !text-sm sm:!text-base"
                aria-label={isInMyList ? t("inList") : t("addToList")}
              >
                {isInMyList ? (
                  <Check className="h-5 w-5 sm:h-6 sm:w-6" />
                ) : (
                  <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                )}
                <span>{isInMyList ? t("inList") : t("addToList")}</span>
              </button>

              <button
                onClick={handleMoreInfo}
                className="cta-icon !rounded-full"
                aria-label={t("moreInfo")}
                title={t("moreInfo")}
              >
                <ChevronDown className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>

              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className="cta-icon !rounded-full ml-auto hidden sm:inline-flex"
                aria-label={muted ? "Unmute" : "Mute"}
                title={muted ? "Unmute preview" : "Mute preview"}
              >
                <Volume2 className={`h-5 w-5 sm:h-6 sm:w-6 ${muted ? "opacity-60" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none z-[1]" />

      {allMovies.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-0 top-0 bottom-0 z-20 hidden w-16 items-center justify-center text-white opacity-0 transition-opacity duration-300 hover:opacity-100 group-hover/hero:opacity-100 sm:flex"
            aria-label={t("prevTitle")}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur-md transition-all duration-200 hover:bg-black/70 hover:scale-110">
              <ChevronLeft className="h-7 w-7" />
            </span>
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-0 top-0 bottom-0 z-20 hidden w-16 items-center justify-center text-white opacity-0 transition-opacity duration-300 hover:opacity-100 group-hover/hero:opacity-100 sm:flex"
            aria-label={t("nextTitle")}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur-md transition-all duration-200 hover:bg-black/70 hover:scale-110">
              <ChevronRight className="h-7 w-7" />
            </span>
          </button>
        </>
      )}

      {allMovies.length > 1 && (
        <div className="absolute right-4 sm:right-8 bottom-6 sm:bottom-8 z-20 flex items-center gap-1.5">
          {allMovies.map((m, i) => {
            const isActive = i === activeIndex;
            return (
              <button
                key={`${m.id}-${m.media_type ?? "movie"}`}
                type="button"
                onClick={() => goToSlide(i)}
                className={`h-1 rounded-full transition-all duration-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                  isActive
                    ? "w-10 bg-white shadow-md"
                    : "w-6 bg-white/30 hover:bg-white/50"
                }`}
                aria-label={`Go to ${getContentTitle(m)}`}
                aria-current={isActive ? "true" : undefined}
              />
            );
          })}
        </div>
      )}

      {!reducedMotion && allMovies.length <= 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center space-y-2 animate-fade-in pointer-events-none">
          <span className="text-xs text-gray-500 uppercase tracking-widest">Scroll to explore</span>
          <div className="w-6 h-10 border-2 border-gray-600 rounded-full flex justify-center hero-scroll-indicator">
            <div className="w-1.5 h-3 bg-white rounded-full mt-2" />
          </div>
        </div>
      )}
    </div>
  );
};

export default HeroBanner;
