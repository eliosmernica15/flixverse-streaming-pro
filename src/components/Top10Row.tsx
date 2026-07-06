"use client";

import { memo, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getImageUrl, TMDBMovie, getContentTitle, getContentType } from "@/utils/tmdbApi";

interface Top10RowProps {
  movies: TMDBMovie[];
  title?: string;
}

const Top10Row = memo(({ movies, title = "Top 10 Today" }: Top10RowProps) => {
  const router = useRouter();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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
    <section className="content-auto">
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight">
          {title}
        </h2>
      </div>

      <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-4 scrollbar-hide">
        {top10.map((movie, index) => {
          const title = getContentTitle(movie);
          const posterUrl = movie.poster_path ? getImageUrl(movie.poster_path, "medium") : null;
          const rank = index + 1;
          const isHovered = hoveredIndex === index;

          return (
            <div
              key={movie.id}
              className="relative flex-shrink-0 cursor-pointer group"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => handleClick(movie)}
              style={{
                animationDelay: `${index * 60}ms`,
              }}
            >
              {/* Oversized rank number */}
              <div
                className={`absolute -left-4 sm:-left-6 bottom-0 z-10 transition-all duration-300 select-none ${
                  isHovered ? "scale-110" : "scale-100"
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

              {/* Poster */}
              <div
                className={`relative w-24 sm:w-28 md:w-32 aspect-[2/3] rounded-xl overflow-hidden transition-all duration-300 ${
                  isHovered
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
                    alt={title}
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

                {/* Hover overlay */}
                <div
                  className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent transition-opacity ${
                    isHovered ? "opacity-100" : "opacity-0"
                  }`}
                />

                {/* Rank badge on hover */}
                <div
                  className={`absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-xs font-black text-white transition-all ${
                    isHovered ? "opacity-100 scale-100" : "opacity-0 scale-75"
                  }`}
                >
                  {rank}
                </div>
              </div>

              {/* Title (appears on hover) */}
              <div
                className={`absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap transition-all duration-200 ${
                  isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                }`}
              >
                <p className="text-xs font-semibold text-white bg-black/80 px-2 py-1 rounded-md backdrop-blur-sm border border-white/10">
                  {title}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});

Top10Row.displayName = "Top10Row";

export default Top10Row;
