"use client";

import { useState, useRef, useCallback } from "react";
import { MessageCircle, Plus } from "lucide-react";
import type { TimelineComment } from "@/hooks/player/useTimelineComments";
import { TimelineCommentPopup } from "./TimelineCommentPopup";

interface Marker {
  timestamp: number;
  progress: number;
  count: number;
}

interface PlayerOverlayControlsProps {
  currentTime: number;
  totalDuration: number;
  markers: Marker[];
  nearbyComments: TimelineComment[];
  onSeek: (seconds: number) => void;
  onAddComment: (timestamp: number) => void;
  onLikeComment: (commentId: string) => void;
  isPlaying: boolean;
  controlsVisible: boolean;
  buffered?: number;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PlayerOverlayControls({
  currentTime,
  totalDuration,
  markers,
  nearbyComments,
  onSeek,
  onAddComment,
  onLikeComment,
  isPlaying: _isPlaying,
  controlsVisible: _controlsVisible,
  buffered,
}: PlayerOverlayControlsProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [hoverProgress, setHoverProgress] = useState(0);
  const [hoverTime, setHoverTime] = useState(0);
  const [activeMarker, setActiveMarker] = useState<Marker | null>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const bufferedProgress =
    buffered && totalDuration > 0 ? Math.min(100, (buffered / totalDuration) * 100) : Math.min(100, progress + 6);

  const handleScrubberMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const rect = scrubberRef.current?.getBoundingClientRect();
      if (!rect) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const pct = x / rect.width;
      setHoverProgress(pct * 100);
      setHoverTime(pct * totalDuration);
    },
    [totalDuration]
  );

  const handleScrubberClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const rect = scrubberRef.current?.getBoundingClientRect();
      if (!rect) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const pct = x / rect.width;
      onSeek(pct * totalDuration);
    },
    [totalDuration, onSeek]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (totalDuration <= 0) return;
      const step = e.shiftKey ? 10 : 5;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onSeek(Math.min(totalDuration, currentTime + step));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onSeek(Math.max(0, currentTime - step));
      } else if (e.key === "Home") {
        e.preventDefault();
        onSeek(0);
      } else if (e.key === "End") {
        e.preventDefault();
        onSeek(totalDuration);
      }
    },
    [totalDuration, currentTime, onSeek]
  );

  return (
    <div className="video-scrubber-row">
      <div
        ref={scrubberRef}
        className="video-scrubber"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => {
          setIsHovering(false);
          setActiveMarker(null);
        }}
        onMouseMove={handleScrubberMove}
        onClick={handleScrubberClick}
        onTouchStart={(e) => {
          setIsHovering(true);
          handleScrubberMove(e);
        }}
        onTouchEnd={(e) => {
          handleScrubberClick(e);
          setIsHovering(false);
        }}
        onKeyDown={handleKeyDown}
        role="slider"
        aria-label="Seek video"
        aria-valuemin={0}
        aria-valuemax={Math.round(totalDuration)}
        aria-valuenow={Math.round(currentTime)}
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(totalDuration)}`}
        tabIndex={0}
      >
        <div className="video-scrubber-track">
          {/* Buffered / loaded look */}
          <div className="video-scrubber-buffered" style={{ width: `${bufferedProgress}%` }} />
          {/* Progress fill */}
          <div className="video-scrubber-fill" style={{ width: `${progress}%` }} />
          {/* Hover preview */}
          {isHovering && (
            <div className="video-scrubber-hover" style={{ width: `${hoverProgress}%` }} />
          )}
        </div>

        {/* Comment markers */}
        {markers.map((marker, i) => {
          const level = marker.count > 5 ? "high" : marker.count > 2 ? "mid" : "low";
          return (
            <div
              key={`${marker.timestamp}-${i}`}
              className={`video-marker video-marker-count-${level} ${
                activeMarker === marker ? "is-active" : ""
              }`}
              style={{ left: `${marker.progress * 100}%` }}
              onMouseEnter={() => setActiveMarker(marker)}
              onMouseLeave={() => setActiveMarker(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(marker.timestamp);
              }}
              role="button"
              tabIndex={0}
              aria-label={`Jump to comment at ${formatTime(marker.timestamp)} (${marker.count} comments)`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onSeek(marker.timestamp);
                }
              }}
            />
          );
        })}

        {/* Playhead */}
        <div className="video-scrubber-playhead" style={{ left: `${progress}%` }} />

        {/* Hover time tooltip */}
        {isHovering && !activeMarker && (
          <div className="video-scrubber-tooltip" style={{ left: `${hoverProgress}%` }}>
            {formatTime(hoverTime)}
          </div>
        )}

        {/* Comment popup on marker hover */}
        {activeMarker && nearbyComments.length > 0 && (
          <div
            className="absolute z-50"
            style={{ left: `${activeMarker.progress * 100}%`, bottom: "calc(100% + 8px)", transform: "translateX(-50%)" }}
          >
            <TimelineCommentPopup comments={nearbyComments} onLike={onLikeComment} position="top" />
          </div>
        )}
      </div>

      {/* Add comment at current time */}
      <button
        type="button"
        className="video-add-comment"
        onClick={() => onAddComment(currentTime)}
        aria-label="Add comment at current time"
        title="Add comment (L)"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}
