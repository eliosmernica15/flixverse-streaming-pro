import { useQuery } from "@tanstack/react-query";
import { BROWSE_CATEGORIES, normalizeBrowseMovie } from "@/utils/browseCategories";

export const BROWSE_STALE_TIME = 10 * 60 * 1000;

export async function loadBrowseCategory(category: string) {
  const config = BROWSE_CATEGORIES[category];
  if (!config) return [];

  const data = await config.fetch();
  return (data || [])
    .filter((m) => m?.id && (m.title || m.name) && m.poster_path)
    .map(normalizeBrowseMovie);
}

export function useBrowseCategory(category: string | undefined) {
  const config = category ? BROWSE_CATEGORIES[category] : null;

  return useQuery({
    queryKey: ["browse", category],
    queryFn: () => loadBrowseCategory(category!),
    enabled: Boolean(config),
    staleTime: BROWSE_STALE_TIME,
    gcTime: 30 * 60 * 1000,
  });
}

export function getBrowseCategoryConfig(category: string | undefined) {
  return category ? BROWSE_CATEGORIES[category] : null;
}
