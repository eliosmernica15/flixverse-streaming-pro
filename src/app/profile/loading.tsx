export default function Loading() {
  return (
    <div className="min-h-screen bg-black pt-20 pb-16 px-4 sm:px-6 lg:px-8 animate-pulse">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center gap-6 mb-10">
          <div className="w-28 h-28 rounded-2xl skeleton shimmer-overlay" />
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl skeleton shimmer-overlay" />
          ))}
        </div>
      </div>
    </div>
  );
}
