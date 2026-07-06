"use client";

import { Heart, MessageCircle } from "lucide-react";
import type { TimelineComment } from "@/hooks/player/useTimelineComments";

interface TimelineCommentPopupProps {
  comments: TimelineComment[];
  onLike: (commentId: string) => void;
  position?: "top" | "bottom";
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TimelineCommentPopup({
  comments,
  onLike,
  position = "top",
}: TimelineCommentPopupProps) {
  if (comments.length === 0) return null;

  const positionClass =
    position === "top" ? "bottom-full mb-2" : "top-full mt-2";

  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 ${positionClass} z-30 w-64 pointer-events-auto`}
    >
      <div className="bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 border-b border-white/5 flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5 text-red-400" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {comments.length} comment{comments.length !== 1 ? "s" : ""} at{" "}
            {formatTimestamp(comments[0].timestampSeconds)}
          </span>
        </div>

        {/* Comments */}
        <div className="max-h-48 overflow-y-auto">
          {comments.slice(0, 5).map((comment) => (
            <div
              key={comment.id}
              className="px-3 py-2.5 border-b border-white/5 last:border-0"
            >
              <div className="flex items-start gap-2">
                {comment.userAvatarUrl ? (
                  <img
                    src={comment.userAvatarUrl}
                    alt={comment.userDisplayName}
                    className="w-5 h-5 rounded-full object-cover shrink-0 mt-0.5"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-[8px] font-bold text-white shrink-0 mt-0.5">
                    {comment.userDisplayName.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-gray-300 truncate">
                      {comment.userDisplayName}
                    </span>
                    <span className="text-[10px] text-gray-600">
                      {formatTimestamp(comment.timestampSeconds)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    {comment.text}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onLike(comment.id)}
                  className="flex items-center gap-0.5 text-gray-600 hover:text-red-400 transition-colors shrink-0"
                  aria-label={`Like comment (${comment.likesCount})`}
                >
                  <Heart className="w-3 h-3" />
                  {comment.likesCount > 0 && (
                    <span className="text-[10px]">{comment.likesCount}</span>
                  )}
                </button>
              </div>
            </div>
          ))}
          {comments.length > 5 && (
            <div className="px-3 py-2 text-center">
              <span className="text-[10px] text-gray-600">
                +{comments.length - 5} more
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
