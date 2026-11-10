"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  mergeParticles,
  particleFor,
  selectNewReactions,
  type ReactionParticle,
  type ReactionSource,
} from "@/lib/player/spatialReactions";

interface SpatialReactionsLayerProps {
  /** Party chat messages; emoji messages become floating particles. */
  messages: readonly ReactionSource[];
  enabled: boolean;
}

/**
 * Floating reactions over the video. Pointer-transparent, aria-hidden (the
 * same reaction is already announced in the chat log), and each particle
 * removes itself on `animationend` so nothing accumulates over a long party.
 */
function SpatialReactionsLayerImpl({ messages, enabled }: SpatialReactionsLayerProps) {
  const [particles, setParticles] = useState<ReactionParticle[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      // Keep marking ids as seen so re-enabling does not replay a backlog.
      for (const m of messages) seenRef.current.add(m.id);
      setParticles((prev) => (prev.length ? [] : prev));
      return;
    }
    // First delivery is history (joining mid-party): record, don't animate.
    if (!primedRef.current) {
      primedRef.current = true;
      for (const m of messages) seenRef.current.add(m.id);
      return;
    }
    const fresh = selectNewReactions(messages, seenRef.current, Date.now());
    if (!fresh.length) return;
    const incoming = fresh.map(particleFor).filter((p): p is ReactionParticle => p !== null);
    if (incoming.length) setParticles((prev) => mergeParticles(prev, incoming));
  }, [messages, enabled]);

  const remove = useCallback((id: string) => {
    setParticles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  if (!enabled || particles.length === 0) return null;

  return (
    <div className="spatial-reactions" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="spatial-reaction"
          style={
            {
              left: `${p.xPercent}%`,
              "--reaction-sway": `${p.swayPx}px`,
              "--reaction-scale": p.scale,
              animationDuration: `${p.durationMs}ms`,
            } as React.CSSProperties
          }
          onAnimationEnd={() => remove(p.id)}
        >
          <span className="spatial-reaction__emoji">{p.emoji}</span>
          <span className="spatial-reaction__name">{p.senderName}</span>
        </span>
      ))}
    </div>
  );
}

export const SpatialReactionsLayer = memo(SpatialReactionsLayerImpl);
