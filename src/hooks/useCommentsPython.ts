/**
 * Comments backed by the Python Postgres API.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { pythonFetch } from "@/lib/pythonApi/client";
import { isPythonBackendEnabled, useHttpTransport } from "@/lib/pythonApi/config";
import { Comment } from "@/integrations/firebase/types";

const POLL_MS = 25000;

export function usePythonComments(contentId?: number, contentType?: "movie" | "tv") {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const refresh = useCallback(async () => {
    if (!contentId || !contentType) return;
    try {
      const data = await pythonFetch<{ comments: Comment[] }>(
        `/social/comments?contentId=${contentId}&contentType=${contentType}&limit=50`
      );
      setComments(data.comments || []);
    } catch (err) {
      console.error("[comments/python] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [contentId, contentType]);

  useEffect(() => {
    if (!contentId || !contentType || !isPythonBackendEnabled()) {
      setComments([]);
      setLoading(false);
      return;
    }
    void refresh();
    if (useHttpTransport()) {
      const poll = setInterval(() => void refresh(), POLL_MS);
      return () => clearInterval(poll);
    }
  }, [contentId, contentType, refresh]);

  const addComment = useCallback(
    async (cid: number, ctype: "movie" | "tv", text: string, parentId?: string) => {
      if (!user) throw new Error("Not signed in");
      await pythonFetch("/social/comments", {
        method: "POST",
        body: JSON.stringify({
          contentId: cid,
          contentType: ctype,
          text,
          parentId: parentId ?? null,
        }),
      });
      void refresh();
    },
    [user, refresh]
  );

  const updateComment = useCallback(async (_id: string, _text: string) => {
    // No PATCH endpoint yet; no-op until ETL is done.
  }, []);

  const deleteComment = useCallback(async (_id: string) => {
    // No DELETE endpoint yet; no-op until ETL is done.
  }, []);

  const likeComment = useCallback(async (_id: string) => {
    // Likes live in Firestore for now.
  }, []);

  const getReplies = useCallback(
    (parentId: string) => comments.filter((c) => c.parent_id === parentId),
    [comments]
  );

  const getTopLevelComments = useCallback(
    () => comments.filter((c) => !c.parent_id),
    [comments]
  );

  return {
    comments,
    loading,
    addComment,
    updateComment,
    deleteComment,
    likeComment,
    likedCommentIds: new Set<string>(),
    getReplies,
    getTopLevelComments,
    commentCount: comments.length,
  };
}
