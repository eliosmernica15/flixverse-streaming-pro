import { WatchHistory } from "@/integrations/firebase/types";

/**
 * Determines the latest watched season and episode for a specific TV show based on watch history.
 */
export function getLatestWatchedEpisode(
  history: WatchHistory[],
  contentId: number
): { season: number; episode: number } | null {
  const showHistory = history.filter(
    (h) => h.content_id === contentId && h.content_type === "tv" && h.season && h.episode
  );

  if (showHistory.length === 0) return null;

  let maxSeason = -1;
  let maxEpisode = -1;

  for (const h of showHistory) {
    if (!h.season || !h.episode) continue;
    
    // If we finished the episode, consider it watched.
    // Even if partially watched, it means they have reached this episode.
    if (h.season > maxSeason) {
      maxSeason = h.season;
      maxEpisode = h.episode;
    } else if (h.season === maxSeason && h.episode > maxEpisode) {
      maxEpisode = h.episode;
    }
  }

  return maxSeason > -1 ? { season: maxSeason, episode: maxEpisode } : null;
}

/**
 * Determines if a specific target episode is considered a spoiler.
 * An episode is a spoiler if it is beyond the user's current progress.
 * We allow viewing the *next* episode immediately after the latest watched,
 * but anything beyond that is a spoiler.
 */
export function isEpisodeSpoiler(
  history: WatchHistory[],
  contentId: number,
  targetSeason: number,
  targetEpisode: number
): boolean {
  const latest = getLatestWatchedEpisode(history, contentId);
  
  // If no history exists for this show, anything beyond S1E1 is technically a spoiler,
  // but to avoid being too aggressive, we only blur if they are jumping deep into the show.
  // We'll consider Season 1, Episode 1-3 as safe for new viewers.
  if (!latest) {
    if (targetSeason > 1) return true;
    if (targetSeason === 1 && targetEpisode > 3) return true;
    return false;
  }

  // If the target season is earlier than the latest watched season, it's not a spoiler.
  if (targetSeason < latest.season) return false;

  // If the target season is the same as the latest watched season:
  if (targetSeason === latest.season) {
    // Only episodes that are 2 or more ahead of the latest watched are spoilers.
    // e.g. if I watched S1E5, S1E6 is the next up (not spoiler), but S1E7 is a spoiler.
    return targetEpisode > latest.episode + 1;
  }

  // If the target season is strictly greater than the latest watched season:
  // We allow S(X+1)E1 if the user finished S(X), but since we don't strictly know if S(X) is finished,
  // we consider jumping to a new season a spoiler unless it's E1 of the next season.
  if (targetSeason === latest.season + 1 && targetEpisode === 1) {
    return false;
  }

  return true;
}
