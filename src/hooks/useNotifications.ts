
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface NotificationPreferences {
  newMovies: boolean;
  popularMovies: boolean;
  popularTVShows: boolean;
  upcomingContent: boolean;
  allNotifications: boolean;
}

export const useNotifications = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    newMovies: false,
    popularMovies: false,
    popularTVShows: false,
    upcomingContent: false,
    allNotifications: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    // Check if notifications are supported
    if ('Notification' in window) {
      const permission = Notification.permission;
      setHasPermission(permission === 'granted');

      // Load preferences from localStorage
      const savedPreferences = localStorage.getItem('notificationPreferences');
      if (savedPreferences) {
        try {
          setPreferences(JSON.parse(savedPreferences));
        } catch (error) {
          console.error('Error parsing notification preferences:', error);
        }
      }
    } else {
      setHasPermission(false);
    }
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      toast({
        title: "Notifications not supported",
        description: "Your browser doesn't support notifications",
        variant: "destructive",
      });
      return false;
    }

    if (Notification.permission === 'granted') {
      setHasPermission(true);
      return true;
    }

    if (Notification.permission === 'denied') {
      toast({
        title: "Notifications blocked",
        description: "Please enable notifications in your browser settings",
        variant: "destructive",
      });
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setHasPermission(granted);

      if (granted) {
        toast({
          title: "Notifications enabled",
          description: "You'll now receive updates about new content",
        });
      } else {
        toast({
          title: "Notifications disabled",
          description: "You can enable them later in your browser settings",
          variant: "destructive",
        });
      }

      return granted;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast({
        title: "Error",
        description: "Failed to request notification permission",
        variant: "destructive",
      });
      return false;
    }
  };

  const updatePreferences = (newPreferences: Partial<NotificationPreferences>) => {
    const updated = { ...preferences, ...newPreferences };

    // If turning off all notifications, turn off individual preferences too
    if (newPreferences.allNotifications === false) {
      updated.newMovies = false;
      updated.popularMovies = false;
      updated.popularTVShows = false;
      updated.upcomingContent = false;
    }

    setPreferences(updated);
    localStorage.setItem('notificationPreferences', JSON.stringify(updated));

    console.log('Updated notification preferences:', updated);
  };

  const sendNotification = (title: string, options?: NotificationOptions) => {
    if (!hasPermission) {
      console.warn('Notification permission not granted');
      return;
    }

    if (!preferences.allNotifications) {
      console.log('All notifications are disabled by user preference');
      return;
    }

    try {
      // Check if service worker registration is available (for mobile support)
      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, {
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'flixverse-notification',
            requireInteraction: false,
            data: { url: window.location.href },
            ...options,
          });
        }).catch(e => {
          // Fallback to standard API
          createStandardNotification(title, options);
        });
      } else {
        createStandardNotification(title, options);
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      toast({
        title: "Notification Error",
        description: "Failed to send notification",
        variant: "destructive",
      });
    }
  };

  const createStandardNotification = (title: string, options?: NotificationOptions) => {
    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'flixverse-notification',
      requireInteraction: false,
      ...options,
    });

    // Auto close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);

    notification.onclick = function () {
      window.focus();
      notification.close();
    };
  };

  // Test notification function
  const sendTestNotification = () => {
    sendNotification('FlixVerse Test', {
      body: 'This is a test notification to verify the feature is working!',
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
