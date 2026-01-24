import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  limit,
  increment
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { useAuth } from './useAuth';
import { useUserProfile } from './useUserProfile';
import { Review } from '@/integrations/firebase/types';

export const useReviews = (contentId?: number, contentType?: 'movie' | 'tv') => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();
  const { profile } = useUserProfile();

  // Fetch reviews for a specific content
  useEffect(() => {
    if (!contentId || !contentType) {
      setReviews([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'reviews'),
      where('content_id', '==', contentId),
      where('content_type', '==', contentType),
      orderBy('created_at', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reviewsList: Review[] = [];
      snapshot.forEach((doc) => {
        const review = { id: doc.id, ...doc.data() } as Review;
        reviewsList.push(review);
        // Check if this is the user's review
        if (user && review.user_id === user.uid) {
          setUserReview(review);
        }
      });
      setReviews(reviewsList);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching reviews:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [contentId, contentType, user]);

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
      collection(db, 'reviews'),
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

    const docRef = await addDoc(collection(db, 'reviews'), newReview);
    return { id: docRef.id, ...newReview } as Review;
  };

  // Update an existing review
  const updateReview = async (reviewId: string, rating: number, reviewText: string) => {
    if (!user) {
      throw new Error('User must be logged in to update a review');
    }

    const reviewRef = doc(db, 'reviews', reviewId);
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

    await deleteDoc(doc(db, 'reviews', reviewId));
    setUserReview(null);
  };

  // Get average rating for content
  const getAverageRating = useCallback(() => {
    if (reviews.length === 0) return 0;
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return total / reviews.length;
  }, [reviews]);

  return {
    reviews,
    userReview,
    loading,
    addReview,
    updateReview,
    deleteReview,
    getAverageRating,
    reviewCount: reviews.length
  };
};
