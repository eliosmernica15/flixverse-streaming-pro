import { Play, Clock, X } from 'lucide-react';
import Image from 'next/image';
import { useWatchHistoryContext } from "@/contexts/WatchHistoryContext";
import { useAuth } from '@/hooks/useAuth';
import { getImageUrl } from '@/utils/tmdbApi';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ContinueWatchingSkeleton } from '@/components/skeletons/ContentSkeletons';
import SectionHeader from './SectionHeader';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

const ContinueWatching = () => {
  const { getContinueWatching, removeFromHistory, loading } = useWatchHistoryContext();
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const t = useTranslations("carousel");

  const continueWatchingItems = getContinueWatching();

  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return <ContinueWatchingSkeleton />;
  }

  if (continueWatchingItems.length === 0) {
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
    const resumeParam = item.progress_seconds > 0 ? `&resume=${item.progress_seconds}` : '';
    const url = item.content_type === 'tv' && item.season && item.episode
      ? `/movie/${item.content_id}?type=${item.content_type}&autoplay=true&season=${item.season}&episode=${item.episode}${resumeParam}`
      : `/movie/${item.content_id}?type=${item.content_type}&autoplay=true${resumeParam}`;
    router.push(url);
  };

  const items = continueWatchingItems.slice(0, 12);

  return (
    <section className="relative mb-10 content-auto animate-fade-in-up group/section">
      <SectionHeader
        title={t("continueWatching")}
        eyebrow={t("continueEyebrow")}
      />

      <div className="relative px-1 sm:px-2">
        <Carousel
          opts={{ align: 'start', loop: false, skipSnaps: false, dragFree: true }}
          className="w-full"
        >
          <CarouselContent className="-ml-3 md:-ml-5">
            {items.map((item) => {
              const progressPercentage = formatProgress(item.progress_seconds, item.total_duration_seconds);
              const timeLeft = formatTime(item.total_duration_seconds - item.progress_seconds);

              return (
                <CarouselItem
                  key={item.id}
                  className="pl-3 md:pl-5 basis-[45%] sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6"
                >
                  <div
                    className="group glass-panel relative cursor-pointer overflow-hidden rounded-xl hover-lift-sm focus-ring"
                    onClick={() => handleContinue(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleContinue(item);
                      }
                    }}
                    aria-label={`Continue watching ${item.content_title}`}
                  >
                    <div className="relative aspect-video overflow-hidden bg-gray-800/80">
                      <Image
                        src={item.content_poster_path ? getImageUrl(item.content_poster_path, 'large') : '/placeholder.svg'}
                        alt={item.content_title}
                        fill
                        sizes="(max-width: 640px) 45vw, 20vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                      <div className="continue-watching-play absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-xl">
                          <Play className="h-6 w-6 fill-black text-black ml-0.5" />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromHistory(item.id);
                        }}
                        className="continue-watching-remove absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity hover:bg-red-500/80 focus-ring group-hover:opacity-100"
                        aria-label="Remove from continue watching"
                      >
                        <X className="h-3.5 w-3.5 text-white" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-800/80">
                        <div
                          className="h-full rounded-r bg-gradient-to-r from-red-500 via-red-500 to-orange-400 shadow-[0_0_10px_rgba(239,68,68,0.6)] transition-all duration-300"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 pt-6">
                        <p className="text-sm font-semibold text-white truncate drop-shadow-lg">
                          {item.content_title}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          {item.season != null && item.episode != null && (
                            <span className="text-xs text-gray-300">S{item.season} E{item.episode}</span>
                          )}
                          <span className="text-xs text-gray-400">{timeLeft}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          {items.length > 3 && (
            <>
              <CarouselPrevious
                aria-label={t("prevSlide")}
                className="carousel-side-arrow glow-hover press-effect absolute -left-2 sm:-left-4 lg:-left-5 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/80 backdrop-blur-md text-white shadow-2xl opacity-0 transition-all duration-300 hover:border-red-500 hover:bg-red-600 hover:scale-105 hover:opacity-100 focus-visible:opacity-100 group-hover/section:opacity-100 group-focus-within/section:opacity-100 focus-ring md:flex"
              />
              <CarouselNext
                aria-label={t("nextSlide")}
                className="carousel-side-arrow glow-hover press-effect absolute -right-2 sm:-right-4 lg:-right-5 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/80 backdrop-blur-md text-white shadow-2xl opacity-0 transition-all duration-300 hover:border-red-500 hover:bg-red-600 hover:scale-105 hover:opacity-100 focus-visible:opacity-100 group-hover/section:opacity-100 group-focus-within/section:opacity-100 focus-ring md:flex"
              />
            </>
          )}
        </Carousel>
      </div>
    </section>
  );
};

export default ContinueWatching;
