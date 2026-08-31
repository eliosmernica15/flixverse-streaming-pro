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
    priority = false,
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
          <div className="flex items-center space-x-3 mb-5">
            <div className="h-7 bg-white/5 rounded-lg w-48 skeleton-shimmer" />
          </div>
          <div className="flex space-x-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-[160px] sm:w-[180px] md:w-[200px] flex-shrink-0">
                <div className="aspect-[2/3] bg-white/5 rounded-md skeleton-shimmer" />
                <div className="mt-2 h-3 bg-white/5 rounded skeleton-shimmer w-4/5" />
                <div className="mt-1.5 h-2.5 bg-white/5 rounded skeleton-shimmer w-1/2" />
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
        <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5">
          {icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/5 ring-1 ring-white/10 transition-colors group-hover/section:bg-red-500/10 group-hover/section:ring-red-500/30">
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
                  className="group/btn inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-gray-400 transition-all duration-200 hover:text-white focus-ring"
                >
                  <span>{tc("exploreAll")}</span>
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                </Link>
              ) : undefined
            }
          />
        </div>

        {validMovies.length > 0 ? (
          <div className="row-shell relative -mx-1 sm:-mx-2" data-edge-left="true" data-edge-right="true">
            <Carousel
              opts={{
                align: "start",
                loop: false,
                skipSnaps: false,
                dragFree: true,
                containScroll: "trimSnaps",
              }}
              className="w-full"
            >
              <CarouselContent className="-ml-2 md:-ml-3">
                {validMovies.map((movie, idx) => (
                  <CarouselItem
                    key={movie.id}
                    className="pl-2 md:pl-3 basis-[42%] sm:basis-[28%] md:basis-[22%] lg:basis-[18%] xl:basis-[15%] 2xl:basis-[13.5%]"
                  >
                    <MovieCard movie={movie} comingSoon={comingSoon} priority={priority && idx < 6} />
                  </CarouselItem>
                ))}
              </CarouselContent>

              {validMovies.length > 4 && (
                <>
                  <CarouselPrevious
                    aria-label={t("prevSlide")}
                    className="hidden md:inline-flex"
                  />
                  <CarouselNext
                    aria-label={t("nextSlide")}
                    className="hidden md:inline-flex"
                  />
                </>
              )}
            </Carousel>
          </div>
        ) : (
          <div className="glass-soft rounded-2xl py-12 px-8 text-center">
            <p className="text-gray-300 text-base font-medium">
              {t("emptyComingSoon")}
            </p>
            <p className="text-gray-500 text-sm mt-1">{t("checkBack")}</p>
          </div>
        )}
      </section>
    );
  }
);

MovieCarousel.displayName = "MovieCarousel";

export default MovieCarousel;
