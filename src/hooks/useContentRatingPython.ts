/**
 * Content rating backed by the Python Postgres API.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { pythonFetch } from "@/lib/pythonApi/client";
import { isPythonBackendEnabled, useHttpTransport } from "@/lib/pythonApi/config";

const POLL_MS = 30000;

export function usePythonContentRating(contentId?: number, contentType?: "movie" | "tv") {
  const [userRating, setUserRating] = useState<number | null>(null);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [totalRatings, setTotalRatings] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const refresh = useCallback(async () => {
    if (!user || !contentId || !contentType) return;
    try {
      const data = await pythonFetch<{ rating: number | null }>(
        `/content/rating?contentId=${contentId}&contentType=${contentType}`
      );
      setUserRating(data.rating);
    } catch (err) {
      console.error("[content-rating/python] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user, contentId, contentType]);

  useEffect(() => {
    if (!user || !isPythonBackendEnabled() || !contentId || !contentType) {
      setLoading(false);
      return;
    }
    void refresh();
    if (useHttpTransport()) {
      const poll = setInterval(() => void refresh(), POLL_MS);
      return () => clearInterval(poll);
    }
  }, [user, contentId, contentType, refresh]);

  const rateContent = useCallback(
    async (rating: number) => {
      if (!user || !contentId || !contentType) {
        throw new Error("User must be logged in to rate content");
      }
      if (rating < 1 || rating > 10) {
        throw new Error("Rating must be between 1 and 10");
      }
      try {
        await pythonFetch("/content/rating", {
          method: "POST",
          body: JSON.stringify({ contentId, contentType, rating }),
        });
        setUserRating(rating);
      } catch (err) {
        console.error("[content-rating/python] rate failed:", err);
        throw err;
      }
    },
    [user, contentId, contentType]
  );

  const removeRating = useCallback(async () => {
    setUserRating(null);
  }, []);

  return {
    userRating,
    averageRating,
    totalRatings,
    loading,
    rateContent,
    removeRating,
    isRated: userRating !== null,
  };
}
