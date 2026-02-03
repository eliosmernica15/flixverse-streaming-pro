import { useState, useEffect, useCallback, useMemo } from 'react';
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

// Cache to prevent redundant fetches
const activityCache = new Map<string, { data: UserActivity[], timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

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

export const useUserActivity = (userId?: string, limitCount: number = 20) => {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { user } = useAuth();

  const targetUserId = userId || user?.uid;

  // Memoize cache key
  const cacheKey = useMemo(() => `${targetUserId}_${limitCount}`, [targetUserId, limitCount]);

  // Fetch all user activities
  useEffect(() => {
    if (!targetUserId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    const fetchAllActivities = async () => {
      // Check cache first
      const cached = activityCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL && refreshTrigger === 0) {
        setActivities(cached.data);
        setLoading(false);
        return;
      }

      setLoading(true);
      const allActivities: UserActivity[] = [];

      // Fetch each activity type independently
      const fetchReviews = async () => {
        const reviewsQuery = query(
          collection(db, 'reviews'),
          where('user_id', '==', targetUserId),
          orderBy('created_at', 'desc'),
          limit(limitCount)
        );
        const snapshot = await getDocs(reviewsQuery);
        return snapshot.docs.map(doc => {
          const review = doc.data() as Review;
          return {
            id: `review-${doc.id}`,
            type: 'review',
            timestamp: review.created_at,
            contentId: review.content_id,
            contentType: review.content_type,
            contentTitle: review.content_title,
            contentPosterPath: review.content_poster_path,
            rating: review.rating,
            reviewText: review.review_text,
          } as UserActivity;
        });
      };

      const fetchRatings = async () => {
        const ratingsQuery = query(
          collection(db, 'content_ratings'),
          where('user_id', '==', targetUserId),
          orderBy('created_at', 'desc'),
          limit(limitCount)
        );
        const snapshot = await getDocs(ratingsQuery);
        return snapshot.docs.map(doc => {
          const rating = doc.data() as ContentRating;
          return {
            id: `rating-${doc.id}`,
            type: 'rating',
            timestamp: rating.created_at,
            contentId: rating.content_id,
            contentType: rating.content_type,
            rating: rating.rating,
          } as UserActivity;
        });
      };

      const fetchComments = async () => {
        const commentsQuery = query(
          collection(db, 'comments'),
          where('user_id', '==', targetUserId),
          orderBy('created_at', 'desc'),
          limit(limitCount)
        );
        const snapshot = await getDocs(commentsQuery);
        return snapshot.docs.map(doc => {
          const comment = doc.data() as Comment;
          return {
            id: `comment-${doc.id}`,
            type: 'comment',
            timestamp: comment.created_at,
            contentId: comment.content_id,
            contentType: comment.content_type,
            commentText: comment.text,
          } as UserActivity;
        });
      };

      const fetchWatchlist = async () => {
        const watchlistQuery = query(
          collection(db, 'user_movie_lists'),
          where('user_id', '==', targetUserId),
          orderBy('added_at', 'desc'),
          limit(limitCount)
        );
        const snapshot = await getDocs(watchlistQuery);
        return snapshot.docs.map(doc => {
          const item = doc.data() as UserMovieListItem;
          return {
            id: `watchlist-${doc.id}`,
            type: 'watchlist',
            timestamp: item.added_at,
            contentId: item.movie_id,
            contentType: item.media_type || 'movie',
            contentTitle: item.movie_title,
            contentPosterPath: item.movie_poster_path,
          } as UserActivity;
        });
      };

      const fetchWatched = async () => {
        const historyQuery = query(
          collection(db, 'watch_history'),
          where('user_id', '==', targetUserId),
          where('completed', '==', true),
          orderBy('watched_at', 'desc'),
          limit(limitCount)
        );
        const snapshot = await getDocs(historyQuery);
        return snapshot.docs.map(doc => {
          const history = doc.data() as WatchHistory;
          return {
            id: `watched-${doc.id}`,
            type: 'watched',
            timestamp: history.watched_at,
            contentId: history.content_id,
            contentType: history.content_type,
            contentTitle: history.content_title,
            contentPosterPath: history.content_poster_path,
          } as UserActivity;
        });
      };

      try {
        // Use Promise.allSettled for better fault tolerance
        const results = await Promise.allSettled([
          fetchReviews(),
          fetchRatings(),
          fetchComments(),
          fetchWatchlist(),
          fetchWatched()
        ]);

        const fetchedActivities: UserActivity[] = [];

        results.forEach(result => {
          if (result.status === 'fulfilled') {
            fetchedActivities.push(...result.value);
          } else {
            console.warn('Activity fetch failed:', result.reason);
          }
        });

        // Deduplicate ratings that have reviews
        const reviewMap = new Set(
          fetchedActivities
            .filter(a => a.type === 'review')
            .map(a => `${a.contentId}-${a.contentType}`)
        );

        const filteredActivities = fetchedActivities.filter(a => {
          if (a.type === 'rating') {
            return !reviewMap.has(`${a.contentId}-${a.contentType}`);
          }
          return true;
        });

        filteredActivities.sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Cache the results
        const finalActivities = filteredActivities.slice(0, limitCount * 2);
        activityCache.set(cacheKey, { data: finalActivities, timestamp: Date.now() });
        setActivities(finalActivities);

      } catch (error) {
        console.error('Error fetching user activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllActivities();
  }, [targetUserId, refreshTrigger, limitCount, cacheKey]);

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
  // Get activity stats - memoized to prevent re-calc
  const getStats = useMemo(() => {
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


