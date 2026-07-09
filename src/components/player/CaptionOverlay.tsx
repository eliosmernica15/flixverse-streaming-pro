"use client";

import type { CaptionCue } from "@/lib/player/captionParser";

interface CaptionOverlayProps {
  cue: CaptionCue | null;
  visible: boolean;
  source?: "external" | "fallback" | null;
}

export function CaptionOverlay({ cue, visible, source }: CaptionOverlayProps) {
  if (!visible || !cue) return null;

  return (
    <div className="video-caption" role="status" aria-live="polite">
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
