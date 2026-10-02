export default function Loading() {
  return (
    <div className="min-h-screen bg-black pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="h-4 w-24 skeleton rounded-full mb-8" />
        <div className="h-10 w-72 skeleton rounded-xl mb-4" />
        <div className="h-4 w-96 skeleton rounded-full mb-12" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-panel rounded-2xl p-6 lg:p-8">
              <div className="h-12 w-12 skeleton rounded-xl mb-4" />
              <div className="h-5 w-28 skeleton rounded-full mb-2" />
              <div className="h-3 w-40 skeleton rounded-full mb-6" />
              <div className="h-8 w-24 skeleton rounded-xl mb-6" />
              <div className="space-y-3">
                {[0, 1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-3 w-full skeleton rounded-full" />
                ))}
              </div>
              <div className="h-11 w-full skeleton rounded-xl mt-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
