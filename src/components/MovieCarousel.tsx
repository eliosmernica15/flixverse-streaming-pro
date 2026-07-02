"use client";

import { useState, useMemo, memo } from "react";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import MovieCard from "./MovieCard";
import { TMDBMovie } from "@/utils/tmdbApi";
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
        <div className="flex items-center justify-between mb-8 animate-fade-in-up">
          <div className="flex items-center space-x-4">
            {icon && (
              <div className="p-2.5 bg-gradient-to-br from-red-500/20 to-purple-500/10 rounded-xl border border-white/5">
                {icon}
              </div>
            )}
            <div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
                {title}
              </h2>
              <div className="flex items-center space-x-3 mt-1">
                <span className="text-sm text-gray-500">
                  {validMovies.length > 0 ? `${validMovies.length} titles` : "Upcoming releases"}
                </span>
                <span className="w-1 h-1 bg-gray-600 rounded-full" />
                <span className="text-sm text-gray-500">Updated daily</span>
              </div>
            </div>
          </div>

          {exploreAllPath && (
            <Link
              href={exploreAllPath}
              className="hidden sm:flex items-center space-x-2 text-sm text-gray-400 hover:text-white transition-all duration-200 group/btn glass-card px-4 py-2 rounded-xl hover:translate-x-0.5"
            >
              <Sparkles className="w-4 h-4 text-red-500" />
              <span>Explore All</span>
              <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </Link>
          )}
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
                  className={`absolute -left-5 top-1/2 -translate-y-1/2 w-14 h-14 glass-premium border-white/10 text-white hover:bg-red-600 hover:border-red-600 transition-all duration-300 hidden lg:flex shadow-2xl ${
                    isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
                  }`}
                />
                <CarouselNext
                  className={`absolute -right-5 top-1/2 -translate-y-1/2 w-14 h-14 glass-premium border-white/10 text-white hover:bg-red-600 hover:border-red-600 transition-all duration-300 hidden lg:flex shadow-2xl ${
                    isHovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none"
                  }`}
                />
              </>
            )}
          </Carousel>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 py-16 px-8 text-center">
            <p className="text-gray-400 text-lg">
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
