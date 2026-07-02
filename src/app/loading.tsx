export default function Loading() {
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
