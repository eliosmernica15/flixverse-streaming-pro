import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  increment,
  limit
} from 'firebase/firestore';
import { getFirebaseDb, requireFirebaseDb } from '@/integrations/firebase/client';
import { useAuth } from './useAuth';
import { useUserProfileContext } from '@/contexts/UserProfileContext';
import { Comment } from '@/integrations/firebase/types';

export const useComments = (contentId?: number, contentType?: 'movie' | 'tv') => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { profile } = useUserProfileContext();

  // Fetch comments for a specific content
  useEffect(() => {
    if (!contentId || !contentType) {
      setComments([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const db = getFirebaseDb();
    if (!db) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'comments'),
      where('content_id', '==', contentId),
      where('content_type', '==', contentType),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const commentsList: Comment[] = [];
        snapshot.forEach((docSnapshot) => {
          commentsList.push({ id: docSnapshot.id, ...docSnapshot.data() } as Comment);
        });
        // Sort client-side to avoid composite index requirement
        commentsList.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setComments(commentsList);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching comments:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [contentId, contentType]);

  // Track which comments the current user has liked
  useEffect(() => {
    if (!user) {
      setLikedCommentIds(new Set());
      return;
    }

    const db = getFirebaseDb();
    if (!db) return;

    const q = query(
      collection(db, 'likes'),
      where('user_id', '==', user.uid),
      where('target_type', '==', 'comment')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach((d) => {
        ids.add(d.data().target_id as string);
      });
      setLikedCommentIds(ids);
    });

    return () => unsubscribe();
  }, [user]);

  // Add a new comment
  const addComment = async (
    cId: number,
    cType: 'movie' | 'tv',
    text: string,
    parentId?: string
  ) => {
    if (!user || !profile) throw new Error('User must be logged in to comment');

    const payload = {
      user_id: user.uid,
      user_display_name: profile.display_name || user.email?.split('@')[0] || 'Anonymous',
      user_avatar_url: profile.avatar_url ?? null,
      content_id: cId,
      content_type: cType,
      parent_id: parentId ?? null,
      text,
      likes_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const ref = await addDoc(collection(requireFirebaseDb(), 'comments'), payload);
    return { id: ref.id, ...payload } as Comment;
  };

  // Update a comment
  const updateComment = async (commentId: string, text: string) => {
    if (!user) throw new Error('User must be logged in to update a comment');
    await updateDoc(doc(requireFirebaseDb(), 'comments', commentId), {
      text,
      updated_at: new Date().toISOString(),
    });
  };

  // Delete a comment
  const deleteComment = async (commentId: string) => {
    if (!user) throw new Error('User must be logged in to delete a comment');
    await deleteDoc(doc(requireFirebaseDb(), 'comments', commentId));
  };

  // Like / unlike a comment (optimistic toggle)
  const likeComment = async (commentId: string) => {
    if (!user) throw new Error('Must be logged in to like comments');

    const db = requireFirebaseDb();
    const likeId = `${user.uid}_comment_${commentId}`;
    const likeRef = doc(db, 'likes', likeId);
    const commentRef = doc(db, 'comments', commentId);
    const alreadyLiked = likedCommentIds.has(commentId);

    if (alreadyLiked) {
      await deleteDoc(likeRef);
      await updateDoc(commentRef, { likes_count: increment(-1) });
    } else {
      await setDoc(likeRef, {
        id: likeId,
        user_id: user.uid,
        target_id: commentId,
        target_type: 'comment',
        created_at: new Date().toISOString(),
      });
      await updateDoc(commentRef, { likes_count: increment(1) });
    }
  };

  const getReplies = (parentId: string) =>
    comments.filter((c) => c.parent_id === parentId);

  const getTopLevelComments = () =>
    comments.filter((c) => !c.parent_id);

  return {
    comments,
    loading,
    addComment,
    updateComment,
    deleteComment,
    likeComment,
    likedCommentIds,
    getReplies,
    getTopLevelComments,
    commentCount: comments.length,
  };
};
