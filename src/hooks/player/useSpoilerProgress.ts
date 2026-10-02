import { useMemo } from 'react';
import { useWatchHistory } from '@/hooks/useWatchHistory';
import { isEpisodeSpoiler } from '@/lib/spoiler/episodeProgress';

export function useSpoilerProgress(contentId: number, targetSeason: number, targetEpisode: number) {
  const { history, loading } = useWatchHistory();

  const isSpoiler = useMemo(() => {
    if (loading) return false; // Default to false while loading to prevent flashes
    return isEpisodeSpoiler(history, contentId, targetSeason, targetEpisode);
  }, [history, loading, contentId, targetSeason, targetEpisode]);

  return { isSpoiler, loading };
}
