
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface NotificationPreferences {
  newMovies: boolean;
  popularMovies: boolean;
  popularTVShows: boolean;
  upcomingContent: boolean;
  allNotifications: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  newMovies: true,
  popularMovies: true,
  popularTVShows: true,
  upcomingContent: true,
  allNotifications: true,
};

export const useNotifications = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const { toast } = useToast();

  useEffect(() => {
    if ('Notification' in window) {
      setHasPermission(Notification.permission === 'granted');
    } else {
      setHasPermission(false);
    }

    const savedPreferences = localStorage.getItem('notificationPreferences');
    if (savedPreferences) {
      try {
        setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(savedPreferences) });
      } catch (error) {
        console.error('Error parsing notification preferences:', error);
        setPreferences(DEFAULT_PREFERENCES);
      }
    } else {
      localStorage.setItem('notificationPreferences', JSON.stringify(DEFAULT_PREFERENCES));
    }
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
      setHasPermission(true);
      return true;
    }
    if (Notification.permission === 'denied') return false;

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setHasPermission(granted);
      return granted;
    } catch {
      return false;
    }
  };

  const updatePreferences = (newPreferences: Partial<NotificationPreferences>) => {
    const updated = { ...preferences, ...newPreferences };

    if (newPreferences.allNotifications === false) {
      updated.newMovies = false;
      updated.popularMovies = false;
      updated.popularTVShows = false;
      updated.upcomingContent = false;
    }

    setPreferences(updated);
    localStorage.setItem('notificationPreferences', JSON.stringify(updated));
  };

  const sendNotification = (title: string, options?: NotificationOptions) => {
    if (!preferences.allNotifications) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
      const notification = new Notification(title, {
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: 'flixverse-notification',
        requireInteraction: false,
        ...options,
      });
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const sendTestNotification = () => {
    sendNotification('FlixVerse Test', {
      body: 'Browser notifications are working. In-app alerts always appear in the bell icon.',
    });
  };

  return {
    hasPermission,
    preferences,
    requestPermission,
    updatePreferences,
    sendNotification,
    sendTestNotification,
  };
};
