"use client";

import type { CaptionCue } from "@/lib/player/captionParser";
import type { CaptionSize, CaptionStyle, CaptionPosition } from "@/lib/player/captionPreferences";

interface CaptionOverlayProps {
  cue: CaptionCue | null;
  visible: boolean;
  source?: "external" | "fallback" | null;
  size?: CaptionSize;
  style?: CaptionStyle;
  position?: CaptionPosition;
  opacity?: number;
}

export function CaptionOverlay({
  cue,
  visible,
  source,
  size = "medium",
  style = "boxed",
  position = "bottom",
  opacity = 0.92,
}: CaptionOverlayProps) {
  if (!visible || !cue) return null;

  return (
    <div
      className={`video-caption video-caption--${size} video-caption--${style} video-caption--${position}`}
      style={{ opacity }}
      role="status"
      aria-live="polite"
    >
      {source === "fallback" && (
        <span className="video-caption-demo" aria-hidden="true">
          CC
        </span>
      )}
      {cue.text.split("\n").map((line, i) => (
        <span key={i} className="block">
          {line}
        </span>
      ))}
    </div>
  );
}
