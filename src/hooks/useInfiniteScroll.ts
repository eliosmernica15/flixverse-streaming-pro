import { useEffect, useRef, useCallback } from "react";

interface UseInfiniteScrollOptions {
  enabled?: boolean;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  /** Distance from bottom (px) to trigger load */
  threshold?: number;
}

export function useInfiniteScroll({
  enabled = true,
  onLoadMore,
  hasMore,
  isLoading,
  threshold = 400,
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || !hasMore || isLoading) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading) {
          onLoadMore();
        }
      },
      { rootMargin: `${threshold}px` }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, hasMore, isLoading, onLoadMore, threshold]);

  return { sentinelRef };
}
