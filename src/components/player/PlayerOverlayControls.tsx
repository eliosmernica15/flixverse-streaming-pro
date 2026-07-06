"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  MessageCircle,
  Plus,
} from "lucide-react";
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
}

function formatTime(seconds: number): string {
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
  isPlaying,
  controlsVisible,
}: PlayerOverlayControlsProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [hoverProgress, setHoverProgress] = useState(0);
  const [hoverTime, setHoverTime] = useState(0);
  const [activeMarker, setActiveMarker] = useState<Marker | null>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

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

  const handleMarkerHover = useCallback((marker: Marker) => {
    setActiveMarker(marker);
  }, []);

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${
        controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

      <div className="relative px-4 pb-4 pt-12">
        {/* Scrubber */}
        <div
          ref={scrubberRef}
          className="relative h-8 cursor-pointer group"
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
          role="slider"
          aria-label="Video progress"
          aria-valuemin={0}
          aria-valuemax={totalDuration}
          aria-valuenow={currentTime}
          tabIndex={0}
        >
          {/* Track background */}
          <div className="absolute bottom-3 left-0 right-0 h-1 bg-white/20 rounded-full overflow-hidden group-hover:h-1.5 transition-all">
            {/* Progress fill */}
            <div
              className="h-full bg-red-500 rounded-full transition-[width] duration-75"
              style={{ width: `${progress}%` }}
            />

            {/* Hover preview */}
            {isHovering && (
              <div
                className="absolute inset-0 bg-white/30 rounded-full"
                style={{ width: `${hoverProgress}%` }}
              />
            )}
          </div>

          {/* Comment markers */}
          {markers.map((marker, i) => (
            <div
              key={`${marker.timestamp}-${i}`}
              className="absolute bottom-2 -translate-x-1/2 group/marker"
              style={{ left: `${marker.progress * 100}%` }}
              onMouseEnter={() => handleMarkerHover(marker)}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full border-2 border-zinc-900 transition-colors ${
                  marker.count > 5
                    ? "bg-red-500"
                    : marker.count > 2
                      ? "bg-amber-500"
                      : "bg-gray-400"
                }`}
              />
            </div>
          ))}

          {/* Playhead */}
          <div
            className="absolute bottom-1.5 -translate-x-1/2 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progress}%` }}
          />

          {/* Hover time tooltip */}
          {isHovering && !activeMarker && (
            <div
              className="absolute -top-8 -translate-x-1/2 px-2 py-1 rounded bg-black/90 text-[11px] font-mono text-white border border-white/10 pointer-events-none"
              style={{ left: `${hoverProgress}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Time display */}
        <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono mt-0.5">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(totalDuration)}</span>
        </div>

        {/* Comment popup on marker hover */}
        {activeMarker && nearbyComments.length > 0 && (
          <div
            className="absolute bottom-20 -translate-x-1/2"
            style={{ left: `${activeMarker.progress * 100}%` }}
          >
            <TimelineCommentPopup
              comments={nearbyComments}
              onLike={onLikeComment}
              position="top"
            />
          </div>
        )}

        {/* Add comment button */}
        <button
          type="button"
          onClick={() => onAddComment(currentTime)}
          className="absolute right-4 bottom-16 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs text-gray-300 hover:bg-white/20 hover:text-white transition-colors backdrop-blur-sm"
          aria-label="Add comment at current time"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
