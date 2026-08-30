"use client";

import { memo, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getImageUrl, TMDBMovie, getContentTitle, getContentType } from "@/utils/tmdbApi";
import SectionHeader from "./SectionHeader";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface Top10RowProps {
  movies: TMDBMovie[];
  title?: string;
}

const CAROUSEL_ARROW_CLASS =
  "carousel-side-arrow glow-hover press-effect absolute top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/80 backdrop-blur-md text-white shadow-2xl transition-all duration-300 hover:border-red-500 hover:bg-red-600 hover:scale-105 focus-ring md:flex";

const Top10Row = memo(({ movies, title }: Top10RowProps) => {
  const router = useRouter();
  const t = useTranslations("carousel");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const displayTitle = title ?? t("top10Today");
  const top10 = movies.slice(0, 10);

  const handleClick = useCallback(
    (movie: TMDBMovie) => {
      const ct = getContentType(movie);
      router.push(`/movie/${movie.id}?type=${ct}`);
    },
    [router]
  );

  if (top10.length === 0) return null;

  return (
    <section
      className="relative group/section content-auto"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <SectionHeader title={displayTitle} eyebrow={t("top10Eyebrow")} />

      <div className="relative px-1 sm:px-2">
        <Carousel
          opts={{ align: "start", loop: false, dragFree: true }}
          className="w-full"
        >
          <CarouselContent className="-ml-2 sm:-ml-3">
            {top10.map((movie, index) => {
              const movieTitle = getContentTitle(movie);
              const posterUrl = movie.poster_path ? getImageUrl(movie.poster_path, "medium") : null;
              const rank = index + 1;
              const isCardHovered = hoveredIndex === index;

              return (
                <CarouselItem
                  key={movie.id}
                  className="pl-2 sm:pl-3 basis-auto"
                >
                  <div
                    className="relative flex-shrink-0 cursor-pointer group"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => handleClick(movie)}
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div
                      className={`gradient-text absolute -left-4 sm:-left-6 bottom-0 z-10 select-none transition-all duration-300 ${
                        isCardHovered ? "scale-110" : "scale-100"
                      }`}
                      style={{
                        fontFamily: "'Bebas Neue', 'Impact', sans-serif",
                        fontSize: "clamp(60px, 10vw, 120px)",
                        lineHeight: "0.85",
                        color: "transparent",
                        WebkitTextStroke: "2px rgba(255,255,255,0.3)",
                      }}
                      aria-hidden="true"
                    >
                      {rank}
                    </div>

                    <div
                      className={`hover-lift-sm relative aspect-[2/3] w-24 rounded-xl overflow-hidden transition-all duration-300 sm:w-28 md:w-32 ${
                        isCardHovered
                          ? "scale-105 shadow-2xl shadow-red-500/20 z-20"
                          : "scale-100"
                      }`}
                      style={{
                        marginLeft: `${rank === 1 ? 24 : rank >= 10 ? 8 : 16}px`,
                      }}
                    >
                      {posterUrl ? (
                        <Image
                          src={posterUrl}
                          alt={movieTitle}
                          fill
                          className="object-cover"
                          sizes="128px"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-red-600/30 to-zinc-800 flex items-center justify-center">
                          <span className="text-2xl font-bold text-white/30">{rank}</span>
                        </div>
                      )}

                      <div
                        className={`absolute inset-0 bg-gradient-to-t from-black/70 to-transparent transition-opacity ${
                          isCardHovered ? "opacity-100" : "opacity-0"
                        }`}
                      />

                      <div
                        className={`absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-xs font-black text-white transition-all ${
                          isCardHovered ? "opacity-100 scale-100" : "opacity-0 scale-75"
                        }`}
                      >
                        {rank}
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>

          {top10.length > 4 && (
            <>
              <CarouselPrevious
                aria-label={t("prevSlide")}
                className={`${CAROUSEL_ARROW_CLASS} -left-2 sm:-left-4 lg:-left-5 ${
                  isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              />
              <CarouselNext
                aria-label={t("nextSlide")}
                className={`${CAROUSEL_ARROW_CLASS} -right-2 sm:-right-4 lg:-right-5 ${
                  isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              />
            </>
          )}
        </Carousel>

        <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 hidden w-10 bg-gradient-to-r from-black to-transparent md:block" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 hidden w-10 bg-gradient-to-l from-black to-transparent md:block" />
      </div>
    </section>
  );
});

Top10Row.displayName = "Top10Row";

export default Top10Row;
