
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
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
}

const MovieCarousel = ({ title, movies, priority = false, loading = false, icon }: MovieCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
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
        <div className="flex items-center space-x-3 mb-6">
          <div className="h-7 bg-white/10 rounded-lg w-40 skeleton-shimmer"></div>
        </div>
        <div className="flex space-x-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div 
              key={i} 
              className="w-44 flex-shrink-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
            >
              <div className="aspect-[2/3] bg-white/5 rounded-xl skeleton-shimmer skeleton-glow"></div>
              <div className="mt-2 h-4 bg-white/5 rounded skeleton-shimmer w-3/4"></div>
              <div className="mt-1 h-3 bg-white/5 rounded skeleton-shimmer w-1/2"></div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (!validMovies.length) {
    return null;
  }

  return (
    <motion.div 
      className="relative group"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Section Header */}
      <motion.div 
        className="flex items-center justify-between mb-6"
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="flex items-center space-x-3">
          {icon && (
            <motion.div 
              className="p-2 bg-red-500/20 rounded-lg"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              {icon}
            </motion.div>
          )}
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight">
            {title}
          </h2>
          <div className="hidden sm:flex items-center space-x-2 ml-4">
            <span className="text-sm text-gray-500">{validMovies.length} titles</span>
          </div>
        </div>
        
        {/* See All Link */}
        <motion.button 
          className="hidden sm:flex items-center space-x-1 text-sm text-gray-400 hover:text-white transition-colors group/btn"
          whileHover={{ x: 5 }}
        >
          <span>Explore All</span>
          <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
        </motion.button>
      </motion.div>
      
      {/* Carousel */}
      <Carousel
        opts={{
          align: "start",
          loop: validMovies.length > 3,
          skipSnaps: false,
          dragFree: true,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {validMovies.map((movie, index) => (
            <CarouselItem 
              key={`${movie.id}-${index}`} 
              className="pl-2 md:pl-4 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6"
            >
              <MovieCard movie={movie} index={index} />
            </CarouselItem>
          ))}
        </CarouselContent>
        
        {validMovies.length > 4 && (
          <>
            <CarouselPrevious 
              className={`absolute -left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/90 border-white/10 text-white hover:bg-red-600 hover:border-red-600 transition-all duration-300 hidden lg:flex ${
                isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
              }`}
            />
            <CarouselNext 
              className={`absolute -right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/90 border-white/10 text-white hover:bg-red-600 hover:border-red-600 transition-all duration-300 hidden lg:flex ${
                isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
              }`}
            />
          </>
        )}
      </Carousel>
    </motion.div>
  );
};

export default MovieCarousel;
