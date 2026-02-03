import { useState } from 'react';
import { Star } from 'lucide-react';
import { useContentRating } from '@/hooks/useContentRating';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

interface QuickRatingProps {
  contentId: number;
  contentType: 'movie' | 'tv';
  size?: 'sm' | 'md' | 'lg';
  showAverage?: boolean;
  showCount?: boolean;
}

const QuickRating = ({
  contentId,
  contentType,
  size = 'md',
  showAverage = true,
  showCount = true
}: QuickRatingProps) => {
  const [hoverRating, setHoverRating] = useState(0);
  const { userRating, averageRating, totalRatings, loading, rateContent, removeRating } = useContentRating(contentId, contentType);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const sizeConfig = {
    sm: { star: 'w-4 h-4', gap: 'space-x-0.5', text: 'text-xs' },
    md: { star: 'w-5 h-5', gap: 'space-x-1', text: 'text-sm' },
    lg: { star: 'w-6 h-6', gap: 'space-x-1.5', text: 'text-base' }
  };

  const handleRate = async (rating: number) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to rate content",
        variant: "destructive"
      });
      return;
    }

    try {
      if (userRating === rating) {
        await removeRating();
        toast({
          title: "Rating removed",
          description: "Your rating has been removed"
        });
      } else {
        await rateContent(rating);
        toast({
          title: "Rated!",
          description: `You rated this ${rating}/10`
        });
      }
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to rate",
        variant: "destructive"
      });
    }
  };

  const displayRating = hoverRating || userRating || 0;
  const displayStars = Math.ceil(displayRating / 2);

  if (loading) {
    return (
      <div className={`flex items-center ${sizeConfig[size].gap}`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={`${sizeConfig[size].star} text-gray-600 animate-pulse`} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center flex-wrap gap-2">
      {/* User Rating Stars */}
      <div className={`flex items-center ${sizeConfig[size].gap}`}>
        {[1, 2, 3, 4, 5].map((star) => {
          const starRating = star * 2;
          const isFilled = star <= displayStars;
          const isUserRated = userRating && star <= Math.ceil(userRating / 2);

          return (
            <motion.button
              key={star}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleRate(starRating)}
              onMouseEnter={() => setHoverRating(starRating)}
              onMouseLeave={() => setHoverRating(0)}
              className="transition-all duration-150 focus:outline-none"
              title={`Rate ${starRating}/10`}
            >
              <Star
                className={`${sizeConfig[size].star} transition-colors duration-150 ${isFilled
                    ? isUserRated
                      ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.5)]'
                      : 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-500 hover:text-yellow-400/50'
                  }`}
              />
            </motion.button>
          );
        })}
      </div>

      {/* Rating Info */}
      <div className={`flex items-center ${sizeConfig[size].gap} ${sizeConfig[size].text} text-gray-400`}>
        {userRating && (
          <span className="text-yellow-400 font-medium">
            {userRating}/10
          </span>
        )}
        {showAverage && averageRating > 0 && (
          <>
            {userRating && <span className="text-gray-600">|</span>}
            <span>
              Avg: {averageRating.toFixed(1)}
            </span>
          </>
        )}
        {showCount && totalRatings > 0 && (
          <span className="text-gray-500">
            ({totalRatings})
          </span>
        )}
      </div>
    </div>
  );
};

export default QuickRating;
