
import { useState, useEffect } from 'react';

export interface UserPreferences {
  favoriteGenres: string[];
  watchedMovies: number[];
  preferredLanguage: string;
  viewHistory: number[];
  lastVisited: string;
  personalizedRecommendations: boolean;
}

const defaultPreferences: UserPreferences = {
  favoriteGenres: [],
  watchedMovies: [],
  preferredLanguage: 'en',
  viewHistory: [],
  lastVisited: new Date().toISOString(),
  personalizedRecommendations: true,
};

export const useUserPreferences = () => {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);

  useEffect(() => {
    const saved = localStorage.getItem('userPreferences');
    if (saved) {
      try {
        setPreferences(JSON.parse(saved));
      } catch (error) {
        console.error('Error parsing user preferences:', error);
      }
    }
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
