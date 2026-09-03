/**
 * User activity timeline. Routes to the Python Postgres API when enabled
 * (Vercel production) and falls back to Firestore for local dev.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  limit,
  getDocs
} from 'firebase/firestore';
import { getFirebaseDb, requireFirebaseDb } from '@/integrations/firebase/client';
import { useAuth } from './useAuth';
import { Review, Comment, ContentRating, UserMovieListItem, WatchHistory } from '@/integrations/firebase/types';
import { isPythonBackendEnabled } from '@/lib/pythonApi/config';
import { usePythonUserActivity, type UserActivity, type ActivityType } from '@/hooks/useUserActivityPython';

export type { UserActivity, ActivityType };

function useFirestoreUserActivity(userId?: string) {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { user } = useAuth();

  const targetUserId = userId || user?.uid;

  // Fetch all user activities
  useEffect(() => {
    if (!targetUserId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    const fetchAllActivities = async () => {
      setLoading(true);
      const allActivities: UserActivity[] = [];

      // Fetch each activity type independently so one failing query (e.g. missing index) doesn't block others
      const fetchReviews = async () => {
        const reviewsQuery = query(
          collection(requireFirebaseDb(), 'reviews'),
          where('user_id', '==', targetUserId),
          orderBy('created_at', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(reviewsQuery);
        snapshot.forEach((doc) => {
          const data = doc.data() as Review;
          allActivities.push({
            id: `review-${doc.id}`,
            type: 'review',
            timestamp: data.created_at,
            contentId: data.content_id,
            contentType: data.content_type,
            contentTitle: data.content_title,
            contentPosterPath: data.content_poster_path,
            rating: data.rating,
            reviewText: data.review_text,
          });
        });
      };

      const fetchRatings = async () => {
        const ratingsQuery = query(
          collection(requireFirebaseDb(), 'content_ratings'),
          where('user_id', '==', targetUserId),
          orderBy('updated_at', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(ratingsQuery);
        snapshot.forEach((doc) => {
          const data = doc.data() as ContentRating;
          allActivities.push({
            id: `rating-${doc.id}`,
            type: 'rating',
            timestamp: data.updated_at,
            contentId: data.content_id,
            contentType: data.content_type,
            contentPosterPath: null,
            rating: data.rating,
          });
        });
      };

      const fetchComments = async () => {
        const commentsQuery = query(
          collection(requireFirebaseDb(), 'comments'),
          where('user_id', '==', targetUserId),
          orderBy('created_at', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(commentsQuery);
        snapshot.forEach((doc) => {
          const data = doc.data() as Comment;
          allActivities.push({
            id: `comment-${doc.id}`,
            type: 'comment',
            timestamp: data.created_at,
            contentId: data.content_id,
            contentType: data.content_type,
            commentText: data.text,
          });
        });
      };

      const fetchWatchlist = async () => {
        const watchlistQuery = query(
          collection(requireFirebaseDb(), 'user_movie_lists'),
          where('user_id', '==', targetUserId),
          orderBy('added_at', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(watchlistQuery);
        snapshot.forEach((doc) => {
          const data = doc.data() as UserMovieListItem;
          allActivities.push({
            id: `watchlist-${doc.id}`,
            type: 'watchlist',
            timestamp: data.added_at,
            contentId: data.movie_id,
            contentType: (data.media_type as 'movie' | 'tv') || 'movie',
            contentTitle: data.movie_title,
            contentPosterPath: data.movie_poster_path,
          });
        });
      };

      const fetchWatched = async () => {
        const watchedQuery = query(
          collection(requireFirebaseDb(), 'watch_history'),
          where('user_id', '==', targetUserId),
          orderBy('watched_at', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(watchedQuery);
        snapshot.forEach((doc) => {
          const data = doc.data() as WatchHistory;
          allActivities.push({
            id: `watched-${doc.id}`,
            type: 'watched',
            timestamp: new Date(data.watched_at).toISOString(),
            contentId: data.content_id,
            contentType: data.content_type,
            contentTitle: data.content_title,
            contentPosterPath: data.content_poster_path,
          });
        });
      };

      try {
        await fetchReviews().catch((e) => console.warn('Activity: reviews fetch failed', e));
        await Promise.all([
          fetchRatings().catch((e) => console.warn('Activity: ratings fetch failed', e)),
          fetchComments().catch((e) => console.warn('Activity: comments fetch failed', e)),
          fetchWatchlist().catch((e) => console.warn('Activity: watchlist fetch failed', e)),
          fetchWatched().catch((e) => console.warn('Activity: watched fetch failed', e)),
        ]);

        allActivities.sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setActivities(allActivities.slice(0, 50));
      } catch (error) {
        console.error('Error fetching user activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllActivities();
  }, [targetUserId, refreshTrigger]);

  const refetch = useCallback(() => setRefreshTrigger((t) => t + 1), []);

  // Filter activities by type
  const getActivitiesByType = useCallback((type: ActivityType) => {
    return activities.filter(a => a.type === type);
  }, [activities]);

  // Group activities by date
  const getActivitiesGroupedByDate = useCallback(() => {
    const groups: { [date: string]: UserActivity[] } = {};

    activities.forEach(activity => {
      const date = new Date(activity.timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
    });

    return groups;
  }, [activities]);

  // Get activity stats
  const getStats = useCallback(() => {
    return {
      totalReviews: activities.filter(a => a.type === 'review').length,
      totalRatings: activities.filter(a => a.type === 'rating' || a.type === 'review').length,
      totalComments: activities.filter(a => a.type === 'comment').length,
      totalWatched: activities.filter(a => a.type === 'watched').length,
    };
  }, [activities]);

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

/** Public facade — Python first on Vercel, Firestore otherwise. */
export const useUserActivity = (userId?: string) => {
  return isPythonBackendEnabled()
    ? usePythonUserActivity(userId)
    : useFirestoreUserActivity(userId);
};
