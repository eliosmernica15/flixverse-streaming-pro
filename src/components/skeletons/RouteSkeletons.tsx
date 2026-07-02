export function CatalogGridSkeleton() {
  return (
    <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto animate-pulse">
      <div className="h-10 w-48 rounded-xl bg-white/5 mb-4" />
      <div className="h-5 w-72 rounded-lg bg-white/5 mb-10" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] rounded-2xl skeleton-shimmer" />
        ))}
      </div>
    </div>
  );
}

export function AuthPageSkeleton() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6 animate-pulse">
        <div className="flex justify-center">
          <div className="h-8 w-36 rounded-lg bg-white/5" />
        </div>
        <div className="rounded-2xl border border-white/10 p-8 space-y-5 skeleton-shimmer">
          <div className="h-6 w-40 mx-auto rounded-lg bg-white/10" />
          <div className="h-4 w-56 mx-auto rounded bg-white/5" />
          <div className="space-y-3 pt-2">
            <div className="h-11 rounded-xl bg-white/5" />
            <div className="h-11 rounded-xl bg-white/5" />
            <div className="h-11 rounded-xl bg-red-500/20" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfilePageSkeleton() {
  return (
    <div className="min-h-screen bg-black pt-20 pb-16 px-4 sm:px-6 lg:px-8 animate-pulse">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center gap-6 mb-10">
          <div className="w-28 h-28 rounded-2xl skeleton-shimmer" />
          <div className="flex-1 space-y-3 w-full text-center sm:text-left">
            <div className="h-8 w-48 mx-auto sm:mx-0 rounded-lg bg-white/5" />
            <div className="h-4 w-64 mx-auto sm:mx-0 rounded bg-white/5" />
            <div className="flex gap-2 justify-center sm:justify-start">
              <div className="h-9 w-24 rounded-xl bg-white/5" />
              <div className="h-9 w-24 rounded-xl bg-white/5" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mb-8 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-28 rounded-xl bg-white/5 shrink-0" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl skeleton-shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SearchPageSkeleton() {
  return (
    <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto animate-pulse">
      <div className="h-9 w-64 rounded-xl bg-white/5 mb-2" />
      <div className="h-4 w-40 rounded-lg bg-white/5 mb-10" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] rounded-2xl skeleton-shimmer" />
        ))}
      </div>
    </div>
  );
}

export function MovieDetailSkeleton() {
  return (
    <div className="min-h-screen bg-black animate-pulse">
      <div className="h-[55vh] sm:h-[65vh] skeleton-shimmer" />
      <div className="relative px-4 sm:px-8 lg:px-16 -mt-24 sm:-mt-32 pb-16">
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
          <div className="w-36 sm:w-44 aspect-[2/3] rounded-2xl skeleton-shimmer shrink-0 mx-auto sm:mx-0" />
          <div className="flex-1 space-y-4 pt-4 sm:pt-28">
            <div className="h-10 w-3/4 max-w-md mx-auto sm:mx-0 rounded-xl bg-white/5" />
            <div className="h-4 w-full max-w-xl mx-auto sm:mx-0 rounded bg-white/5" />
            <div className="h-4 w-5/6 max-w-lg mx-auto sm:mx-0 rounded bg-white/5" />
            <div className="flex gap-3 justify-center sm:justify-start pt-2">
              <div className="h-11 w-32 rounded-xl bg-red-500/20" />
              <div className="h-11 w-32 rounded-xl bg-white/5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
