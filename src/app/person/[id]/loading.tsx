export default function Loading() {
  return (
    <div className="min-h-screen bg-black">
      <div className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-white/5" />
          <div className="h-5 w-40 rounded bg-white/5" />
        </div>
      </div>

      <div className="pt-16">
        <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
          <div className="absolute inset-0 skeleton shimmer-overlay" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
            <div className="max-w-6xl mx-auto flex items-end gap-5">
              <div className="w-28 h-28 rounded-2xl skeleton shimmer-overlay hidden sm:block" />
              <div className="flex-1 space-y-3">
                <div className="h-10 w-64 rounded-lg bg-white/5" />
                <div className="h-6 w-48 rounded-full bg-white/5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="glass-panel rounded-2xl p-6 sm:p-8 mb-12">
          <div className="h-6 w-40 rounded-lg bg-white/5 mb-4" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-white/5" />
            <div className="h-4 w-5/6 rounded bg-white/5" />
            <div className="h-4 w-4/6 rounded bg-white/5" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl skeleton shimmer-overlay" />
          ))}
        </div>
      </div>
    </div>
  );
}
