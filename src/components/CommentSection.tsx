import { useState } from 'react';
import { MessageCircle, Send, User, ThumbsUp, Reply, Trash2, MoreHorizontal } from 'lucide-react';
import { useComments } from '@/hooks/useComments';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Comment } from '@/integrations/firebase/types';
import { motion, AnimatePresence } from 'framer-motion';

interface CommentSectionProps {
  contentId: number;
  contentType: 'movie' | 'tv';
}

const CommentCard = ({
  comment,
  isOwner,
  onReply,
  onDelete,
  replies,
  depth = 0
}: {
  comment: Comment;
  isOwner: boolean;
  onReply: (parentId: string) => void;
  onDelete: (commentId: string) => void;
  replies: Comment[];
  depth?: number;
}) => {
  const [showReplies, setShowReplies] = useState(true);

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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`${depth > 0 ? 'ml-8 border-l-2 border-white/10 pl-4' : ''}`}
    >
      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
        <div className="flex items-start space-x-3">
          <Avatar className="w-8 h-8">
            <AvatarImage src={comment.user_avatar_url || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500">
              <User className="w-4 h-4 text-white" />
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-white text-sm">{comment.user_display_name}</span>
                <span className="text-xs text-gray-500">{timeAgo(comment.created_at)}</span>
              </div>
              {isOwner && (
                <button
                  onClick={() => onDelete(comment.id)}
                  className="p-1 hover:bg-red-500/20 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              )}
            </div>

            <p className="text-gray-300 text-sm leading-relaxed">{comment.text}</p>

            <div className="flex items-center space-x-4 mt-2">
              <button className="flex items-center space-x-1 text-gray-500 hover:text-white transition-colors text-xs">
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>{comment.likes_count}</span>
              </button>
              {depth < 2 && (
                <button
                  onClick={() => onReply(comment.id)}
                  className="flex items-center space-x-1 text-gray-500 hover:text-white transition-colors text-xs"
                >
                  <Reply className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </button>
              )}
              {replies.length > 0 && (
                <button
                  onClick={() => setShowReplies(!showReplies)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {showReplies ? 'Hide' : 'Show'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nested Replies */}
      <AnimatePresence>
        {showReplies && replies.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 space-y-2"
          >
            {replies.map((reply) => (
              <CommentCard
                key={reply.id}
                comment={reply}
                isOwner={isOwner}
                onReply={onReply}
                onDelete={onDelete}
                replies={[]}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const CommentSection = ({ contentId, contentType }: CommentSectionProps) => {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { comments, loading, addComment, deleteComment, getReplies, getTopLevelComments, commentCount } = useComments(contentId, contentType);
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const handleSubmitComment = async () => {
    if (!newComment.trim()) {
      toast({
        title: "Comment required",
        description: "Please write something before posting",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      await addComment(contentId, contentType, newComment, replyingTo || undefined);
      setNewComment('');
      setReplyingTo(null);
      toast({
        title: "Comment posted",
        description: "Your comment has been added"
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to post comment",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      toast({
        title: "Comment deleted",
        description: "Your comment has been removed"
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete comment",
        variant: "destructive"
      });
    }
  };

  const topLevelComments = getTopLevelComments();

  return (
    <div className="w-full px-4 md:px-16 py-12 md:py-16 bg-black">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center space-x-2 mb-6">
          <MessageCircle className="w-6 h-6 text-white" />
          <h2 className="text-xl md:text-2xl font-bold text-white">
            Comments ({commentCount})
          </h2>
        </div>

        {/* Comment Input */}
        {isAuthenticated ? (
          <div className="mb-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              {replyingTo && (
                <div className="flex items-center justify-between mb-2 px-3 py-2 bg-blue-500/10 rounded-lg">
                  <span className="text-sm text-blue-400">Replying to a comment</span>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <div className="flex items-start space-x-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-gradient-to-br from-red-500 to-orange-500">
                    <User className="w-4 h-4 text-white" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="bg-transparent border-0 text-white min-h-[60px] resize-none focus:ring-0 p-0 placeholder:text-gray-500"
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      onClick={handleSubmitComment}
                      disabled={submitting || !newComment.trim()}
                      size="sm"
                      className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
                    >
                      <Send className="w-4 h-4 mr-1" />
                      {submitting ? 'Posting...' : 'Post'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8 text-center p-6 bg-white/5 rounded-xl border border-white/10">
            <p className="text-gray-400 mb-3">Sign in to join the conversation</p>
            <Button
              onClick={() => window.location.href = '/auth'}
              size="sm"
              className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
            >
              Sign In
            </Button>
          </div>
        )}

        {/* Comments List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
          </div>
        ) : topLevelComments.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">No comments yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {topLevelComments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  isOwner={user?.uid === comment.user_id}
                  onReply={(parentId) => setReplyingTo(parentId)}
                  onDelete={handleDeleteComment}
                  replies={getReplies(comment.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentSection;
