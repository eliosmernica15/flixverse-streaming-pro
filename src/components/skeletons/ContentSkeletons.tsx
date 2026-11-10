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

export function Top10RowSkeleton() {
  return (
    <section aria-hidden="true">
      <div className="mb-4 sm:mb-5">
        <div className="mb-2 h-2.5 w-28 rounded skeleton-shimmer" />
        <div className="h-7 w-48 rounded-lg skeleton-shimmer" />
      </div>
      <div className="flex gap-3 overflow-hidden pb-4">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex shrink-0 items-end">
            <div className="-mr-6 h-24 w-12 rounded skeleton-shimmer sm:-mr-8 sm:h-32 sm:w-16" />
            <div className="w-28 sm:w-32 md:w-36 lg:w-40">
              <div className="aspect-[2/3] rounded-md skeleton-shimmer" />
              <div className="mt-2 h-3 w-4/5 rounded skeleton-shimmer" />
              <div className="mt-1.5 h-2.5 w-1/2 rounded skeleton-shimmer" />
            </div>
          </div>
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
