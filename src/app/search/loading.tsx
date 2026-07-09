export default function Loading() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto">
      <div className="space-y-8">
        <div className="space-y-3">
          <div className="h-9 w-72 rounded-xl skeleton" />
          <div className="h-11 w-full rounded-xl skeleton shimmer-overlay" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl skeleton shimmer-overlay" />
          ))}
        </div>
      </div>
    </div>
  );
}
