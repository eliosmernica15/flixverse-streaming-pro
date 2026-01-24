import { useState } from 'react';
import { Bell, Check, Trash2, X, MessageCircle, Heart, UserPlus, Star, Tv } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotificationsFirebase';
import { useAuth } from '@/hooks/useAuth';
import { Notification } from '@/integrations/firebase/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const NotificationIcon = ({ type }: { type: Notification['type'] }) => {
  const iconProps = { className: 'w-4 h-4' };
  
  switch (type) {
    case 'like':
      return <Heart {...iconProps} className="w-4 h-4 text-red-400" />;
    case 'comment':
      return <MessageCircle {...iconProps} className="w-4 h-4 text-blue-400" />;
    case 'follow':
      return <UserPlus {...iconProps} className="w-4 h-4 text-green-400" />;
    case 'review':
      return <Star {...iconProps} className="w-4 h-4 text-yellow-400" />;
    case 'new_episode':
      return <Tv {...iconProps} className="w-4 h-4 text-purple-400" />;
    default:
      return <Bell {...iconProps} className="w-4 h-4 text-gray-400" />;
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
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`p-3 rounded-lg transition-colors ${
        notification.read 
          ? 'bg-transparent hover:bg-white/5' 
          : 'bg-white/5 hover:bg-white/10'
      }`}
    >
      <div className="flex items-start space-x-3">
        <div className={`mt-0.5 p-2 rounded-full ${
          notification.read ? 'bg-gray-800' : 'bg-white/10'
        }`}>
          <NotificationIcon type={notification.type} />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${notification.read ? 'text-gray-400' : 'text-white'} font-medium`}>
            {notification.title}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-[10px] text-gray-600 mt-1">
            {timeAgo(notification.created_at)}
          </p>
        </div>

        <div className="flex items-center space-x-1">
          {!notification.read && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRead();
              }}
              className="p-1.5 hover:bg-white/10 rounded transition-colors"
              title="Mark as read"
            >
              <Check className="w-3.5 h-3.5 text-green-400" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 hover:bg-white/10 rounded-full transition-colors">
          <Bell className="w-5 h-5 text-white" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent 
        align="end" 
        className="w-80 p-0 bg-gray-900/95 backdrop-blur-xl border-white/10 rounded-xl shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="font-semibold text-white">Notifications</h3>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs text-gray-400 hover:text-white h-7 px-2"
              >
                <Check className="w-3 h-3 mr-1" />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-xs text-red-400 hover:text-red-300 h-7 px-2"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <ScrollArea className="h-80">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <Bell className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              <AnimatePresence>
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={() => markAsRead(notification.id)}
                    onDelete={() => deleteNotification(notification.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
