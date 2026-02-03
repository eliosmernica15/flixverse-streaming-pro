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
import { db } from '@/integrations/firebase/client';
import { useAuth } from './useAuth';
import { Review, Comment, ContentRating, UserMovieListItem, WatchHistory } from '@/integrations/firebase/types';

export type ActivityType = 'review' | 'rating' | 'comment' | 'watchlist' | 'watched';

export interface UserActivity {
  id: string;
  type: ActivityType;
  timestamp: string;
  // Content info
  contentId?: number;
  contentType?: 'movie' | 'tv';
  contentTitle?: string;
  contentPosterPath?: string | null;
  // Type-specific data
  rating?: number;
  reviewText?: string;
  commentText?: string;
}

export const useUserActivity = (userId?: string) => {
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
          collection(db, 'reviews'),
          where('user_id', '==', targetUserId),
          orderBy('created_at', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(reviewsQuery);
        snapshot.forEach((doc) => {
          const review = doc.data() as Review;
          allActivities.push({
            id: `review-${doc.id}`,
            type: 'review',
            timestamp: review.created_at,
            contentId: review.content_id,
            contentType: review.content_type,
            contentTitle: review.content_title,
            contentPosterPath: review.content_poster_path,
            rating: review.rating,
            reviewText: review.review_text,
          });
        });
      };

      const fetchRatings = async () => {
        const ratingsQuery = query(
          collection(db, 'content_ratings'),
          where('user_id', '==', targetUserId),
          orderBy('created_at', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(ratingsQuery);
        snapshot.forEach((doc) => {
          const rating = doc.data() as ContentRating;
          const hasReview = allActivities.some(
            a => a.type === 'review' && a.contentId === rating.content_id && a.contentType === rating.content_type
          );
          if (!hasReview) {
            allActivities.push({
              id: `rating-${doc.id}`,
              type: 'rating',
              timestamp: rating.created_at,
              contentId: rating.content_id,
              contentType: rating.content_type,
              rating: rating.rating,
            });
          }
        });
      };

      const fetchComments = async () => {
        const commentsQuery = query(
          collection(db, 'comments'),
          where('user_id', '==', targetUserId),
          orderBy('created_at', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(commentsQuery);
        snapshot.forEach((doc) => {
          const comment = doc.data() as Comment;
          allActivities.push({
            id: `comment-${doc.id}`,
            type: 'comment',
            timestamp: comment.created_at,
            contentId: comment.content_id,
            contentType: comment.content_type,
            commentText: comment.text,
          });
        });
      };

      const fetchWatchlist = async () => {
        const watchlistQuery = query(
          collection(db, 'user_movie_lists'),
          where('user_id', '==', targetUserId),
          orderBy('added_at', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(watchlistQuery);
        snapshot.forEach((doc) => {
          const item = doc.data() as UserMovieListItem;
          allActivities.push({
            id: `watchlist-${doc.id}`,
            type: 'watchlist',
            timestamp: item.added_at,
            contentId: item.movie_id,
            contentType: item.media_type || 'movie',
            contentTitle: item.movie_title,
            contentPosterPath: item.movie_poster_path,
          });
        });
      };

      const fetchWatched = async () => {
        const historyQuery = query(
          collection(db, 'watch_history'),
          where('user_id', '==', targetUserId),
          where('completed', '==', true),
          orderBy('watched_at', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(historyQuery);
        snapshot.forEach((doc) => {
          const history = doc.data() as WatchHistory;
          allActivities.push({
            id: `watched-${doc.id}`,
            type: 'watched',
            timestamp: history.watched_at,
            contentId: history.content_id,
            contentType: history.content_type,
            contentTitle: history.content_title,
            contentPosterPath: history.content_poster_path,
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
};
