"use client";

import { useState, useMemo, memo } from "react";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import MovieCard from "./MovieCard";
import SectionHeader from "./SectionHeader";
import { TMDBMovie } from "@/utils/tmdbApi";
import { useRoutePrefetch } from "@/hooks/useRoutePrefetch";
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
    const [isHovered, setIsHovered] = useState(false);
    const prefetchRoute = useRoutePrefetch();

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
      <section
        className="relative group/section content-auto"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          {icon && (
            <div className="gradient-border flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-gradient-to-br from-red-500/15 to-purple-500/10">
              {icon}
            </div>
          )}
          <SectionHeader
            className="min-w-0 flex-1"
            title={title}
            eyebrow={validMovies.length > 0 ? `${validMovies.length} titles` : undefined}
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
                  <span>Explore All</span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                </Link>
              ) : undefined
            }
          />
        </div>

        {validMovies.length > 0 ? (
          <Carousel
            opts={{
              align: "start",
              loop: validMovies.length > 4,
              skipSnaps: false,
              dragFree: true,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-3 md:-ml-5">
              {validMovies.map((movie) => (
                <CarouselItem
                  key={movie.id}
                  className="pl-3 md:pl-5 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6"
                >
                  <MovieCard movie={movie} comingSoon={comingSoon} />
                </CarouselItem>
              ))}
            </CarouselContent>

            {validMovies.length > 4 && (
              <>
                <CarouselPrevious
                  className={`glow-hover glass-premium press-effect absolute -left-5 top-1/2 z-10 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 text-white transition-all duration-300 hover:bg-red-600 hover:border-red-600 shadow-2xl focus-ring lg:flex ${
                    isHovered ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0 pointer-events-none"
                  }`}
                />
                <CarouselNext
                  className={`glow-hover glass-premium press-effect absolute -right-5 top-1/2 z-10 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 text-white transition-all duration-300 hover:bg-red-600 hover:border-red-600 shadow-2xl focus-ring lg:flex ${
                    isHovered ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0 pointer-events-none"
                  }`}
                />
              </>
            )}
          </Carousel>
        ) : (
          <div className="glass-panel rounded-2xl py-16 px-8 text-center">
            <p className="text-gray-300 text-lg">
              New movies and series will appear here before they’re released.
            </p>
            <p className="text-gray-500 text-sm mt-2">Check back for upcoming releases.</p>
          </div>
        )}

        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black to-transparent pointer-events-none z-10 hidden lg:block" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black to-transparent pointer-events-none z-10 hidden lg:block" />
      </section>
    );
  }
);

MovieCarousel.displayName = "MovieCarousel";

export default MovieCarousel;
