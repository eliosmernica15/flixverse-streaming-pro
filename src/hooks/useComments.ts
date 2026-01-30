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
  limit
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { useAuth } from './useAuth';
import { useUserProfile } from './useUserProfile';
import { Comment } from '@/integrations/firebase/types';

export const useComments = (contentId?: number, contentType?: 'movie' | 'tv') => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();
  const { profile } = useUserProfile();

  // Fetch comments for a specific content
  useEffect(() => {
    if (!contentId || !contentType) {
      setComments([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Try with simpler query first (without orderBy that requires composite index)
    const q = query(
      collection(db, 'comments'),
      where('content_id', '==', contentId),
      where('content_type', '==', contentType),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsList: Comment[] = [];
      snapshot.forEach((docSnapshot) => {
        commentsList.push({ id: docSnapshot.id, ...docSnapshot.data() } as Comment);
      });
      // Sort client-side to avoid composite index issues
      commentsList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setComments(commentsList);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching comments:', error);
      // If composite index error, try simpler query
      if (error.code === 'failed-precondition') {
        console.log('Composite index may be building. Comments will appear once ready.');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [contentId, contentType]);

  // Add a new comment
  const addComment = async (
    contentId: number,
    contentType: 'movie' | 'tv',
    text: string,
    parentId?: string
  ) => {
    if (!user || !profile) {
      throw new Error('User must be logged in to comment');
    }

    const newComment = {
      user_id: user.uid,
      user_display_name: profile.display_name || user.email?.split('@')[0] || 'Anonymous',
      user_avatar_url: profile.avatar_url,
      content_id: contentId,
      content_type: contentType,
      parent_id: parentId || null,
      text,
      likes_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'comments'), newComment);
    return { id: docRef.id, ...newComment } as Comment;
  };

  // Update a comment
  const updateComment = async (commentId: string, text: string) => {
    if (!user) {
      throw new Error('User must be logged in to update a comment');
    }

    const commentRef = doc(db, 'comments', commentId);
    await updateDoc(commentRef, {
      text,
      updated_at: new Date().toISOString()
    });
  };

  // Delete a comment
  const deleteComment = async (commentId: string) => {
    if (!user) {
      throw new Error('User must be logged in to delete a comment');
    }

    await deleteDoc(doc(db, 'comments', commentId));
  };

  // Get replies to a specific comment
  const getReplies = (parentId: string) => {
    return comments.filter(comment => comment.parent_id === parentId);
  };

  // Get top-level comments (no parent)
  const getTopLevelComments = () => {
    return comments.filter(comment => !comment.parent_id);
  };

  return {
    comments,
    loading,
    addComment,
    updateComment,
    deleteComment,
    getReplies,
    getTopLevelComments,
    commentCount: comments.length
  };
};
