import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  getDocs
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { useAuth } from './useAuth';
import { TMDBMovie } from '@/utils/tmdbApi';
import { UserMovieListItem } from '@/integrations/firebase/types';

// Local cache key for faster initial load
const CACHE_KEY = 'flixverse_movie_list_cache';

export const useUserMovieList = () => {
  const [movieList, setMovieList] = useState<UserMovieListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [operatingMovies, setOperatingMovies] = useState<Set<number>>(new Set());
  const { user, isAuthenticated } = useAuth();

  // Memoized set of movie IDs for O(1) lookup
  const movieIdSet = useMemo(() => new Set(movieList.map(item => item.movie_id)), [movieList]);

  // Load from local cache first for faster initial render
  useEffect(() => {
    if (isAuthenticated && user) {
      try {
        const cached = localStorage.getItem(`${CACHE_KEY}_${user.uid}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMovieList(parsed);
          }
        }
      } catch (e) {
        console.warn('Failed to load movie list cache:', e);
      }
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setMovieList([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'user_movie_lists'),
      where('user_id', '==', user.uid),
      orderBy('added_at', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const movies: UserMovieListItem[] = [];
      snapshot.forEach((doc) => {
        movies.push({ id: doc.id, ...doc.data() } as UserMovieListItem);
      });
      setMovieList(movies);
      setLoading(false);

      // Update local cache
      try {
        localStorage.setItem(`${CACHE_KEY}_${user.uid}`, JSON.stringify(movies));
      } catch (e) {
        console.warn('Failed to cache movie list:', e);
      }
    }, (error) => {
      console.error('Error fetching movie list:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthenticated, user]);

  const fetchMovieList = async () => {
    if (!user) return;

    try {
      const q = query(
        collection(db, 'user_movie_lists'),
        where('user_id', '==', user.uid),
        orderBy('added_at', 'desc')
      );
      const snapshot = await getDocs(q);
      const movies: UserMovieListItem[] = [];
      snapshot.forEach((doc) => {
        movies.push({ id: doc.id, ...doc.data() } as UserMovieListItem);
      });
      setMovieList(movies);
    } catch (error) {
      console.error('Error fetching movie list:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToList = async (movie: TMDBMovie) => {
    if (!user) {
      throw new Error('User must be logged in to add movies to list');
    }

    if (operatingMovies.has(movie.id)) {
      return;
    }

    const exists = movieList.some(item => item.movie_id === movie.id);
    if (exists) {
      console.log('Movie already in list, skipping add');
      return;
    }

    setOperatingMovies(prev => new Set(prev).add(movie.id));

    const mediaType: 'movie' | 'tv' = (movie.media_type === 'tv' || movie.first_air_date) ? 'tv' : 'movie';

    const optimisticItem: UserMovieListItem = {
      id: `temp-${movie.id}`,
      user_id: user.uid,
      movie_id: movie.id,
      movie_title: movie.title || movie.name || 'Unknown Title',
      movie_poster_path: movie.poster_path,
      media_type: mediaType,
      added_at: new Date().toISOString()
    };

    setMovieList(prev => [optimisticItem, ...prev]);

    try {
      await addDoc(collection(db, 'user_movie_lists'), {
        user_id: user.uid,
        movie_id: movie.id,
        movie_title: movie.title || movie.name || 'Unknown Title',
        movie_poster_path: movie.poster_path,
        media_type: mediaType,
        added_at: new Date().toISOString()
      });
    } catch (error) {
      setMovieList(prev => prev.filter(item => item.movie_id !== movie.id));
      console.error('Error adding movie to list:', error);
      throw error;
    } finally {
      setOperatingMovies(prev => {
        const newSet = new Set(prev);
        newSet.delete(movie.id);
        return newSet;
      });
    }
  };

  const removeFromList = async (movieId: number) => {
    if (!user) {
      throw new Error('User must be logged in to remove movies from list');
    }

    if (operatingMovies.has(movieId)) {
      return;
    }

    setOperatingMovies(prev => new Set(prev).add(movieId));

    const originalList = [...movieList];
    const itemToRemove = movieList.find(item => item.movie_id === movieId);
    setMovieList(prev => prev.filter(item => item.movie_id !== movieId));

    try {
      if (itemToRemove && !itemToRemove.id.startsWith('temp-')) {
        await deleteDoc(doc(db, 'user_movie_lists', itemToRemove.id));
      } else if (!itemToRemove) {
        console.log('Movie not found in list, skipping remove');
        return;
      }
    } catch (error) {
      setMovieList(originalList);
      console.error('Error removing movie from list:', error);
      throw error;
    } finally {
      setOperatingMovies(prev => {
        const newSet = new Set(prev);
        newSet.delete(movieId);
        return newSet;
      });
    }
  };

  // Optimized lookup using memoized Set - O(1) instead of O(n)
  const isInList = useCallback((movieId: number) => {
    return movieIdSet.has(movieId);
  }, [movieIdSet]);

  const isOperating = useCallback((movieId: number) => {
    return operatingMovies.has(movieId);
  }, [operatingMovies]);

  return {
    movieList,
    loading,
    addToList,
    removeFromList,
    isInList,
    isOperating,
    refetch: fetchMovieList
  };
};