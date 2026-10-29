
import { useState, useEffect } from 'react';
import { setPerformanceMode } from '@/hooks/usePerformanceMode';

export interface UserPreferences {
  favoriteGenres: string[];
  watchedMovies: number[];
  preferredLanguage: string;
  viewHistory: number[];
  lastVisited: string;
  personalizedRecommendations: boolean;
  performanceMode: boolean;
}

const defaultPreferences: UserPreferences = {
  favoriteGenres: [],
  watchedMovies: [],
  preferredLanguage: 'en',
  viewHistory: [],
  lastVisited: new Date().toISOString(),
  personalizedRecommendations: true,
  performanceMode: false,
};

export const useUserPreferences = () => {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);

  useEffect(() => {
    const saved = localStorage.getItem('userPreferences');
    const savedPerformanceMode = localStorage.getItem('flixverse-performance-mode') === 'true';
    let nextPreferences = defaultPreferences;

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        nextPreferences = {
        ...defaultPreferences,
        ...(parsed && typeof parsed === 'object' ? parsed : {}),
        };
        nextPreferences.performanceMode = savedPerformanceMode || nextPreferences.performanceMode;
      } catch (error) {
        console.error('Error parsing user preferences:', error);
      }
    }

    setPreferences(nextPreferences);
    setPerformanceMode(nextPreferences.performanceMode);
  }, []);

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    const newPreferences = { ...preferences, ...updates };
    setPreferences(newPreferences);
    localStorage.setItem('userPreferences', JSON.stringify(newPreferences));
  };

  const addToWatched = (movieId: number) => {
    const updated = [...preferences.watchedMovies.filter(id => id !== movieId), movieId];
    updatePreferences({ watchedMovies: updated.slice(-100) }); // Keep last 100
  };

  const addToHistory = (movieId: number) => {
    const updated = [movieId, ...preferences.viewHistory.filter(id => id !== movieId)];
    updatePreferences({ viewHistory: updated.slice(0, 50) }); // Keep last 50
  };

  const addFavoriteGenre = (genre: string) => {
    if (!preferences.favoriteGenres.includes(genre)) {
      updatePreferences({ 
        favoriteGenres: [...preferences.favoriteGenres, genre].slice(-10) 
      });
    }
  };

  return {
    preferences,
    updatePreferences,
    addToWatched,
    addToHistory,
    addFavoriteGenre,
  };
};
