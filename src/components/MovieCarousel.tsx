
import { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import MovieCard from "./MovieCard";
import { TMDBMovie } from "@/utils/tmdbApi";
import { motion } from "framer-motion";
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
  /** When true, section is always rendered (e.g. Coming soon) even with no items. */
  showWhenEmpty?: boolean;
}

const MovieCarousel = ({ title, movies, priority = false, loading = false, icon, showWhenEmpty = false }: MovieCarouselProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const validMovies = movies.filter(movie => {
    if (!movie || !movie.id) return false;
    const hasTitle = movie.title || movie.name;
    if (!hasTitle) return false;
    if (!movie.poster_path) return false;
    return true;
  }).map(movie => ({
    ...movie,
    title: movie.title || movie.name,
    release_date: movie.release_date || movie.first_air_date
  }));

  if (loading) {
    return (
      <div className="relative">
        <div className="flex items-center space-x-3 mb-8">
          <div className="h-8 bg-white/5 rounded-xl w-48 skeleton-shimmer"></div>
        </div>
        <div className="flex space-x-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div 
              key={i} 
              className="w-48 flex-shrink-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
            >
              <div className="aspect-[2/3] bg-white/5 rounded-2xl skeleton-shimmer skeleton-glow"></div>
              <div className="mt-3 h-4 bg-white/5 rounded-lg skeleton-shimmer w-4/5"></div>
              <div className="mt-2 h-3 bg-white/5 rounded-lg skeleton-shimmer w-1/2"></div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (!validMovies.length && !showWhenEmpty) {
    return null;
  }

  return (
    <motion.section 
      className="relative group/section"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Section Header */}
      <motion.div 
        className="flex items-center justify-between mb-8"
        initial={{ opacity: 0, x: -30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <div className="flex items-center space-x-4">
          {icon && (
            <motion.div 
              className="p-2.5 bg-gradient-to-br from-red-500/20 to-purple-500/10 rounded-xl border border-white/5"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              {icon}
            </motion.div>
          )}
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
              {title}
            </h2>
            <div className="flex items-center space-x-3 mt-1">
              <span className="text-sm text-gray-500">
                {validMovies.length > 0 ? `${validMovies.length} titles` : "Upcoming releases"}
              </span>
              <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
              <span className="text-sm text-gray-500">Updated daily</span>
            </div>
          </div>
        </div>
        
        {/* Explore All Link */}
        <motion.button 
          className="hidden sm:flex items-center space-x-2 text-sm text-gray-400 hover:text-white transition-all duration-300 group/btn glass-card px-4 py-2 rounded-xl"
          whileHover={{ x: 5, scale: 1.02 }}
        >
          <Sparkles className="w-4 h-4 text-red-500" />
          <span>Explore All</span>
          <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
        </motion.button>
      </motion.div>
      
      {/* Carousel or empty state */}
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
          {validMovies.map((movie, index) => (
            <CarouselItem 
              key={`${movie.id}-${index}`} 
              className="pl-3 md:pl-5 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6"
            >
              <MovieCard movie={movie} index={index} />
            </CarouselItem>
          ))}
        </CarouselContent>
        
        {validMovies.length > 4 && (
          <>
            <CarouselPrevious 
              className={`absolute -left-5 top-1/2 -translate-y-1/2 w-14 h-14 glass-premium border-white/10 text-white hover:bg-red-600 hover:border-red-600 transition-all duration-400 hidden lg:flex shadow-2xl ${
                isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6'
              }`}
            />
            <CarouselNext 
              className={`absolute -right-5 top-1/2 -translate-y-1/2 w-14 h-14 glass-premium border-white/10 text-white hover:bg-red-600 hover:border-red-600 transition-all duration-400 hidden lg:flex shadow-2xl ${
                isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'
              }`}
            />
          </>
        )}
      </Carousel>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 py-16 px-8 text-center">
          <p className="text-gray-400 text-lg">New movies and series will appear here before they’re released.</p>
          <p className="text-gray-500 text-sm mt-2">Check back for upcoming releases.</p>
        </div>
      )}

      {/* Subtle gradient fade on edges */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black to-transparent pointer-events-none z-10 hidden lg:block" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black to-transparent pointer-events-none z-10 hidden lg:block" />
    </motion.section>
  );
};

export default MovieCarousel;
