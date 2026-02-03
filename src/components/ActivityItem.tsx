import { motion, AnimatePresence } from 'framer-motion';
import { Star, Tv, Film, ChevronRight, Clock, MessageCircle, Plus, Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getImageUrl } from '@/utils/tmdbApi';
import { UserActivity, ActivityType } from '@/hooks/useUserActivity';

interface ActivityItemProps {
    activity: UserActivity;
    index: number;
}

const getActivityColor = (type: ActivityType) => {
    switch (type) {
        case 'review': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
        case 'rating': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
        case 'comment': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        case 'watchlist': return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
        case 'watched': return 'bg-green-500/10 text-green-400 border-green-500/20';
        default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
};

const getActivityIcon = (type: ActivityType) => {
    switch (type) {
        case 'review': return <MessageCircle className="w-3 h-3" />;
        case 'rating': return <Star className="w-3 h-3" />;
        case 'comment': return <MessageCircle className="w-3 h-3" />;
        case 'watchlist': return <Plus className="w-3 h-3" />;
        case 'watched': return <Plus className="w-3 h-3" />;
        default: return null;
    }
};

const getActivityLabel = (type: ActivityType) => {
    switch (type) {
        case 'review': return 'Reviewed';
        case 'rating': return 'Rated';
        case 'comment': return 'Commented';
        case 'watchlist': return 'Added to Watchlist';
        case 'watched': return 'Watched';
        default: return type;
    }
};

const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
};

const ActivityItem = ({ activity, index = 0 }: ActivityItemProps) => {
    const router = useRouter();

    const handleClick = () => {
        if (activity.contentId && activity.contentType) {
            router.push(`/movie/${activity.contentId}?type=${activity.contentType}`);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            onClick={handleClick}
            className="flex items-start space-x-4 p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer group"
        >
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
                {/* Activity Type Badge */}
                <div className="flex items-center space-x-2 mb-1">
                    <span className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${getActivityColor(activity.type)}`}>
                        {getActivityIcon(activity.type)}
                        <span>{getActivityLabel(activity.type)}</span>
                    </span>
                    <span className="text-xs text-gray-500">{formatTimeAgo(activity.timestamp)}</span>
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

            {/* Arrow */}
            <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0" />
        </motion.div >
    );
};

// Activity Feed Section component for the profile
interface ActivityFeedProps {
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
                        <div className="w-14 h-20 rounded-lg skeleton-shimmer" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-24 rounded skeleton-shimmer" />
                            <div className="h-5 w-48 rounded skeleton-shimmer" />
                            <div className="h-4 w-32 rounded skeleton-shimmer" />
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
