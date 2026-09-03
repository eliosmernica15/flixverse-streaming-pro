/**
 * Follow / unfollow backed by the Python Postgres API.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { pythonFetch } from "@/lib/pythonApi/client";
import { isPythonBackendEnabled, useHttpTransport } from "@/lib/pythonApi/config";
import { enqueuePendingJob } from "@/lib/pendingJobs";

const POLL_MS = 60000;

export function usePythonFollow(targetUserId: string | null) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user || !targetUserId || user.uid === targetUserId) return;
    try {
      // We don't have a "is following + count" combined endpoint,
      // so call both and merge.
      const [followerIds, followingIds] = await Promise.all([
        pythonFetch<{ userIds: string[] }>(
          `/social/followers/${encodeURIComponent(targetUserId)}`
        ),
        pythonFetch<{ userIds: string[] }>(
          `/social/following/${encodeURIComponent(targetUserId)}`
        ),
      ]);
      setIsFollowing((followingIds.userIds || []).includes(user.uid));
      setFollowerCount((followerIds.userIds || []).length);
    } catch (err) {
      console.error("[follow/python] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user, targetUserId]);

  useEffect(() => {
    if (!user || !targetUserId || user.uid === targetUserId || !isPythonBackendEnabled()) {
      setLoading(false);
      return;
    }
    void refresh();
    if (useHttpTransport()) {
      const poll = setInterval(() => void refresh(), POLL_MS);
      return () => clearInterval(poll);
    }
  }, [user, targetUserId, refresh]);

  const toggleFollow = useCallback(async () => {
    if (!user || !targetUserId || user.uid === targetUserId) return;
    const prev = isFollowing;
    const prevCount = followerCount;
    setIsFollowing(!prev);
    setFollowerCount((c) => Math.max(0, c + (prev ? -1 : 1)));

    try {
      if (prev) {
        await pythonFetch(
          `/social/follow/${encodeURIComponent(targetUserId)}`,
          { method: "DELETE" }
        );
      } else {
        await pythonFetch("/social/follow", {
          method: "POST",
          body: JSON.stringify({ targetUserId }),
        });
        void enqueuePendingJob(user.uid, "follow_notify", {
          toUserId: targetUserId,
          fromUserId: user.uid,
          message: "Someone started following you.",
        });
      }
    } catch (err) {
      setIsFollowing(prev);
      setFollowerCount(prevCount);
      throw err;
    }
  }, [user, targetUserId, isFollowing, followerCount]);

  return { isFollowing, followerCount, loading, toggleFollow };
}
