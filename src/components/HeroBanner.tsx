
import { Play, Star, Plus, Info, Check } from "lucide-react";
import { TMDBMovie, getImageUrl, getContentTitle } from "@/utils/tmdbApi";
import { useAuth } from "@/hooks/useAuth";
import { useUserMovieList } from "@/hooks/useUserMovieList";
import { useToast } from "@/hooks/use-toast";

interface HeroBannerProps {
  movie: TMDBMovie;
}

const HeroBanner = ({ movie }: HeroBannerProps) => {
  const { isAuthenticated } = useAuth();
  const { addToList, isInList } = useUserMovieList();
  const { toast } = useToast();

  const title = getContentTitle(movie);
  const backdropUrl = movie.backdrop_path ? getImageUrl(movie.backdrop_path, 'original') : '';
  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : 
                     movie.first_air_date ? new Date(movie.first_air_date).getFullYear() : '';
  const isInMyList = isAuthenticated ? isInList(movie.id) : false;

  const handlePlayClick = () => {
    window.open(`/movie/${movie.id}?autoplay=true`, '_blank');
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
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };
  return (
    <div className="relative h-[90vh] lg:h-screen overflow-hidden">
      {/* Background Image with Ken Burns effect */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 animate-pulse-slow"
        style={{ 
          backgroundImage: `url(${backdropUrl})`,
          animation: 'kenburns 20s ease-in-out infinite alternate'
        }}
      >
        {/* Multi-layer gradient for depth */}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent"></div>
        
        {/* Subtle animated overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.3)_100%)]"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex items-center h-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-3xl">
            {/* Content type badge */}
            <div className="inline-flex items-center space-x-2 mb-4 animate-fade-in">
              <span className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full uppercase tracking-wider">
                {movie.media_type === 'tv' ? 'Series' : 'Movie'}
              </span>
              <span className="px-3 py-1 bg-white/10 backdrop-blur-sm text-white text-xs font-medium rounded-full">
                Featured
              </span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-6 text-white leading-[1.1] tracking-tight animate-fade-in">
              {title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6 animate-fade-in">
              <div className="flex items-center space-x-1.5 bg-yellow-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="text-yellow-400 font-semibold">{movie.vote_average?.toFixed(1)}</span>
              </div>
              {releaseYear && (
                <span className="px-3 py-1.5 bg-white/10 backdrop-blur-sm text-white text-sm font-medium rounded-full">
                  {releaseYear}
                </span>
              )}
              <span className="px-3 py-1.5 bg-white/10 backdrop-blur-sm text-white text-sm font-medium rounded-full">
                {movie.media_type === 'tv' ? 'TV Series' : 'Movie'}
              </span>
            </div>

            <p className="text-base sm:text-lg md:text-xl mb-8 text-gray-300 leading-relaxed line-clamp-3 max-w-2xl animate-fade-in">
              {movie.overview}
            </p>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 animate-fade-in">
              <button 
                onClick={handlePlayClick}
                className="group flex items-center space-x-3 bg-white text-black px-6 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-base sm:text-lg hover:bg-gray-100 transition-all duration-300 hover:scale-105 shadow-2xl shadow-white/20"
              >
                <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current group-hover:scale-110 transition-transform" />
                <span>Play Now</span>
              </button>
              
              <button 
                onClick={handleAddToList}
                disabled={!isAuthenticated && isInMyList}
                className="group flex items-center space-x-3 bg-white/15 backdrop-blur-md text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full font-semibold text-base sm:text-lg hover:bg-white/25 transition-all duration-300 hover:scale-105 border border-white/20"
              >
                {isInMyList ? (
                  <Check className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                ) : (
                  <Plus className="w-5 h-5 sm:w-6 sm:h-6 group-hover:rotate-90 transition-transform duration-300" />
                )}
                <span>{isInMyList ? 'In My List' : 'Add to List'}</span>
              </button>

              <button 
                className="group p-3 sm:p-4 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-all duration-300 hover:scale-110 border border-white/10"
              >
                <Info className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade for smooth transition to content */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none"></div>
      
      {/* Decorative elements */}
      <div className="absolute bottom-20 right-10 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-40 right-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <style>{`
        @keyframes kenburns {
          from { transform: scale(1); }
          to { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};

export default HeroBanner;
