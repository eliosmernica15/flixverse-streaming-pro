"use client";

import { useState } from 'react';
import { Bell, Check, Trash2, MessageCircle, Heart, UserPlus, Star, Tv } from 'lucide-react';
import { useFirebaseNotifications } from '@/hooks/useNotificationsFirebase';
import { useAuth } from '@/hooks/useAuth';
import { Notification } from '@/integrations/firebase/types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const NotificationIcon = ({ type }: { type: Notification['type'] }) => {
  switch (type) {
    case 'like':
      return <Heart className="h-4 w-4 text-red-400" />;
    case 'comment':
      return <MessageCircle className="h-4 w-4 text-blue-400" />;
    case 'follow':
      return <UserPlus className="h-4 w-4 text-green-400" />;
    case 'review':
      return <Star className="h-4 w-4 text-yellow-400" />;
    case 'new_episode':
      return <Tv className="h-4 w-4 text-purple-400" />;
    default:
      return <Bell className="h-4 w-4 text-gray-400" />;
  }
};

const NotificationItem = ({
  notification,
  onRead,
  onDelete
}: {
  notification: Notification;
  onRead: () => void;
  onDelete: () => void;
}) => {
  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className={`rounded-xl p-3 transition-colors ${
        notification.read
          ? 'bg-transparent hover:bg-white/5'
          : 'bg-white/5 hover:bg-white/10'
      }`}
    >
      <div className="flex items-start space-x-3">
        <div className={`mt-0.5 rounded-full p-2 ${notification.read ? 'bg-gray-800' : 'bg-white/10'}`}>
          <NotificationIcon type={notification.type} />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${notification.read ? 'text-gray-400' : 'text-white'}`}>
            {notification.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{notification.message}</p>
          <p className="mt-1 text-[10px] text-gray-600">{timeAgo(notification.created_at)}</p>
        </div>

        <div className="flex items-center space-x-1">
          {!notification.read && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRead();
              }}
              className="rounded-lg p-1.5 transition-colors hover:bg-white/10 focus-ring"
              title="Mark as read"
            >
              <Check className="h-3.5 w-3.5 text-green-400" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded-lg p-1.5 transition-colors hover:bg-red-500/20 focus-ring"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification, clearAll } = useFirebaseNotifications();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="group relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10 focus-ring glow-hover">
          <Bell className="h-5 w-5 transition-transform group-hover:scale-110" />
          {unreadCount > 0 && (
            <span className="badge-shine absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-red-500 to-red-600 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(239,68,68,0.6)]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="glass-strong w-80 animate-scale-in rounded-2xl border-white/10 p-0 shadow-2xl shadow-black/50"
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h3 className="font-semibold text-white">Notifications</h3>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-7 px-2 text-xs text-gray-400 hover:text-white"
              >
                <Check className="mr-1 h-3 w-3" />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Clear
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="scrollbar-thin h-80">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-gray-500">
              <Bell className="mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={() => markAsRead(notification.id)}
                  onDelete={() => deleteNotification(notification.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
