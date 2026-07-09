export default function Loading() {
  return (
    <div className="min-h-screen bg-black pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="h-4 w-24 skeleton rounded-full mb-8" />
        <div className="h-10 w-56 skeleton rounded-xl mb-4" />
        <div className="h-4 w-72 skeleton rounded-full mb-8" />

        <div className="h-12 w-full skeleton rounded-xl mb-6" />
        <div className="flex flex-wrap gap-2 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-24 skeleton rounded-full" />
          ))}
        </div>

        <div className="glass-panel rounded-2xl divide-y divide-white/5 px-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-3 py-5">
              <div className="h-4 w-2/3 skeleton rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
