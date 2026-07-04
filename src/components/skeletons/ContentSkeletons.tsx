interface PosterGridSkeletonProps {
  count?: number;
}

export function PosterGridSkeleton({ count = 6 }: PosterGridSkeletonProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-[2/3] rounded-xl skeleton-shimmer" />
      ))}
    </div>
  );
}

export function ContinueWatchingSkeleton() {
  return (
    <section className="relative mb-10 content-auto">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-xl skeleton-shimmer" />
        <div className="space-y-2">
          <div className="h-6 w-48 rounded-lg skeleton-shimmer" />
          <div className="h-4 w-32 rounded-lg skeleton-shimmer" />
        </div>
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shrink-0 w-[45%] sm:w-[30%] md:w-[22%] aspect-video rounded-xl skeleton-shimmer" />
        ))}
      </div>
    </section>
  );
}

export function HistoryListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-white/5">
          <div className="w-12 h-16 rounded-lg skeleton-shimmer shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded skeleton-shimmer" />
            <div className="h-3 w-1/2 rounded skeleton-shimmer" />
            <div className="h-1.5 w-full rounded-full skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}
