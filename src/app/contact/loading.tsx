export default function Loading() {
  return (
    <div className="min-h-screen bg-black pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="h-4 w-24 skeleton rounded-full mb-8" />
        <div className="h-10 w-48 skeleton rounded-xl mb-4" />
        <div className="h-4 w-80 skeleton rounded-full mb-10" />

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 items-start">
          <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-5">
            <div className="h-4 w-24 skeleton rounded-full" />
            <div className="h-12 w-full skeleton rounded-xl" />
            <div className="h-4 w-20 skeleton rounded-full" />
            <div className="h-12 w-full skeleton rounded-xl" />
            <div className="h-4 w-24 skeleton rounded-full" />
            <div className="h-32 w-full skeleton rounded-xl" />
            <div className="h-12 w-40 skeleton rounded-xl" />
          </div>
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass-panel rounded-2xl p-5 flex items-start gap-4">
                <div className="h-11 w-11 skeleton rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-28 skeleton rounded-full" />
                  <div className="h-3 w-40 skeleton rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
