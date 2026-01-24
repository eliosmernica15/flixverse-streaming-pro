import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  limit
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { useAuth } from './useAuth';
import { Notification } from '@/integrations/firebase/types';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  // Fetch notifications for the current user
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', user.uid),
      orderBy('created_at', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationsList: Notification[] = [];
      let unread = 0;
      
      snapshot.forEach((doc) => {
        const notification = { id: doc.id, ...doc.data() } as Notification;
        notificationsList.push(notification);
        if (!notification.read) {
          unread++;
        }
      });
      
      setNotifications(notificationsList);
      setUnreadCount(unread);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching notifications:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Mark a notification as read
  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, { read: true });
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;

    const batch = writeBatch(db);
    
    notifications
      .filter(n => !n.read)
      .forEach(notification => {
        const ref = doc(db, 'notifications', notification.id);
        batch.update(ref, { read: true });
      });

    await batch.commit();
  };

  // Delete a notification
  const deleteNotification = async (notificationId: string) => {
    if (!user) return;

    await deleteDoc(doc(db, 'notifications', notificationId));
  };

  // Clear all notifications
  const clearAll = async () => {
    if (!user || notifications.length === 0) return;

    const batch = writeBatch(db);
    
    notifications.forEach(notification => {
      const ref = doc(db, 'notifications', notification.id);
      batch.delete(ref);
    });

    await batch.commit();
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    hasUnread: unreadCount > 0
  };
};
