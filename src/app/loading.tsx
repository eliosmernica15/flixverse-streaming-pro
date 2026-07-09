export default function Loading() {
  return (
    <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto animate-fade-in-up">
      {/* Cinematic hero placeholder */}
      <div className="relative h-[42vh] sm:h-[52vh] rounded-3xl skeleton-card mb-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 sm:p-10 w-full max-w-2xl space-y-4">
          <div className="skeleton-text h-10 w-2/3 rounded-lg" />
          <div className="skeleton-text h-4 w-full rounded" />
          <div className="skeleton-text h-4 w-5/6 rounded" />
          <div className="flex flex-wrap gap-3 pt-2">
            <div className="h-12 w-32 rounded-xl bg-red-500/20" />
            <div className="h-12 w-32 rounded-xl bg-white/10" />
          </div>
        </div>
      </div>

      {/* Section title placeholder */}
      <div className="skeleton-text h-7 w-48 rounded-lg mb-6" />

      {/* Content grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] rounded-2xl skeleton-card" />
        ))}
      </div>
    </div>
  );
}
