/**
 * Reviews backed by the Python Postgres API.
 * Falls back to a no-op when not enabled (Firestore version is selected).
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { pythonFetch } from "@/lib/pythonApi/client";
import { isPythonBackendEnabled, useHttpTransport } from "@/lib/pythonApi/config";
import { Review } from "@/integrations/firebase/types";

const POLL_MS = 25000;

export function usePythonReviews(contentId?: number, contentType?: "movie" | "tv") {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const refresh = useCallback(async () => {
    if (!contentId || !contentType) return;
    try {
      const data = await pythonFetch<{ reviews: Review[] }>(
        `/social/reviews?contentId=${contentId}&contentType=${contentType}&limit=50`
      );
      setReviews(data.reviews || []);
      if (user) {
        const mine = (data.reviews || []).find((r) => r.user_id === user.uid);
        setUserReview(mine || null);
      }
    } catch (err) {
      console.error("[reviews/python] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [contentId, contentType, user]);

  useEffect(() => {
    if (!contentId || !contentType || !isPythonBackendEnabled()) {
      setReviews([]);
      setLoading(false);
      return;
    }
    void refresh();
    if (useHttpTransport()) {
      const poll = setInterval(() => void refresh(), POLL_MS);
      return () => clearInterval(poll);
    }
  }, [contentId, contentType, refresh]);

  const submitReview = useCallback(
    async (rating: number, reviewText: string, contentTitle: string, posterPath: string | null) => {
      if (!user || !contentId || !contentType) {
        throw new Error("Not signed in");
      }
      const body = {
        contentId,
        contentType,
        contentTitle,
        contentPosterPath: posterPath,
        rating,
        reviewText,
      };
      const existing = userReview;
      if (existing) {
        await pythonFetch(`/social/reviews/${encodeURIComponent(existing.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ rating, reviewText }),
        });
      } else {
        await pythonFetch("/social/reviews", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      void refresh();
    },
    [user, contentId, contentType, userReview, refresh]
  );

  const addReview = submitReview;

  const updateReview = useCallback(
    async (reviewId: string, rating: number, reviewText: string) => {
      await pythonFetch(`/social/reviews/${encodeURIComponent(reviewId)}`, {
        method: "PATCH",
        body: JSON.stringify({ rating, reviewText }),
      });
      void refresh();
    },
    [refresh]
  );

  const deleteReview = useCallback(
    async (reviewId: string) => {
      await pythonFetch(`/social/reviews/${encodeURIComponent(reviewId)}`, {
        method: "DELETE",
      });
      void refresh();
    },
    [refresh]
  );

  const likeReview = useCallback(async (_id: string) => {
    // Likes stay in Firestore until ETL.
  }, []);

  const likedReviewIds = new Set<string>();

  const getAverageRating = useCallback(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return sum / reviews.length;
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
    reviewCount: reviews.length,
    refetch: refresh,
  };
}
