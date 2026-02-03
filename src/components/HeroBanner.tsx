
import { useState, useEffect } from "react";
import { Play, Star, Plus, Info, Check } from "lucide-react";
import { TMDBMovie, getBackdropUrl, getContentTitle } from "@/utils/tmdbApi";
import { useAuth } from "@/hooks/useAuth";
import { useUserMovieList } from "@/hooks/useUserMovieList";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

// Check if device prefers reduced motion or is mobile
const useOptimizedAnimations = () => {
  const [shouldOptimize, setShouldOptimize] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 768 || 'ontouchstart' in window;
    setShouldOptimize(prefersReducedMotion || isMobile);
  }, []);

  return shouldOptimize;
};

interface HeroBannerProps {
  movie: TMDBMovie;
}

const HeroBanner = ({ movie }: HeroBannerProps) => {
  const { isAuthenticated } = useAuth();
  const { addToList, isInList } = useUserMovieList();
  const { toast } = useToast();
  const router = useRouter();
  const optimizeAnimations = useOptimizedAnimations();

  const title = getContentTitle(movie);
  const backdropUrl = movie.backdrop_path ? getBackdropUrl(movie.backdrop_path, 'large') : '';
  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() :
    movie.first_air_date ? new Date(movie.first_air_date).getFullYear() : '';
  const isInMyList = isAuthenticated ? isInList(movie.id) : false;

  // Preload backdrop image for smoother experience
  useEffect(() => {
    if (backdropUrl) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = backdropUrl;
      document.head.appendChild(link);
      return () => {
        document.head.removeChild(link);
      };
    }
  }, [backdropUrl]);

  const handlePlayClick = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in or sign up to watch movies and TV shows.",
        variant: "destructive",
      });
      setTimeout(() => {
        router.push('/auth');
      }, 1500);
      return;
    }
    const contentType = movie.media_type === 'tv' ? 'tv' : 'movie';
    router.push(`/movie/${movie.id}?type=${contentType}&autoplay=true`);
  };

  const handleMoreInfo = () => {
    const contentType = movie.media_type === 'tv' ? 'tv' : 'movie';
    router.push(`/movie/${movie.id}?type=${contentType}`);
  };

  const handleAddToList = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add movies to your list",
        variant: "destructive",
      });
      return;
    }

    try {
      await addToList(movie);
      toast({
        title: "Added to list",
        description: `${title} has been added to your list`,
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="relative h-[95vh] lg:h-screen overflow-hidden">
      {/* Background Image with parallax effect */}
      <motion.div
        className="absolute inset-0 gpu-accelerated"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${backdropUrl})`,
          }}
        >
          {/* Cinematic gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/50" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black" />

          {/* Vignette effect */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,transparent,rgba(0,0,0,0.5))]" />

          {/* Noise texture for cinematic feel - reduced on mobile */}
          <div className={`absolute inset-0 noise-overlay ${optimizeAnimations ? 'opacity-[0.01]' : 'opacity-[0.015]'}`} />

          {/* Animated ambient glow - simplified on mobile */}
          {!optimizeAnimations && (
            <>
              <motion.div
                className="absolute -bottom-20 -left-20 w-96 h-96 bg-red-500/20 rounded-full blur-[100px] will-animate-opacity"
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.15, 0.25, 0.15]
                }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <motion.div
                className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[120px] will-animate-opacity"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.08, 0.15, 0.08]
                }}
                transition={{
                  duration: 12,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 2
                }}
              />
            </>
          )}
        </div>
      </motion.div>

      {/* Content */}
      <div className="relative z-10 flex items-end lg:items-center h-full pb-32 lg:pb-0">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-3xl">
            {/* Badges */}
            <motion.div
              className="flex flex-wrap items-center gap-3 mb-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className="px-4 py-1.5 bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-bold rounded-lg uppercase tracking-wider shadow-lg shadow-red-500/30">
                {movie.media_type === 'tv' ? 'Series' : 'Movie'}
              </span>
              <span className="px-4 py-1.5 glass-card text-white text-xs font-medium rounded-lg flex items-center space-x-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Featured</span>
              </span>
              {releaseYear && (
                <span className="px-4 py-1.5 glass-card text-white text-xs font-medium rounded-lg">
                  {releaseYear}
                </span>
              )}
            </motion.div>

            {/* Title */}
            <motion.h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-5 text-white leading-[1.05] tracking-tight"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {title}
            </motion.h1>

            {/* Meta info */}
            <motion.div
              className="flex flex-wrap items-center gap-4 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center space-x-2 bg-yellow-500/20 backdrop-blur-sm px-4 py-2 rounded-xl border border-yellow-500/20">
                <Star className="w-5 h-5 text-yellow-400 fill-current" />
                <span className="text-yellow-400 font-bold text-lg">{movie.vote_average?.toFixed(1)}</span>
              </div>
              <span className="px-4 py-2 glass-card text-white text-sm font-medium rounded-xl">
                {movie.media_type === 'tv' ? 'TV Series' : 'Feature Film'}
              </span>
              <span className="text-gray-400 text-sm hidden sm:inline">
                HD Available
              </span>
            </motion.div>

            {/* Overview */}
            <motion.p
              className="text-base sm:text-lg md:text-xl mb-8 text-gray-300 leading-relaxed line-clamp-3 max-w-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {movie.overview}
            </motion.p>

            {/* Action Buttons */}
            <motion.div
              className="flex flex-wrap items-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <motion.button
                onClick={handlePlayClick}
                className="group flex items-center space-x-3 bg-white text-black px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all duration-300 shadow-2xl shadow-white/20 hover:shadow-white/30 btn-shine"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                <Play className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" />
                <span>Play Now</span>
              </motion.button>

              <motion.button
                onClick={handleAddToList}
                disabled={!isAuthenticated && isInMyList}
                className="group flex items-center space-x-3 glass-premium text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white/20 transition-all duration-300"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                {isInMyList ? (
                  <Check className="w-6 h-6 text-green-400" />
                ) : (
                  <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                )}
                <span>{isInMyList ? 'In My List' : 'Add to List'}</span>
              </motion.button>

              <motion.button
                onClick={handleMoreInfo}
                className="group p-4 glass-card rounded-xl hover:bg-white/15 transition-all duration-300"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                title="More Info"
              >
                <Info className="w-6 h-6 text-white" />
              </motion.button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Bottom gradient for smooth content transition */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center space-y-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        <span className="text-xs text-gray-500 uppercase tracking-widest">Scroll to explore</span>
        <motion.div
          className="w-6 h-10 border-2 border-gray-600 rounded-full flex justify-center"
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <motion.div
            className="w-1.5 h-3 bg-red-500 rounded-full mt-2"
            animate={{ y: [0, 8, 0], opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>
      </motion.div>
    </div>
  );
};

export default HeroBanner;
