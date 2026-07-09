export default function Loading() {
  return (
    <div className="min-h-screen bg-black">
      <div className="h-[55vh] sm:h-[65vh] skeleton shimmer-overlay" />
      <div className="relative px-4 sm:px-8 lg:px-16 -mt-24 sm:-mt-32 pb-16">
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
          <div className="w-36 sm:w-44 aspect-[2/3] rounded-2xl skeleton shimmer-overlay shrink-0 mx-auto sm:mx-0" />
          <div className="flex-1 space-y-4 pt-4 sm:pt-28">
            <div className="h-10 w-3/4 max-w-md mx-auto sm:mx-0 rounded-xl bg-white/5" />
            <div className="h-4 w-full max-w-xl mx-auto sm:mx-0 rounded bg-white/5" />
            <div className="h-4 w-5/6 max-w-lg mx-auto sm:mx-0 rounded bg-white/5" />
            <div className="flex gap-3 justify-center sm:justify-start pt-2">
              <div className="h-11 w-32 rounded-xl bg-red-500/20" />
              <div className="h-11 w-32 rounded-xl bg-white/5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
