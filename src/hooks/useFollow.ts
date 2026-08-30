import { useState, useEffect, useCallback } from "react";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { enqueuePendingJob } from "@/lib/pendingJobs";

export function useFollow(targetUserId: string | null) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !targetUserId || user.uid === targetUserId) {
      setLoading(false);
      return;
    }

    const checkFollow = async () => {
      try {
        const db = getFirestore();
        // Check if current user follows target
        const followQ = query(
          collection(db, "follows"),
          where("follower_id", "==", user.uid),
          where("following_id", "==", targetUserId)
        );
        const snap = await getDocs(followQ);
        setIsFollowing(!snap.empty);

        // Get follower count
        const countQ = query(
          collection(db, "follows"),
          where("following_id", "==", targetUserId)
        );
        const countSnap = await getDocs(countQ);
        setFollowerCount(countSnap.size);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    void checkFollow();
  }, [user, targetUserId]);

  const toggleFollow = useCallback(async () => {
    if (!user || !targetUserId || user.uid === targetUserId) return;

    const db = getFirestore();
    const prevIsFollowing = isFollowing;
    const prevCount = followerCount;

    // Optimistic update — rollback on failure
    setIsFollowing(!prevIsFollowing);
    setFollowerCount((prev) => Math.max(0, prev + (prevIsFollowing ? -1 : 1)));

    try {
      if (prevIsFollowing) {
        const followQ = query(
          collection(db, "follows"),
          where("follower_id", "==", user.uid),
          where("following_id", "==", targetUserId)
        );
        const snap = await getDocs(followQ);
        for (const d of snap.docs) {
          await deleteDoc(doc(db, "follows", d.id));
        }
      } else {
        await addDoc(collection(db, "follows"), {
          follower_id: user.uid,
          following_id: targetUserId,
          created_at: new Date().toISOString(),
        });
        void enqueuePendingJob(user.uid, "follow_notify", {
          toUserId: targetUserId,
          fromUserId: user.uid,
          message: "Someone started following you.",
        });
      }
    } catch (err) {
      // Rollback optimistic state on failure
      setIsFollowing(prevIsFollowing);
      setFollowerCount(prevCount);
      throw err;
    }
  }, [user, targetUserId, isFollowing, followerCount]);

  return { isFollowing, followerCount, loading, toggleFollow };
}
