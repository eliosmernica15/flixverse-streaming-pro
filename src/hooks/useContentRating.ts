import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  getDocs
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { useAuth } from './useAuth';
import { ContentRating } from '@/integrations/firebase/types';

export const useContentRating = (contentId?: number, contentType?: 'movie' | 'tv') => {
  const [userRating, setUserRating] = useState<number | null>(null);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [totalRatings, setTotalRatings] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  // Fetch ratings for the content
  useEffect(() => {
    if (!contentId || !contentType) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'content_ratings'),
      where('content_id', '==', contentId),
      where('content_type', '==', contentType)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let total = 0;
      let count = 0;
      let userRatingValue: number | null = null;

      snapshot.forEach((doc) => {
        const rating = doc.data() as ContentRating;
        total += rating.rating;
        count++;
        
        if (user && rating.user_id === user.uid) {
          userRatingValue = rating.rating;
        }
      });

      setAverageRating(count > 0 ? total / count : 0);
      setTotalRatings(count);
      setUserRating(userRatingValue);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching ratings:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [contentId, contentType, user]);

  // Rate content
  const rateContent = async (rating: number) => {
    if (!user || !contentId || !contentType) {
      throw new Error('User must be logged in to rate content');
    }

    if (rating < 1 || rating > 10) {
      throw new Error('Rating must be between 1 and 10');
    }

    // Use a deterministic ID based on user and content
    const ratingId = `${user.uid}_${contentId}_${contentType}`;
    const ratingRef = doc(db, 'content_ratings', ratingId);

    await setDoc(ratingRef, {
      id: ratingId,
      user_id: user.uid,
      content_id: contentId,
      content_type: contentType,
      rating,
      created_at: userRating ? undefined : new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { merge: true });

    setUserRating(rating);
  };

  // Remove rating
  const removeRating = async () => {
    if (!user || !contentId || !contentType) {
      throw new Error('User must be logged in to remove rating');
    }

    const ratingId = `${user.uid}_${contentId}_${contentType}`;
    await deleteDoc(doc(db, 'content_ratings', ratingId));
    setUserRating(null);
  };

  return {
    userRating,
    averageRating,
    totalRatings,
    loading,
    rateContent,
    removeRating,
    isRated: userRating !== null
  };
};
