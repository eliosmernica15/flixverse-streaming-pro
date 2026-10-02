import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchRouteData } from "@/lib/prefetch-routes";

export function useRoutePrefetch() {
  const queryClient = useQueryClient();

  return useCallback(
    (path: string) => {
      prefetchRouteData(queryClient, path);
    },
    [queryClient]
  );
}
