import { useState, useEffect } from 'react';
import { Star, ThumbsUp, MessageCircle, User, Send, Trash2, Edit2 } from 'lucide-react';
import { useReviews } from '@/hooks/useReviews';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Review } from '@/integrations/firebase/types';
import { motion, AnimatePresence } from 'framer-motion';

interface ReviewSectionProps {
  contentId: number;
  contentType: 'movie' | 'tv';
  contentTitle: string;
  contentPosterPath: string | null;
}

const StarRating = ({
  rating,
  onRate,
  editable = false,
  size = 'md'
}: {
  rating: number;
  onRate?: (rating: number) => void;
  editable?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) => {
  const [hoverRating, setHoverRating] = useState(0);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <div className="flex items-center space-x-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const displayRating = Math.ceil((hoverRating || rating) / 2);
        const isFilled = star <= displayRating;

        return (
          <button
            key={star}
            type="button"
            className={`transition-all duration-200 ${editable ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
            onClick={() => editable && onRate?.(star * 2)}
            onMouseEnter={() => editable && setHoverRating(star * 2)}
            onMouseLeave={() => editable && setHoverRating(0)}
            disabled={!editable}
          >
            <Star
              className={`${sizeClasses[size]} ${isFilled
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-gray-500'
                }`}
            />
          </button>
        );
      })}
      <span className="text-sm text-gray-400 ml-2">{rating}/10</span>
    </div>
  );
};

const ReviewCard = ({
  review,
  isOwner,
  onEdit,
  onDelete,
  onLike,
  isLiked,
  isLiking,
  isAuthenticated
}: {
  review: Review;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onLike: () => void;
  isLiked: boolean;
  isLiking: boolean;
  isAuthenticated: boolean;
}) => {
  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10"
    >
      <div className="flex items-start space-x-3">
        <Avatar className="w-10 h-10">
          <AvatarImage src={review.user_avatar_url || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-red-500 to-orange-500">
            <User className="w-5 h-5 text-white" />
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-white">{review.user_display_name}</span>
              <span className="text-xs text-gray-500">{timeAgo(review.created_at)}</span>
            </div>
            {isOwner && (
              <div className="flex items-center space-x-1">
                <button
                  onClick={onEdit}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-gray-400" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            )}
          </div>

          <StarRating rating={review.rating} size="sm" />

          <p className="text-gray-300 mt-2 text-sm leading-relaxed">
            {review.review_text}
          </p>

          <div className="flex items-center space-x-4 mt-3">
            <button
              onClick={onLike}
              disabled={isLiking || !isAuthenticated}
              className={`flex items-center space-x-1 transition-colors text-sm ${isLiked
                  ? 'text-red-400 hover:text-red-300'
                  : 'text-gray-400 hover:text-white'
                } ${!isAuthenticated ? 'opacity-50 cursor-not-allowed' : ''} ${isLiking ? 'opacity-50' : ''}`}
            >
              <ThumbsUp className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
              <span>{review.likes_count}</span>
            </button>
            <button className="flex items-center space-x-1 text-gray-400 hover:text-white transition-colors text-sm">
              <MessageCircle className="w-4 h-4" />
              <span>Reply</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ReviewSection = ({ contentId, contentType, contentTitle, contentPosterPath }: ReviewSectionProps) => {
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [likedReviews, setLikedReviews] = useState<Set<string>>(new Set());
  const [likingReviews, setLikingReviews] = useState<Set<string>>(new Set());

  const { reviews, userReview, loading, addReview, updateReview, deleteReview, likeReview, hasUserLikedReview, getAverageRating } = useReviews(contentId, contentType);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Check initial like status for all reviews
  useEffect(() => {
    const checkLikedReviews = async () => {
      if (!isAuthenticated || reviews.length === 0) return;

      const likedSet = new Set<string>();
      for (const review of reviews) {
        const isLiked = await hasUserLikedReview(review.id);
        if (isLiked) {
          likedSet.add(review.id);
        }
      }
      setLikedReviews(likedSet);
    };

    checkLikedReviews();
  }, [reviews, isAuthenticated, hasUserLikedReview]);

  const handleLikeReview = async (reviewId: string) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to like reviews",
        variant: "destructive"
      });
      return;
    }

    setLikingReviews(prev => new Set(prev).add(reviewId));

    try {
      const isNowLiked = await likeReview(reviewId);
      setLikedReviews(prev => {
        const newSet = new Set(prev);
        if (isNowLiked) {
          newSet.add(reviewId);
        } else {
          newSet.delete(reviewId);
        }
        return newSet;
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to like review",
        variant: "destructive"
      });
    } finally {
      setLikingReviews(prev => {
        const newSet = new Set(prev);
        newSet.delete(reviewId);
        return newSet;
      });
    }
  };

  const handleSubmitReview = async () => {
    if (!rating) {
      toast({
        title: "Rating required",
        description: "Please select a rating before submitting",
        variant: "destructive"
      });
      return;
    }

    if (!reviewText.trim()) {
      toast({
        title: "Review required",
        description: "Please write a review before submitting",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && userReview) {
        await updateReview(userReview.id, rating, reviewText);
        toast({
          title: "Review updated",
          description: "Your review has been updated successfully"
        });
      } else {
        await addReview(contentId, contentType, contentTitle, contentPosterPath, rating, reviewText);
        toast({
          title: "Review submitted",
          description: "Your review has been posted successfully"
        });
      }
      setShowWriteReview(false);
      setIsEditing(false);
      setRating(0);
      setReviewText('');
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit review",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!userReview) return;

    try {
      await deleteReview(userReview.id);
      toast({
        title: "Review deleted",
        description: "Your review has been removed"
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete review",
        variant: "destructive"
      });
    }
  };

  const handleEditReview = () => {
    if (userReview) {
      setRating(userReview.rating);
      setReviewText(userReview.review_text);
      setIsEditing(true);
      setShowWriteReview(true);
    }
  };

  const avgRating = getAverageRating();

  return (
    <div className="w-full px-4 md:px-16 py-12 md:py-20 bg-gradient-to-b from-black to-gray-900">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Reviews</h2>
            <div className="flex items-center space-x-4">
              <StarRating rating={Math.round(avgRating)} />
              <span className="text-gray-400">({reviews.length} reviews)</span>
            </div>
          </div>

          {isAuthenticated && !userReview && !showWriteReview && (
            <Button
              onClick={() => setShowWriteReview(true)}
              className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Write Review
            </Button>
          )}
        </div>

        {/* Write Review Form */}
        <AnimatePresence>
          {showWriteReview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8"
            >
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">
                  {isEditing ? 'Edit Your Review' : 'Write a Review'}
                </h3>

                <div className="mb-4">
                  <label className="text-sm text-gray-400 mb-2 block">Your Rating</label>
                  <StarRating rating={rating} onRate={setRating} editable size="lg" />
                </div>

                <div className="mb-4">
                  <label className="text-sm text-gray-400 mb-2 block">Your Review</label>
                  <Textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Share your thoughts about this content..."
                    className="bg-white/5 border-white/10 text-white min-h-[120px] resize-none"
                  />
                </div>

                <div className="flex items-center space-x-3">
                  <Button
                    onClick={handleSubmitReview}
                    disabled={submitting}
                    className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {submitting ? 'Submitting...' : isEditing ? 'Update Review' : 'Post Review'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowWriteReview(false);
                      setIsEditing(false);
                      setRating(0);
                      setReviewText('');
                    }}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reviews List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No reviews yet. Be the first to review!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  isOwner={userReview?.id === review.id}
                  onEdit={handleEditReview}
                  onDelete={handleDeleteReview}
                  onLike={() => handleLikeReview(review.id)}
                  isLiked={likedReviews.has(review.id)}
                  isLiking={likingReviews.has(review.id)}
                  isAuthenticated={isAuthenticated}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {!isAuthenticated && (
          <div className="mt-8 text-center p-6 bg-white/5 rounded-xl border border-white/10">
            <p className="text-gray-400 mb-4">Sign in to write a review</p>
            <Button
              onClick={() => window.location.href = '/auth'}
              className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
            >
              Sign In
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewSection;
