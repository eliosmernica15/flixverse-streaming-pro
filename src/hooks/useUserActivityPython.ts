/**
 * User activity timeline backed by the Python Postgres API.
 * The activity_feed table is the single source of truth; this returns the
 * last 50 entries for the requested user.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { pythonFetch } from "@/lib/pythonApi/client";
import { isPythonBackendEnabled, useHttpTransport } from "@/lib/pythonApi/config";

export type ActivityType =
  | "review"
  | "rating"
  | "comment"
  | "watchlist"
  | "watched"
  | "follow";

export interface UserActivity {
  id: string;
  type: ActivityType;
  timestamp: string;
  contentId?: number;
  contentType?: "movie" | "tv";
  contentTitle?: string;
  contentPosterPath?: string | null;
  rating?: number;
  reviewText?: string;
  commentText?: string;
}

const POLL_MS = 20000;

function mapActivity(raw: {
  id: string;
  type: string;
  created_at: number | string;
  content_id: number | null;
  content_type: string | null;
  content_title: string | null;
  content_poster_path: string | null;
  rating: number | null;
  review_text: string | null;
}): UserActivity {
  return {
    id: raw.id,
    type: (raw.type as ActivityType) || "review",
    timestamp:
      typeof raw.created_at === "number"
        ? new Date(raw.created_at).toISOString()
        : raw.created_at,
    contentId: raw.content_id ?? undefined,
    contentType: (raw.content_type as "movie" | "tv") ?? undefined,
    contentTitle: raw.content_title ?? undefined,
    contentPosterPath: raw.content_poster_path ?? null,
    rating: raw.rating ?? undefined,
    reviewText: raw.review_text ?? undefined,
  };
}

export function usePythonUserActivity(userId?: string) {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { user } = useAuth();
  const target = userId || user?.uid;

  const refresh = useCallback(async () => {
    if (!target) return;
    try {
      const data = await pythonFetch<{
        items: {
          id: string;
          type: string;
          created_at: number | string;
          content_id: number | null;
          content_type: string | null;
          content_title: string | null;
          content_poster_path: string | null;
          rating: number | null;
          review_text: string | null;
        }[];
      }>(`/social/activity?user_id=${encodeURIComponent(target)}&limit=50`);
      setActivities((data.items || []).map((raw) => mapActivity(raw)));
    } catch (err) {
      console.error("[user-activity/python] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [target]);

  useEffect(() => {
    if (!target || !isPythonBackendEnabled()) {
      setActivities([]);
      setLoading(false);
      return;
    }
    void refresh();
    if (useHttpTransport()) {
      const poll = setInterval(() => void refresh(), POLL_MS);
      return () => clearInterval(poll);
    }
  }, [target, refresh, refreshTrigger]);

  const refetch = useCallback(() => setRefreshTrigger((t) => t + 1), []);

  const getActivitiesByType = useCallback(
    (type: ActivityType) => activities.filter((a) => a.type === type),
    [activities]
  );

  const getActivitiesGroupedByDate = useCallback(() => {
    const groups: { [date: string]: UserActivity[] } = {};
    activities.forEach((activity) => {
      const date = new Date(activity.timestamp).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(activity);
    });
    return groups;
  }, [activities]);

  const getStats = useCallback(
    () => ({
      totalReviews: activities.filter((a) => a.type === "review").length,
      totalRatings: activities.filter((a) => a.type === "rating" || a.type === "review").length,
      totalComments: activities.filter((a) => a.type === "comment").length,
      totalWatched: activities.filter((a) => a.type === "watched").length,
    }),
    [activities]
  );

  return {
    activities,
    loading,
    refetch,
    getActivitiesByType,
    getActivitiesGroupedByDate,
    getStats,
    activityCount: activities.length,
  };
}
