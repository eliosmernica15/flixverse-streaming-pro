"use client";

import { memo, useState, useCallback, useEffect, useRef } from "react";
import { Sparkles, Heart, Flame, ThumbsUp, Laugh, Droplet, X, Smile } from "lucide-react";
import { fireHaptic, isHapticsEnabled } from "@/lib/player/haptics";

/**
 * ReactionMobileBar — tap-to-react bar for mobile devices.
 *
 * A floating bar that appears when a user long-presses or taps the reaction
 * zone on mobile. Shows emoji reactions that can be tapped to send a reaction
 * in the party chat. Designed for touch-friendly interaction on mobile.
 *
 * Features:
 * - Floating bar with emoji buttons
 * - Haptic feedback on tap
 * - Auto-hide after inactivity
 * - Persistent "more" button for additional reactions
 * - Accessible with proper ARIA labels
 */

interface ReactionMobileBarProps {
  /** Whether the bar is visible */
  visible: boolean;
  /** Callback when a reaction is selected */
  onReact: (emoji: string) => void;
  /** Whether the bar should auto-hide after inactivity */
  autoHide?: boolean;
  /** Time in ms before auto-hiding */
  autoHideDelay?: number;
  /** Position: 'bottom' or 'top' */
  position?: "bottom" | "top";
  /** Custom className */
  className?: string;
}

const DEFAULT_REACTIONS = [
  { emoji: "❤️", label: "Love", key: "love" },
  { emoji: "🔥", label: "Fire", key: "fire" },
  { emoji: "👍", label: "Thumbs Up", key: "thumbsUp" },
  { emoji: "😂", label: "Laugh", key: "laugh" },
  { emoji: "😭", label: "Cry", key: "cry" },
  { emoji: "✨", label: "Sparkles", key: "sparkles" },
];

const MORE_REACTIONS = [
  { emoji: "😍", label: "Heart Eyes", key: "heartEyes" },
  { emoji: "🤔", label: "Thinking", key: "thinking" },
  { emoji: "😱", label: "Shocked", key: "shocked" },
  { emoji: "😎", label: "Cool", key: "cool" },
  { emoji: "🎉", label: "Party", key: "party" },
  { emoji: "💯", label: "Hundred", key: "hundred" },
];

export function ReactionMobileBar({
  visible,
  onReact,
  autoHide = true,
  autoHideDelay = 5000,
  position = "bottom",
  className = "",
}: ReactionMobileBarProps) {
  const [showMore, setShowMore] = useState(false);
  const [showingReactions, setShowingReactions] = useState(DEFAULT_REACTIONS);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const hapticsEnabled = isHapticsEnabled();

  // Reset to default reactions when visibility changes
  useEffect(() => {
    if (visible) {
      setShowingReactions(DEFAULT_REACTIONS);
      setShowMore(false);
    }
  }, [visible]);

  // Auto-hide timer
  useEffect(() => {
    if (!visible || !autoHide) return;

    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      // Don't hide if user is hovering/focused
      if (barRef.current && (barRef.current.matches(":hover") || document.activeElement === barRef.current)) {
        return;
      }
      // The parent should handle hiding
      // We emit a custom event for the parent to handle
      window.dispatchEvent(new CustomEvent("reaction-bar-auto-hide"));
    }, autoHideDelay);

    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [visible, autoHide, autoHideDelay]);

  const handleReact = useCallback(
    (emoji: string) => {
      // Trigger haptic feedback
      if (hapticsEnabled) {
        fireHaptic("light");
      }

      // Call the reaction callback
      onReact(emoji);

      // Reset auto-hide timer
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = setTimeout(() => {
        window.dispatchEvent(new CustomEvent("reaction-bar-auto-hide"));
      }, autoHideDelay);
    },
    [onReact, autoHideDelay]
  );

  const handleMoreClick = useCallback(() => {
    if (showMore) {
      setShowingReactions(DEFAULT_REACTIONS);
      setShowMore(false);
    } else {
      setShowingReactions(MORE_REACTIONS);
      setShowMore(true);
    }
  }, [showMore]);

  const handleClose = useCallback(() => {
    window.dispatchEvent(new CustomEvent("reaction-bar-close"));
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={barRef}
      className={`reaction-mobile-bar ${position === "top" ? "position-top" : "position-bottom"} ${className}`}
      role="toolbar"
      aria-label="Reaction bar"
      onMouseEnter={() => {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      }}
      onMouseLeave={() => {
        if (autoHide) {
          hideTimeoutRef.current = setTimeout(() => {
            window.dispatchEvent(new CustomEvent("reaction-bar-auto-hide"));
          }, autoHideDelay);
        }
      }}
    >
      <div className="reaction-mobile-bar__inner">
        {showingReactions.map((reaction) => (
          <button
            key={reaction.key}
            type="button"
            className="reaction-mobile-bar__btn"
            onClick={() => handleReact(reaction.emoji)}
            aria-label={reaction.label}
            title={reaction.label}
          >
            <span className="reaction-mobile-bar__emoji" aria-hidden="true">
              {reaction.emoji}
            </span>
            <span className="reaction-mobile-bar__label">{reaction.label}</span>
          </button>
        ))}

        {/* More/Close button */}
        <button
          type="button"
          className={`reaction-mobile-bar__more ${showMore ? "is-open" : ""}`}
          onClick={handleMoreClick}
          aria-label={showMore ? "Show fewer reactions" : "Show more reactions"}
          aria-expanded={showMore}
        >
          {showMore ? (
            <X className="w-5 h-5" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
          <span className="reaction-mobile-bar__more-label" aria-hidden="true">
            {showMore ? "Less" : "More"}
          </span>
        </button>

        {/* Close button */}
        <button
          type="button"
          className="reaction-mobile-bar__close"
          onClick={handleClose}
          aria-label="Close reaction bar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Animation styles */}
      <style jsx>{`
        .reaction-mobile-bar {
          position: fixed;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          pointer-events: auto;
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .reaction-mobile-bar.position-top {
          top: env(safe-area-inset-top, 1rem);
          animation: slideDown 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .reaction-mobile-bar.position-bottom {
          bottom: env(safe-area-inset-bottom, 1rem);
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .reaction-mobile-bar__inner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: rgba(15, 15, 18, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 50px;
          box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.8),
            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
        }

        .reaction-mobile-bar__btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          min-width: 60px;
        }

        .reaction-mobile-bar__btn:hover,
        .reaction-mobile-bar__btn:focus-visible {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(239, 68, 68, 0.5);
          transform: scale(1.1);
        }

        .reaction-mobile-bar__btn:active {
          transform: scale(0.95);
        }

        .reaction-mobile-bar__emoji {
          font-size: 24px;
          line-height: 1;
          display: block;
        }

        .reaction-mobile-bar__label {
          font-size: 10px;
          font-weight: 500;
          color: #d1d5db;
          white-space: nowrap;
        }

        .reaction-mobile-bar__more {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          color: #fca5a5;
        }

        .reaction-mobile-bar__more:hover,
        .reaction-mobile-bar__more:focus-visible {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.5);
        }

        .reaction-mobile-bar__more.is-open {
          background: rgba(239, 68, 68, 0.3);
          border-color: rgba(239, 68, 68, 0.6);
        }

        .reaction-mobile-bar__more-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .reaction-mobile-bar__close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          cursor: pointer;
          color: #9ca3af;
          transition: all 0.15s ease;
        }

        .reaction-mobile-bar__close:hover,
        .reaction-mobile-bar__close:focus-visible {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.5);
          color: #fca5a5;
        }
      `}</style>
    </div>
  );
}

export default memo(ReactionMobileBar);