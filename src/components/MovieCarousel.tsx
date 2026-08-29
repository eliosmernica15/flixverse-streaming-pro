"use client";

import { useMemo, memo } from "react";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import MovieCard from "./MovieCard";
import SectionHeader from "./SectionHeader";
import { TMDBMovie } from "@/utils/tmdbApi";
import { useRoutePrefetch } from "@/hooks/useRoutePrefetch";
import { useTranslations } from "next-intl";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface MovieCarouselProps {
  title: string;
  movies: TMDBMovie[];
  priority?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  showWhenEmpty?: boolean;
  exploreAllPath?: string;
  comingSoon?: boolean;
}

const MovieCarousel = memo(
  ({
    title,
    movies,
    loading = false,
    icon,
    showWhenEmpty = false,
    exploreAllPath,
    comingSoon = false,
  }: MovieCarouselProps) => {
    const prefetchRoute = useRoutePrefetch();
    const tc = useTranslations("common");
    const t = useTranslations("carousel");

    const validMovies = useMemo(
      () =>
        movies
          .filter((movie) => {
            if (!movie?.id) return false;
            const hasTitle = movie.title || movie.name;
            if (!hasTitle || !movie.poster_path) return false;
            return true;
          })
          .map((movie) => ({
            ...movie,
            title: movie.title || movie.name,
            release_date: movie.release_date || movie.first_air_date,
          })),
      [movies]
    );

    if (loading) {
      return (
        <div className="relative content-auto">
          <div className="flex items-center space-x-3 mb-8">
            <div className="h-8 bg-white/5 rounded-xl w-48 skeleton-shimmer" />
          </div>
          <div className="flex space-x-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-48 flex-shrink-0">
                <div className="aspect-[2/3] bg-white/5 rounded-2xl skeleton-shimmer" />
                <div className="mt-3 h-4 bg-white/5 rounded-lg skeleton-shimmer w-4/5" />
                <div className="mt-2 h-3 bg-white/5 rounded-lg skeleton-shimmer w-1/2" />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (!validMovies.length && !showWhenEmpty) {
      return null;
    }

    return (
      <section className="relative group/section content-auto">
        <div className="flex items-center gap-3 sm:gap-4">
          {icon && (
            <div className="gradient-border flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-gradient-to-br from-red-500/15 to-purple-500/10">
              {icon}
            </div>
          )}
          <SectionHeader
            className="min-w-0 flex-1"
            title={title}
            eyebrow={validMovies.length > 0 ? tc("titles", { count: validMovies.length }) : undefined}
            action={
              exploreAllPath ? (
                <Link
                  href={exploreAllPath}
                  prefetch
                  onMouseEnter={() => prefetchRoute(exploreAllPath)}
                  onFocus={() => prefetchRoute(exploreAllPath)}
                  className="group/btn glass-card glass-sheen hover-lift-sm flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-gray-400 transition-all duration-200 hover:translate-x-0.5 hover:text-white focus-ring"
                >
                  <Sparkles className="h-4 w-4 text-red-500" />
                  <span>{tc("exploreAll")}</span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                </Link>
              ) : undefined
            }
          />
        </div>

        {validMovies.length > 0 ? (
          <div className="relative px-1 sm:px-2">
          <Carousel
            opts={{
              align: "start",
              loop: validMovies.length > 4,
              skipSnaps: false,
              dragFree: false,
              containScroll: "trimSnaps",
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-3 md:-ml-5">
              {validMovies.map((movie) => (
                <CarouselItem
                  key={movie.id}
                  className="pl-3 md:pl-5 basis-[48%] sm:basis-[32%] md:basis-[24%] lg:basis-[19%] xl:basis-[15.5%]"
                >
                  <MovieCard movie={movie} comingSoon={comingSoon} />
                </CarouselItem>
              ))}
            </CarouselContent>

            {validMovies.length > 4 && (
              <>
                <CarouselPrevious
                  aria-label={t("prevSlide")}
                  className="carousel-side-arrow glow-hover glass-premium press-effect absolute left-0 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 text-white shadow-2xl opacity-70 transition-all duration-300 hover:border-red-600 hover:bg-red-600 hover:opacity-100 focus-visible:opacity-100 group-hover/section:opacity-100 group-focus-within/section:opacity-100 focus-ring sm:left-1 md:flex"
                />
                <CarouselNext
                  aria-label={t("nextSlide")}
                  className="carousel-side-arrow glow-hover glass-premium press-effect absolute right-0 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 text-white shadow-2xl opacity-70 transition-all duration-300 hover:border-red-600 hover:bg-red-600 hover:opacity-100 focus-visible:opacity-100 group-hover/section:opacity-100 group-focus-within/section:opacity-100 focus-ring sm:right-1 md:flex"
                />
              </>
            )}
          </Carousel>
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 hidden w-10 bg-gradient-to-r from-black to-transparent md:block" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 hidden w-10 bg-gradient-to-l from-black to-transparent md:block" />
          </div>
        ) : (
          <div className="glass-panel rounded-2xl py-16 px-8 text-center">
            <p className="text-gray-300 text-lg">
              {t("emptyComingSoon")}
            </p>
            <p className="text-gray-500 text-sm mt-2">{t("checkBack")}</p>
          </div>
        )}

        <div className="absolute left-0 top-16 bottom-0 w-8 bg-gradient-to-r from-black to-transparent pointer-events-none z-10 hidden md:block" />
        <div className="absolute right-0 top-16 bottom-0 w-8 bg-gradient-to-l from-black to-transparent pointer-events-none z-10 hidden md:block" />
      </section>
    );
  }
);

MovieCarousel.displayName = "MovieCarousel";

export default MovieCarousel;
