export default function OfflineLibraryLoading() {
  return (
    <div className="pt-20 min-h-screen px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto">
      <div className="h-32 rounded-2xl skeleton-shimmer mb-8" />
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] rounded-2xl skeleton-shimmer" />
        ))}
      </div>
    </div>
  );
}
