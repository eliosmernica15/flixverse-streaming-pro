import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  limit
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { useAuth } from './useAuth';
import { WatchHistory } from '@/integrations/firebase/types';

export const useWatchHistory = () => {
  const [history, setHistory] = useState<WatchHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  // Fetch watch history for the current user
  useEffect(() => {
    if (!user) {
      setHistory([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'watch_history'),
      where('user_id', '==', user.uid),
      orderBy('watched_at', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const historyList: WatchHistory[] = [];
      snapshot.forEach((doc) => {
        historyList.push({ id: doc.id, ...doc.data() } as WatchHistory);
      });
      setHistory(historyList);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching watch history:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Update or add watch progress
  const updateProgress = async (
    contentId: number,
    contentType: 'movie' | 'tv',
    contentTitle: string,
    contentPosterPath: string | null,
    progressSeconds: number,
    totalDurationSeconds: number,
    season?: number,
    episode?: number
  ) => {
    if (!user) {
      throw new Error('User must be logged in to track watch history');
    }

    // Create a unique ID for this watch entry
    const historyId = contentType === 'tv' && season && episode
      ? `${user.uid}_${contentId}_s${season}e${episode}`
      : `${user.uid}_${contentId}`;

    const historyRef = doc(db, 'watch_history', historyId);

    const completed = progressSeconds >= totalDurationSeconds * 0.9; // 90% watched = completed

    await setDoc(historyRef, {
      id: historyId,
      user_id: user.uid,
      content_id: contentId,
      content_type: contentType,
      content_title: contentTitle,
      content_poster_path: contentPosterPath,
      season: season || null,
      episode: episode || null,
      progress_seconds: progressSeconds,
      total_duration_seconds: totalDurationSeconds,
      completed,
      watched_at: new Date().toISOString()
    }, { merge: true });
  };

  // Get progress for a specific content
  const getProgress = (contentId: number, season?: number, episode?: number): WatchHistory | undefined => {
    if (season && episode) {
      return history.find(
        h => h.content_id === contentId && h.season === season && h.episode === episode
      );
    }
    return history.find(h => h.content_id === contentId && !h.season);
  };

  // Remove from history
  const removeFromHistory = async (historyId: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'watch_history', historyId));
  };

  // Clear all history
  const clearHistory = async () => {
    if (!user || history.length === 0) return;

    const promises = history.map(item => 
      deleteDoc(doc(db, 'watch_history', item.id))
    );
    await Promise.all(promises);
  };

  // Get continue watching items (not completed, with valid duration to avoid NaN/glitches)
  const getContinueWatching = () => {
    return history.filter(
      (h) =>
        !h.completed &&
        h.progress_seconds > 60 &&
        h.total_duration_seconds != null &&
        h.total_duration_seconds > 0
    );
  };

  // Get recently watched (completed)
  const getRecentlyWatched = () => {
    return history.filter(h => h.completed).slice(0, 20);
  };

  return {
    history,
    loading,
    updateProgress,
    getProgress,
    removeFromHistory,
    clearHistory,
    getContinueWatching,
    getRecentlyWatched
  };
};
