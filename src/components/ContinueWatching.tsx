import { Play, X } from 'lucide-react';
import Image from 'next/image';
import { useWatchHistoryContext } from "@/contexts/WatchHistoryContext";
import { useAuth } from '@/hooks/useAuth';
import { getImageUrl } from '@/utils/tmdbApi';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ContinueWatchingSkeleton } from '@/components/skeletons/ContentSkeletons';
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
    <section className="relative content-auto animate-fade-in-up group/section">
      <div className="flex items-end justify-between mb-4 sm:mb-5">
        <div className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-red-500 mb-1">
            {t("continueEyebrow")}
          </span>
          <h2 className="row-title">{t("continueWatching")}</h2>
        </div>
      </div>

      <div className="row-shell relative -mx-1 sm:-mx-2" data-edge-left="true" data-edge-right="true">
        <Carousel
          opts={{ align: 'start', loop: false, skipSnaps: false, dragFree: true }}
          className="w-full"
        >
          <CarouselContent className="-ml-2 md:-ml-3 pb-2">
            {items.map((item) => {
              const progressPercentage = formatProgress(item.progress_seconds, item.total_duration_seconds);
              const timeLeft = formatTime(item.total_duration_seconds - item.progress_seconds);

              return (
                <CarouselItem
                  key={item.id}
                  className="pl-2 md:pl-3 basis-[75%] sm:basis-[45%] md:basis-[35%] lg:basis-[26%] xl:basis-[22%]"
                >
                  <div
                    className="netflix-card-wrap group relative cursor-pointer outline-none focus-ring"
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
                    <div className="relative aspect-video overflow-hidden rounded-md bg-gray-800/80 ring-1 ring-white/5 transition-all duration-300 group-hover:ring-white/30 group-hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.85),0_0_30px_-8px_rgba(239,68,68,0.3)]">
                      <Image
                        src={item.content_poster_path ? getImageUrl(item.content_poster_path, 'large') : '/placeholder.svg'}
                        alt={item.content_title}
                        fill
                        sizes="(max-width: 640px) 75vw, (max-width: 1024px) 35vw, 22vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />

                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
                        <div className="cta-primary !rounded-full !px-4 !py-2 !text-xs">
                          <Play className="h-4 w-4 fill-current" />
                          <span>Resume</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromHistory(item.id);
                        }}
                        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 opacity-0 transition-opacity hover:bg-red-500/90 focus-ring group-hover:opacity-100"
                        aria-label="Remove from continue watching"
                      >
                        <X className="h-3.5 w-3.5 text-white" />
                      </button>

                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 via-red-500 to-orange-400 shadow-[0_0_8px_rgba(239,68,68,0.7)] transition-all duration-300"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>

                      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
                        <p className="text-[12px] font-bold text-white truncate drop-shadow-md">
                          {item.content_title}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-300">
                          {item.season != null && item.episode != null && (
                            <>
                              <span className="font-bold text-white">S{item.season}:E{item.episode}</span>
                              <span className="meta-dot" />
                            </>
                          )}
                          <span className="text-gray-400">{timeLeft}</span>
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
                className="carousel-side-arrow press-effect absolute -left-1 sm:left-0 top-1/2 z-30 hidden h-12 w-8 -translate-y-1/2 items-center justify-center bg-gradient-to-r from-black/80 to-transparent text-white opacity-0 transition-opacity duration-300 hover:from-black/95 group-hover/section:opacity-100 group-focus-within/section:opacity-100 focus-visible:opacity-100 focus-ring md:flex"
              />
              <CarouselNext
                aria-label={t("nextSlide")}
                className="carousel-side-arrow press-effect absolute -right-1 sm:right-0 top-1/2 z-30 hidden h-12 w-8 -translate-y-1/2 items-center justify-center bg-gradient-to-l from-black/80 to-transparent text-white opacity-0 transition-opacity duration-300 hover:from-black/95 group-hover/section:opacity-100 group-focus-within/section:opacity-100 focus-visible:opacity-100 focus-ring md:flex"
              />
            </>
          )}
        </Carousel>
      </div>
    </section>
  );
};

export default ContinueWatching;
