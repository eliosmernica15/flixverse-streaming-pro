import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  limit,
  increment
} from 'firebase/firestore';
import { getFirebaseDb, requireFirebaseDb } from '@/integrations/firebase/client';
import { useAuth } from './useAuth';
import { useUserProfileContext } from '@/contexts/UserProfileContext';
import { useToast } from '@/hooks/use-toast';
import { Review } from '@/integrations/firebase/types';
import { enqueuePendingJob } from '@/lib/pendingJobs';
import { isPythonBackendEnabled } from '@/lib/pythonApi/config';
import { usePythonReviews } from '@/hooks/useReviewsPython';

function useFirestoreReviews(contentId?: number, contentType?: 'movie' | 'tv') {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [likedReviewIds, setLikedReviewIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();
  const { profile } = useUserProfileContext();
  const { toast } = useToast();

  // Fetch reviews for a specific content
  useEffect(() => {
    // Reset userReview when content changes
    setUserReview(null);
    
    if (!contentId || !contentType) {
      setReviews([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Use simpler query without orderBy to avoid composite index issues
    const q = query(
      collection(requireFirebaseDb(), 'reviews'),
      where('content_id', '==', contentId),
      where('content_type', '==', contentType),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reviewsList: Review[] = [];
      snapshot.forEach((docSnapshot) => {
        const review = { id: docSnapshot.id, ...docSnapshot.data() } as Review;
        reviewsList.push(review);
        // Check if this is the user's review
        if (user && review.user_id === user.uid) {
          setUserReview(review);
        }
      });
      // Sort client-side to avoid composite index issues
      reviewsList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setReviews(reviewsList);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching reviews:', error);
      if (error.code === 'failed-precondition') {
        toast({
          title: 'Reviews temporarily unavailable',
          description: 'A required database index is missing. The team has been notified.',
          variant: 'destructive',
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [contentId, contentType, user]);

  useEffect(() => {
    if (!user || !isAuthenticated || reviews.length === 0) {
      setLikedReviewIds(new Set());
      return;
    }

    const db = getFirebaseDb();
    if (!db) return;

    const reviewIds = new Set(reviews.map((review) => review.id));
    let cancelled = false;

    const loadLikedReviews = async () => {
      try {
        const likesQuery = query(
          collection(db, 'review_likes'),
          where('user_id', '==', user.uid)
        );
        const snapshot = await getDocs(likesQuery);
        if (cancelled) return;

        const liked = new Set<string>();
        snapshot.forEach((docSnapshot) => {
          const reviewId = docSnapshot.data().review_id as string;
          if (reviewIds.has(reviewId)) {
            liked.add(reviewId);
          }
        });
        setLikedReviewIds(liked);
      } catch (error) {
        console.error('Error loading review likes:', error);
        if (!cancelled) setLikedReviewIds(new Set());
      }
    };

    void loadLikedReviews();

    return () => {
      cancelled = true;
    };
  }, [user, isAuthenticated, reviews]);

  // Add a new review
  const addReview = async (
    contentId: number,
    contentType: 'movie' | 'tv',
    contentTitle: string,
    contentPosterPath: string | null,
    rating: number,
    reviewText: string
  ) => {
    if (!user || !profile) {
      throw new Error('User must be logged in to write a review');
    }

    // Check if user already has a review for this content
    const existingQuery = query(
      collection(requireFirebaseDb(), 'reviews'),
      where('user_id', '==', user.uid),
      where('content_id', '==', contentId),
      where('content_type', '==', contentType)
    );
    const existingDocs = await getDocs(existingQuery);
    
    if (!existingDocs.empty) {
      throw new Error('You have already reviewed this content');
    }

    const newReview = {
      user_id: user.uid,
      user_display_name: profile.display_name || user.email?.split('@')[0] || 'Anonymous',
      user_avatar_url: profile.avatar_url,
      content_id: contentId,
      content_type: contentType,
      content_title: contentTitle,
      content_poster_path: contentPosterPath,
      rating,
      review_text: reviewText,
      likes_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const docRef = await addDoc(collection(requireFirebaseDb(), 'reviews'), newReview);
    void enqueuePendingJob(user.uid, "activity_review", {
      userId: user.uid,
      contentId,
      contentType,
      rating,
    });
    return { id: docRef.id, ...newReview } as Review;
  };

  // Update an existing review
  const updateReview = async (reviewId: string, rating: number, reviewText: string) => {
    if (!user) {
      throw new Error('User must be logged in to update a review');
    }

    // Verify ownership
    const reviewRef = doc(requireFirebaseDb(), 'reviews', reviewId);
    const reviewDoc = await getDoc(reviewRef);
    
    if (!reviewDoc.exists()) {
      throw new Error('Review not found');
    }
    
    const reviewData = reviewDoc.data();
    if (reviewData.user_id !== user.uid) {
      throw new Error('You can only update your own reviews');
    }

    await updateDoc(reviewRef, {
      rating,
      review_text: reviewText,
      updated_at: new Date().toISOString()
    });
  };

  // Delete a review
  const deleteReview = async (reviewId: string) => {
    if (!user) {
      throw new Error('User must be logged in to delete a review');
    }

    // Verify ownership
    const reviewRef = doc(requireFirebaseDb(), 'reviews', reviewId);
    const reviewDoc = await getDoc(reviewRef);
    
    if (!reviewDoc.exists()) {
      throw new Error('Review not found');
    }
    
    const reviewData = reviewDoc.data();
    if (reviewData.user_id !== user.uid) {
      throw new Error('You can only delete your own reviews');
    }

    await deleteDoc(reviewRef);
    setUserReview(null);
  };

  // Like a review
  const likeReview = async (reviewId: string) => {
    if (!user) {
      throw new Error('User must be logged in to like a review');
    }

    try {
      // Check if user already liked this review
      const likesQuery = query(
        collection(requireFirebaseDb(), 'review_likes'),
        where('review_id', '==', reviewId),
        where('user_id', '==', user.uid)
      );
      const existingLikes = await getDocs(likesQuery);
      
      const reviewRef = doc(requireFirebaseDb(), 'reviews', reviewId);
      
      if (!existingLikes.empty) {
        // Unlike - remove the like
        const likeDoc = existingLikes.docs[0];
        await deleteDoc(doc(requireFirebaseDb(), 'review_likes', likeDoc.id));
        await updateDoc(reviewRef, {
          likes_count: increment(-1)
        });
        setLikedReviewIds((prev) => {
          const next = new Set(prev);
          next.delete(reviewId);
          return next;
        });
        return false; // Returns false to indicate unliked
      } else {
        // Like - add new like
        await addDoc(collection(requireFirebaseDb(), 'review_likes'), {
          review_id: reviewId,
          user_id: user.uid,
          created_at: new Date().toISOString()
        });
        await updateDoc(reviewRef, {
          likes_count: increment(1)
        });
        setLikedReviewIds((prev) => new Set(prev).add(reviewId));
        return true; // Returns true to indicate liked
      }
    } catch (error) {
      console.error('Error liking review:', error);
      throw error;
    }
  };

  const getAverageRating = useCallback(() => {
    if (reviews.length === 0) return 0;
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return total / reviews.length;
  }, [reviews]);

  return {
    reviews,
    userReview,
    likedReviewIds,
    loading,
    addReview,
    updateReview,
    deleteReview,
    likeReview,
    getAverageRating,
    reviewCount: reviews.length
  };
}

export const useReviews = (contentId?: number, contentType?: 'movie' | 'tv') => {
  return isPythonBackendEnabled()
    ? usePythonReviews(contentId, contentType)
    : useFirestoreReviews(contentId, contentType);
};
