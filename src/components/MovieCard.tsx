import { useState, useRef, useCallback } from "react";
import { Play, Star, Heart, Film, Tv, Plus, Info } from "lucide-react";
import { getImageUrl, TMDBMovie, getContentTitle, getContentReleaseDate, getContentType } from "@/utils/tmdbApi";
import { useToast } from "@/hooks/use-toast";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useAuth } from "@/hooks/useAuth";
import { useUserMovieList } from "@/hooks/useUserMovieList";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";

interface MovieCardProps {
  movie: TMDBMovie;
  index?: number;
}

// Genre ID to name mapping
const genreNames: { [key: number]: string } = {
  28: 'Action', 35: 'Comedy', 18: 'Drama', 27: 'Horror',
  10749: 'Romance', 878: 'Sci-Fi', 53: 'Thriller', 16: 'Animation',
  14: 'Fantasy', 12: 'Adventure', 80: 'Crime', 99: 'Documentary',
  10751: 'Family', 36: 'History', 10402: 'Music', 9648: 'Mystery',
  10770: 'TV Movie', 37: 'Western', 10752: 'War', 10759: 'Action & Adventure',
  10762: 'Kids', 10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy',
  10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
};

const MovieCard = ({ movie, index = 0 }: MovieCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { addToHistory, addFavoriteGenre } = useUserPreferences();
  const { isAuthenticated } = useAuth();
  const { addToList, removeFromList, isInList, isOperating } = useUserMovieList();
  const navigate = useNavigate();

  // 3D Tilt effect values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Spring config for smooth animation
  const springConfig = { damping: 25, stiffness: 300 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [8, -8]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), springConfig);

  // Shine effect position
  const shineX = useSpring(useTransform(mouseX, [-0.5, 0.5], [0, 100]), springConfig);
  const shineY = useSpring(useTransform(mouseY, [-0.5, 0.5], [0, 100]), springConfig);
  
  const isInMyList = isAuthenticated ? isInList(movie.id) : (() => {
    const myList = JSON.parse(localStorage.getItem('myMovieList') || '[]');
    return myList.includes(movie.id);
  })();

  // Handle mouse move for 3D tilt
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const x = (event.clientX - centerX) / rect.width;
    const y = (event.clientY - centerY) / rect.height;
    
    mouseX.set(x);
    mouseY.set(y);
  }, [mouseX, mouseY]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  const handleCardClick = () => {
    addToHistory(movie.id);
    if (movie.genre_ids && movie.genre_ids.length > 0) {
      movie.genre_ids.forEach(genreId => {
        if (genreNames[genreId]) {
          addFavoriteGenre(genreNames[genreId]);
        }
      });
    }
    
    const contentType = getContentType(movie);
    navigate(`/movie/${movie.id}?type=${contentType}`);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const contentType = getContentType(movie);
    navigate(`/movie/${movie.id}?type=${contentType}&autoplay=true`);
  };

  const handleAddToListClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add movies to your list",
        variant: "destructive",
      });
      return;
    }

    const movieTitle = movie.title || movie.name || 'Unknown';
    
    try {
      if (isInMyList) {
        await removeFromList(movie.id);
        toast({
          title: "Removed from My List",
          description: `${movieTitle} has been removed from your list.`,
        });
      } else {
        await addToList(movie);
        toast({
          title: "Added to My List",
          description: `${movieTitle} has been added to your list.`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const displayTitle = getContentTitle(movie);
  const releaseDate = getContentReleaseDate(movie);
  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;
  const contentType = getContentType(movie);
  const posterUrl = movie.poster_path ? getImageUrl(movie.poster_path) : null;
  const rating = movie.vote_average || 0;
  const defaultPoster = 'https://images.unsplash.com/photo-1489599735161-8f4b80604bb9?w=300&h=450&fit=crop';
  const finalPosterUrl = (!posterUrl || imageError) ? defaultPoster : posterUrl;

  // Get primary genre
  const primaryGenre = movie.genre_ids && movie.genre_ids.length > 0 
    ? genreNames[movie.genre_ids[0]] 
    : null;

  return (
    <motion.div 
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="relative group cursor-pointer"
      style={{ perspective: 1000 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleCardClick}
    >
      {/* Card Container with 3D Tilt */}
      <motion.div 
        className="relative overflow-hidden rounded-xl bg-gray-900"
        style={{
          rotateX: isHovered ? rotateX : 0,
          rotateY: isHovered ? rotateY : 0,
          transformStyle: 'preserve-3d',
          boxShadow: isHovered 
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(239, 68, 68, 0.15)'
            : '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
        }}
        whileHover={{ scale: 1.05, zIndex: 10 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Glow Effect */}
        <motion.div
          className="absolute -inset-1 bg-gradient-to-r from-red-500/30 via-purple-500/20 to-blue-500/30 rounded-xl blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
        
        {/* Poster Image */}
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl">
          {/* Skeleton loader */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gray-800 skeleton-shimmer" />
          )}
          
          <motion.img
            src={finalPosterUrl}
            alt={displayTitle}
            className="w-full h-full object-cover"
            onError={handleImageError}
            onLoad={() => setImageLoaded(true)}
            initial={{ scale: 1 }}
            animate={{ scale: isHovered ? 1.1 : 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />

          {/* Shine Sweep Effect */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: isHovered 
                ? `radial-gradient(circle at ${shineX.get()}% ${shineY.get()}%, rgba(255,255,255,0.15) 0%, transparent 50%)`
                : 'none',
              opacity: isHovered ? 1 : 0,
            }}
          />

          {/* Shine line sweep on hover */}
          <motion.div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
          >
            <motion.div
              className="absolute w-[200%] h-full"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
                transform: 'skewX(-20deg)',
              }}
              initial={{ x: '-100%' }}
              animate={isHovered ? { x: '100%' } : { x: '-100%' }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            />
          </motion.div>
          
          {/* Content Type Badge */}
          <motion.div 
            className="absolute top-3 left-3 flex items-center space-x-1 bg-black/70 backdrop-blur-md text-white text-xs font-medium px-2.5 py-1 rounded-full border border-white/10"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            {contentType === 'tv' ? <Tv className="w-3 h-3" /> : <Film className="w-3 h-3" />}
            <span>{contentType === 'tv' ? 'Series' : 'Movie'}</span>
          </motion.div>

          {/* Rating Badge */}
          <motion.div 
            className="absolute top-3 right-3 flex items-center space-x-1 bg-yellow-500/90 backdrop-blur-sm text-black text-xs font-bold px-2 py-1 rounded-full"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Star className="w-3 h-3 fill-current" />
            <span>{rating.toFixed(1)}</span>
          </motion.div>

          {/* Genre Badge - Reveals on hover */}
          <AnimatePresence>
            {isHovered && primaryGenre && (
              <motion.div
                className="absolute top-12 left-3 bg-white/20 backdrop-blur-md text-white text-xs font-medium px-2.5 py-1 rounded-full border border-white/20"
                initial={{ opacity: 0, y: -10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                {primaryGenre}
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Gradient Overlay */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: isHovered ? 1 : 0.6 }}
            transition={{ duration: 0.3 }}
          />
          
          {/* Hover Content */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex flex-col justify-end p-4"
              >
                {/* Title & Year */}
                <motion.h3 
                  className="text-white font-bold text-base mb-1 line-clamp-2 drop-shadow-lg"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                >
                  {displayTitle}
                </motion.h3>
                {year && (
                  <motion.p 
                    className="text-gray-400 text-sm mb-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    {year}
                  </motion.p>
                )}
                
                {/* Action Buttons */}
                <motion.div 
                  className="flex items-center space-x-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <motion.button 
                    className="flex-1 flex items-center justify-center space-x-2 bg-white text-black py-2.5 rounded-lg font-semibold text-sm"
                    onClick={handlePlayClick}
                    whileHover={{ scale: 1.02, backgroundColor: "#f3f4f6" }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Play</span>
                  </motion.button>
                  
                  <motion.button 
                    className={`p-2.5 rounded-lg ${
                      isInMyList 
                        ? 'bg-red-500 text-white' 
                        : 'bg-white/20 backdrop-blur-sm text-white'
                    }`}
                    onClick={handleAddToListClick}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title={isInMyList ? "Remove from My List" : "Add to My List"}
                  >
                    <AnimatePresence mode="wait">
                      {isInMyList ? (
                        <motion.div
                          key="heart"
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0, rotate: 180 }}
                        >
                          <Heart className="w-4 h-4 fill-current" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="plus"
                          initial={{ scale: 0, rotate: 180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0, rotate: -180 }}
                        >
                          <Plus className="w-4 h-4" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>

                  <motion.button 
                    className="p-2.5 rounded-lg bg-white/20 backdrop-blur-sm text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCardClick();
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title="More Info"
                  >
                    <Info className="w-4 h-4" />
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      
      {/* Title below card (visible when not hovered) */}
      <motion.div 
        className="mt-2 px-1"
        initial={{ opacity: 1 }}
        animate={{ opacity: isHovered ? 0 : 1 }}
        transition={{ duration: 0.2 }}
      >
        <h3 className="text-white text-sm font-medium truncate">{displayTitle}</h3>
        {year && (
          <p className="text-gray-500 text-xs">{year}</p>
        )}
      </motion.div>
    </motion.div>
  );
};

export default MovieCard;
