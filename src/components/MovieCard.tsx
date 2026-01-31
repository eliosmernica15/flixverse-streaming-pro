import { useState, useRef, useCallback } from "react";
import { Play, Star, Heart, Film, Tv, Plus, Info, Clock } from "lucide-react";
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
  const springConfig = { damping: 20, stiffness: 250 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [10, -10]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-10, 10]), springConfig);

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
    navigate(`/movie/${movie.id}?type=${contentType}`);
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

  // Rating color based on score
  const getRatingColor = (rating: number) => {
    if (rating >= 7.5) return 'from-green-500 to-emerald-500';
    if (rating >= 6) return 'from-yellow-500 to-amber-500';
    return 'from-red-500 to-orange-500';
  };

  return (
    <motion.div 
      ref={cardRef}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.04, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative group cursor-pointer"
      style={{ perspective: 1200 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleCardClick}
    >
      {/* Card Container with 3D Tilt */}
      <motion.div 
        className="relative overflow-hidden rounded-2xl bg-gray-900/50"
        style={{
          rotateX: isHovered ? rotateX : 0,
          rotateY: isHovered ? rotateY : 0,
          transformStyle: 'preserve-3d',
        }}
        whileHover={{ scale: 1.04, zIndex: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Dynamic glow effect */}
        <motion.div
          className="absolute -inset-2 rounded-2xl blur-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.4), rgba(168, 85, 247, 0.3), rgba(59, 130, 246, 0.4))',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.4 }}
        />
        
        {/* Card border glow */}
        <motion.div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.5), transparent 50%, rgba(168, 85, 247, 0.5))',
            padding: '1px',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
        
        {/* Poster Image */}
        <div className="relative aspect-[2/3] overflow-hidden rounded-2xl">
          {/* Skeleton loader */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gray-800/80 skeleton-shimmer" />
          )}
          
          <motion.img
            src={finalPosterUrl}
            alt={displayTitle}
            className="w-full h-full object-cover"
            onError={handleImageError}
            onLoad={() => setImageLoaded(true)}
            initial={{ scale: 1 }}
            animate={{ scale: isHovered ? 1.12 : 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />

          {/* Shine effect overlay */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: isHovered 
                ? `radial-gradient(circle at ${shineX.get()}% ${shineY.get()}%, rgba(255,255,255,0.2) 0%, transparent 60%)`
                : 'none',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Sweep shine animation */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                className="absolute inset-0 pointer-events-none overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="absolute w-[200%] h-full"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                    transform: 'skewX(-20deg)',
                  }}
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 0.8, ease: 'easeInOut' }}
                />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Content Type Badge */}
          <motion.div 
            className="absolute top-3 left-3 flex items-center space-x-1.5 glass-premium text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            {contentType === 'tv' ? <Tv className="w-3.5 h-3.5" /> : <Film className="w-3.5 h-3.5" />}
            <span>{contentType === 'tv' ? 'Series' : 'Movie'}</span>
          </motion.div>

          {/* Rating Badge with dynamic color */}
          <motion.div 
            className={`absolute top-3 right-3 flex items-center space-x-1.5 bg-gradient-to-r ${getRatingColor(rating)} text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-lg`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>{rating.toFixed(1)}</span>
          </motion.div>

          {/* Genre Badge - Shows on hover */}
          <AnimatePresence>
            {isHovered && primaryGenre && (
              <motion.div
                className="absolute top-14 left-3 glass-card text-white text-xs font-medium px-3 py-1.5 rounded-lg"
                initial={{ opacity: 0, y: -10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.8 }}
                transition={{ duration: 0.25 }}
              >
                {primaryGenre}
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Gradient Overlay */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent"
            initial={{ opacity: 0.5 }}
            animate={{ opacity: isHovered ? 0.95 : 0.5 }}
            transition={{ duration: 0.3 }}
          />
          
          {/* Hover Content */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="absolute inset-0 flex flex-col justify-end p-4"
              >
                {/* Title & Year */}
                <motion.h3 
                  className="text-white font-bold text-lg mb-1 line-clamp-2 drop-shadow-lg"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                >
                  {displayTitle}
                </motion.h3>
                {year && (
                  <motion.div 
                    className="flex items-center space-x-2 text-gray-400 text-sm mb-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{year}</span>
                  </motion.div>
                )}
                
                {/* Action Buttons */}
                <motion.div 
                  className="flex items-center space-x-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <motion.button 
                    className="flex-1 flex items-center justify-center space-x-2 bg-white text-black py-3 rounded-xl font-bold text-sm shadow-lg"
                    onClick={handlePlayClick}
                    whileHover={{ scale: 1.02, backgroundColor: "#f3f4f6" }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Play</span>
                  </motion.button>
                  
                  <motion.button 
                    className={`p-3 rounded-xl transition-colors ${
                      isInMyList 
                        ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white' 
                        : 'glass-card text-white hover:bg-white/20'
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
                    className="p-3 rounded-xl glass-card text-white hover:bg-white/20"
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
        className="mt-3 px-1"
        initial={{ opacity: 1 }}
        animate={{ opacity: isHovered ? 0 : 1 }}
        transition={{ duration: 0.2 }}
      >
        <h3 className="text-white text-sm font-semibold truncate">{displayTitle}</h3>
        <div className="flex items-center justify-between mt-1">
          {year && (
            <p className="text-gray-500 text-xs">{year}</p>
          )}
          <div className="flex items-center space-x-1">
            <Star className="w-3 h-3 text-yellow-500 fill-current" />
            <span className="text-gray-400 text-xs">{rating.toFixed(1)}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MovieCard;
