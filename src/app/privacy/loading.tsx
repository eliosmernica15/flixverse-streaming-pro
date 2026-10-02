export default function Loading() {
  return (
    <div className="min-h-screen bg-black pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="h-4 w-24 skeleton rounded-full mb-8" />
        <div className="grid lg:grid-cols-[200px_minmax(0,1fr)] gap-10">
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-7 w-36 skeleton rounded-full" />
            ))}
          </div>
          <div>
            <div className="h-10 w-64 skeleton rounded-xl mb-4" />
            <div className="h-4 w-40 skeleton rounded-full mb-8" />
            <div className="glass-panel rounded-2xl p-6 sm:p-10 space-y-8">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-3">
                  <div className="h-6 w-56 skeleton rounded-xl" />
                  <div className="h-3 w-full skeleton rounded-full" />
                  <div className="h-3 w-full skeleton rounded-full" />
                  <div className="h-3 w-2/3 skeleton rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
