import { Play, Clock, X } from 'lucide-react';
import { useWatchHistory } from '@/hooks/useWatchHistory';
import { useAuth } from '@/hooks/useAuth';
import { getImageUrl } from '@/utils/tmdbApi';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

const ContinueWatching = () => {
  const { getContinueWatching, removeFromHistory, loading } = useWatchHistory();
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const continueWatchingItems = getContinueWatching();

  if (!isAuthenticated || loading || continueWatchingItems.length === 0) {
    return null;
  }

  const formatProgress = (progress: number, total: number) => {
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.round((progress / total) * 100));
  };

  const formatTime = (seconds: number) => {
    if (seconds == null || seconds < 0) return '—';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const handleContinue = (item: typeof continueWatchingItems[0]) => {
    // Pass resume position in URL params
    const resumeParam = item.progress_seconds > 0 ? `&resume=${item.progress_seconds}` : '';
    const url = item.content_type === 'tv' && item.season && item.episode
      ? `/movie/${item.content_id}?type=${item.content_type}&autoplay=true&season=${item.season}&episode=${item.episode}${resumeParam}`
      : `/movie/${item.content_id}?type=${item.content_type}&autoplay=true${resumeParam}`;
    router.push(url);
  };

  const items = continueWatchingItems.slice(0, 12);

  return (
    <motion.section
      className="relative mb-10"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="flex items-center space-x-4 mb-6">
        <div className="p-2.5 bg-gradient-to-br from-red-500/20 to-orange-500/10 rounded-xl border border-white/5">
          <Clock className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight">
            Continue Watching
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Pick up where you left off</p>
        </div>
      </div>

      <Carousel
        opts={{ align: 'start', loop: false, skipSnaps: false, dragFree: true }}
        className="w-full"
      >
        <CarouselContent className="-ml-3 md:-ml-5">
          {items.map((item, index) => {
            const progressPercentage = formatProgress(item.progress_seconds, item.total_duration_seconds);
            const timeLeft = formatTime(item.total_duration_seconds - item.progress_seconds);

            return (
              <CarouselItem
                key={item.id}
                className="pl-3 md:pl-5 basis-[45%] sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6"
              >
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.04 }}
                  className="relative group cursor-pointer"
                  onClick={() => handleContinue(item)}
                >
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-800/80 border border-white/5 shadow-lg hover:border-white/10 transition-all duration-300 carousel-item">
                    <img
                      src={item.content_poster_path ? getImageUrl(item.content_poster_path, 'large') : '/placeholder.svg'}
                      alt={item.content_title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-14 h-14 bg-white/95 rounded-full flex items-center justify-center shadow-xl">
                        <Play className="w-6 h-6 text-black fill-black ml-0.5" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromHistory(item.id);
                      }}
                      className="absolute top-2 right-2 p-2 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 z-10"
                      aria-label="Remove from continue watching"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-800">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-r transition-all duration-300"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3 pt-6">
                      <p className="text-white text-sm font-semibold truncate drop-shadow-lg">
                        {item.content_title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {item.season != null && item.episode != null && (
                          <span className="text-xs text-gray-300">S{item.season} E{item.episode}</span>
                        )}
                        <span className="text-xs text-gray-400">{timeLeft}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
        {items.length > 3 && (
          <>
            <CarouselPrevious className="-left-2 sm:-left-5 top-1/2 -translate-y-1/2 w-12 h-12 glass-premium border-white/10 text-white hover:bg-red-600/20 hover:border-red-500/30 hidden lg:flex" />
            <CarouselNext className="-right-2 sm:-right-5 top-1/2 -translate-y-1/2 w-12 h-12 glass-premium border-white/10 text-white hover:bg-red-600/20 hover:border-red-500/30 hidden lg:flex" />
          </>
        )}
      </Carousel>
    </motion.section>
  );
};

export default ContinueWatching;
