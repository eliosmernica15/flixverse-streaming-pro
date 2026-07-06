import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  type DocumentData,
} from "firebase/firestore";
import { requireFirebaseDb } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TimelineComment {
  id: string;
  userId: string;
  userDisplayName: string;
  userAvatarUrl: string | null;
  tmdbId: number;
  timestampSeconds: number;
  text: string;
  likesCount: number;
  status: "visible" | "hidden";
  createdAt: number;
  updatedAt: number;
}

interface UseTimelineCommentsOptions {
  tmdbId: number;
  /** Only subscribe when the overlay is open or scrubber is active */
  enabled?: boolean;
}

export function useTimelineComments({
  tmdbId,
  enabled = true,
}: UseTimelineCommentsOptions) {
  const { user } = useAuth();
  const [comments, setComments] = useState<TimelineComment[]>([]);
  const [loading, setLoading] = useState(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled || !tmdbId) {
      setComments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const db = requireFirebaseDb();
    const commentsRef = collection(db, "timeline_comments");
    const q = query(
      commentsRef,
      where("tmdbId", "==", tmdbId),
      where("status", "==", "visible"),
      orderBy("createdAt", "desc"),
      limit(500)
    );

    const unsub = onSnapshot(q, (snap) => {
      const items: TimelineComment[] = [];
      snap.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          userId: data.userId,
          userDisplayName: data.userDisplayName,
          userAvatarUrl: data.userAvatarUrl,
          tmdbId: data.tmdbId,
          timestampSeconds: data.timestampSeconds,
          text: data.text,
          likesCount: data.likesCount || 0,
          status: data.status,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });
      setComments(items.sort((a, b) => a.timestampSeconds - b.timestampSeconds));
      setLoading(false);
    }, (err) => {
      console.error("Timeline comments snapshot error:", err);
      setLoading(false);
    });

    unsubscribeRef.current = unsub;
    return () => {
      unsub();
      unsubscribeRef.current = null;
    };
  }, [tmdbId, enabled]);

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  const addComment = useCallback(
    async (timestampSeconds: number, text: string) => {
      if (!user) throw new Error("Must be signed in to comment");

      const db = requireFirebaseDb();
      const commentsRef = collection(db, "timeline_comments");

      await addDoc(commentsRef, {
        userId: user.uid,
        userDisplayName: user.displayName || "Anonymous",
        userAvatarUrl: user.photoURL,
        tmdbId,
        timestampSeconds: Math.floor(timestampSeconds),
        text: text.trim(),
        likesCount: 0,
        status: "visible",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    },
    [user, tmdbId]
  );

  const likeComment = useCallback(async (commentId: string) => {
    const db = requireFirebaseDb();
    await updateDoc(doc(db, "timeline_comments", commentId), {
      likesCount: increment(1),
      updatedAt: Date.now(),
    });
  }, []);

  /** Get comments near a specific timestamp (±windowSeconds) */
  const getCommentsNear = useCallback(
    (timestampSeconds: number, windowSeconds = 5) => {
      return comments.filter(
        (c) =>
          c.timestampSeconds >= timestampSeconds - windowSeconds &&
          c.timestampSeconds <= timestampSeconds + windowSeconds
      );
    },
    [comments]
  );

  /** Get comment markers for the scrubber (one per unique timestamp bucket) */
  const getMarkers = useCallback(
    (totalDuration: number, bucketSize = 10) => {
      const buckets = new Map<number, { count: number; timestamp: number }>();

      for (const c of comments) {
        const bucket = Math.floor(c.timestampSeconds / bucketSize) * bucketSize;
        const existing = buckets.get(bucket);
        if (existing) {
          existing.count++;
        } else {
          buckets.set(bucket, { count: 1, timestamp: bucket });
        }
      }

      return Array.from(buckets.values()).map((b) => ({
        ...b,
        progress: totalDuration > 0 ? b.timestamp / totalDuration : 0,
      }));
    },
    [comments]
  );

  return {
    comments,
    loading,
    addComment,
    likeComment,
    getCommentsNear,
    getMarkers,
  };
}
