import { Play, Clock, X } from 'lucide-react';
import { useWatchHistory } from '@/hooks/useWatchHistory';
import { useAuth } from '@/hooks/useAuth';
import { getImageUrl } from '@/utils/tmdbApi';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const ContinueWatching = () => {
  const { getContinueWatching, removeFromHistory, loading } = useWatchHistory();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const continueWatchingItems = getContinueWatching();

  if (!isAuthenticated || loading || continueWatchingItems.length === 0) {
    return null;
  }

  const formatProgress = (progress: number, total: number) => {
    const percentage = Math.round((progress / total) * 100);
    return percentage;
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    }
    return `${minutes}m left`;
  };

  const handleContinue = (item: typeof continueWatchingItems[0]) => {
    const url = item.content_type === 'tv' && item.season && item.episode
      ? `/movie/${item.content_id}?type=${item.content_type}&autoplay=true`
      : `/movie/${item.content_id}?type=${item.content_type}&autoplay=true`;
    navigate(url);
  };

  return (
    <div className="mb-8">
      <h2 className="text-xl md:text-2xl font-bold text-white mb-4 flex items-center space-x-2">
        <Clock className="w-5 h-5 text-red-500" />
        <span>Continue Watching</span>
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        <AnimatePresence>
          {continueWatchingItems.slice(0, 6).map((item) => {
            const progressPercentage = formatProgress(item.progress_seconds, item.total_duration_seconds);
            const timeLeft = formatTime(item.total_duration_seconds - item.progress_seconds);

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative group cursor-pointer"
                onClick={() => handleContinue(item)}
              >
                <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-800">
                  <img
                    src={item.content_poster_path ? getImageUrl(item.content_poster_path) : '/placeholder.svg'}
                    alt={item.content_title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  
                  {/* Play Button */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                      <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromHistory(item.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>

                  {/* Progress Bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                    <div 
                      className="h-full bg-red-500 transition-all"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>

                  {/* Info */}
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-white text-xs font-medium truncate mb-0.5">
                      {item.content_title}
                    </p>
                    {item.season && item.episode && (
                      <p className="text-gray-400 text-[10px]">
                        S{item.season} E{item.episode}
                      </p>
                    )}
                    <p className="text-gray-500 text-[10px]">{timeLeft}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ContinueWatching;
