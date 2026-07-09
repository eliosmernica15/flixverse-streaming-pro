export default function Loading() {
  return (
    <div className="min-h-screen pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto">
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl skeleton shimmer-overlay" />
          <div className="space-y-3 flex-1">
            <div className="h-8 w-64 rounded-lg skeleton" />
            <div className="h-4 w-40 rounded skeleton" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl skeleton shimmer-overlay" />
          ))}
        </div>
      </div>
    </div>
  );
}
