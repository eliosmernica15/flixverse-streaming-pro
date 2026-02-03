"use client";

import { motion } from 'framer-motion';
import { Star, Tv, Film, Clock, MessageSquare, Heart, Play } from 'lucide-react';
import Link from 'next/link';
import { getImageUrl } from '@/utils/tmdbApi';
import { UserActivity } from '@/hooks/useUserActivity';
import { memo } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItemProps {
  activity: UserActivity;
  index: number;
}

// Memoized Icon wrapper to prevent re-renders
const ActivityIcon = memo(({ type }: { type: UserActivity['type'] }) => {
  switch (type) {
    case 'review':
      return <div className="p-2 rounded-full bg-purple-500/20 text-purple-400"><MessageSquare size={16} /></div>;
    case 'rating':
      return <div className="p-2 rounded-full bg-yellow-500/20 text-yellow-400"><Star size={16} /></div>;
    case 'comment':
      return <div className="p-2 rounded-full bg-blue-500/20 text-blue-400"><MessageSquare size={16} /></div>;
    case 'watchlist':
      return <div className="p-2 rounded-full bg-green-500/20 text-green-400"><Heart size={16} /></div>;
    case 'watched':
      return <div className="p-2 rounded-full bg-red-500/20 text-red-400"><Clock size={16} /></div>;
    default:
      return <div className="p-2 rounded-full bg-gray-500/20 text-gray-400"><Film size={16} /></div>;
  }
});

ActivityIcon.displayName = 'ActivityIcon';

const ActivityItem = memo(({ activity, index }: ActivityItemProps) => {
  const timeAgo = formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true });

  // Animation delay capped for performance in long lists
  const delay = Math.min(index * 0.05, 0.5);

  const contentLink = activity.contentId && activity.contentType
    ? `/movie/${activity.contentId}?type=${activity.contentType}`
    : '#';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex gap-4 group mb-4 content-lazy"
    >
      <Link
        href={contentLink}
        className="flex items-start space-x-4 p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer w-full"
      >
        {/* Activity Icon */}
        <div className="flex-shrink-0 mt-1">
          <ActivityIcon type={activity.type} />
        </div>

        {/* Poster Thumbnail */}
        {
          activity.contentPosterPath ? (
            <motion.div
              className="relative w-14 h-20 flex-shrink-0 rounded-lg overflow-hidden"
              whileHover={{ scale: 1.05 }}
            >
              <img
                src={getImageUrl(activity.contentPosterPath, 'medium')}
                alt={activity.contentTitle || 'Content'}
                loading="lazy"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-1 left-1">
                {activity.contentType === 'tv' ? (
                  <Tv className="w-3 h-3 text-white/80" />
                ) : (
                  <Film className="w-3 h-3 text-white/80" />
                )}
              </div>
            </motion.div>
          ) : (
            <div className="w-14 h-20 flex-shrink-0 rounded-lg bg-white/10 flex items-center justify-center">
              {activity.contentType === 'tv' ? (
                <Tv className="w-6 h-6 text-gray-500" />
              ) : (
                <Film className="w-6 h-6 text-gray-500" />
              )}
            </div>
          )
        }

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Activity Type & Time */}
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-xs text-gray-500">{timeAgo}</span>
          </div>

          {/* Title */}
          {activity.contentTitle && (
            <h4 className="text-white font-medium truncate group-hover:text-red-400 transition-colors">
              {activity.contentTitle}
            </h4>
          )}

          {/* Rating */}
          {activity.rating && (
            <div className="flex items-center space-x-1 mt-1">
              <div className="flex items-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3 h-3 ${i < Math.round(activity.rating! / 2)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-600'
                      }`}
                  />
                ))}
              </div>
              <span className="text-sm text-yellow-400 font-medium">
                {activity.rating}/10
              </span>
            </div>
          )}

          {/* Review Text Preview */}
          {activity.reviewText && (
            <p className="text-sm text-gray-400 mt-1 line-clamp-2">
              "{activity.reviewText}"
            </p>
          )}

          {/* Comment Text Preview */}
          {activity.commentText && (
            <p className="text-sm text-gray-400 mt-1 line-clamp-2">
              "{activity.commentText}"
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  );
});

ActivityItem.displayName = 'ActivityItem';

// Activity Feed Section component for the profile
export interface ActivityFeedProps {
  activities: UserActivity[];
  loading?: boolean;
  emptyMessage?: string;
}

export const ActivityFeed = ({ activities, loading, emptyMessage = "No activity yet" }: ActivityFeedProps) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start space-x-4 p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="w-14 h-20 rounded-lg skeleton-shimmer-gpu" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 rounded skeleton-shimmer-gpu" />
              <div className="h-5 w-48 rounded skeleton-shimmer-gpu" />
              <div className="h-4 w-32 rounded skeleton-shimmer-gpu" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-12"
      >
        <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">{emptyMessage}</p>
        <p className="text-gray-500 text-sm mt-2">
          Start watching and rating content to build your activity feed
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <ActivityItem key={activity.id} activity={activity} index={index} />
      ))}
    </div>
  );
};

export default ActivityItem;
