"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Mic, Volume2, VolumeX, Waves, AlertCircle } from "lucide-react";
import type { PTTState } from "./PTTIndicator";

/**
 * VoiceActivityIndicator — visual feedback for voice activity in a party.
 *
 * Shows a pulsing ring when someone is speaking, with optional:
 * - Hands-free mode indicator (when VAD is active)
 * - Muted-by-host indicator
 * - PTT state sync (listening/locked/idle)
 * - Volume level meter
 *
 * Designed to sit next to the mic button in PartyMediaControls and in the
 * party sidebar. Animates a pulsing ring while transmitting so the user gets
 * immediate tactile/visual confirmation that they are on-air.
 */

export interface VoiceActivityIndicatorProps {
  /** Whether someone is currently speaking (local or remote) */
  anyoneSpeaking: boolean;
  /** Whether the local user's mic is on */
  micOn: boolean;
  /** Whether the local user is currently transmitting (PTT engaged) */
  isTransmitting: boolean;
  /** Current PTT state for visual sync */
  pttState?: "idle" | "listening" | "locked";
  /** Whether the host has muted the local user */
  hostMuted?: boolean;
  /** Optional keyboard hint (e.g. "Space" or "Hold Space") */
  shortcut?: string;
  /** Compact mode for tight layouts */
  compact?: boolean;
  /** Whether hands-free (VAD) mode is active */
  handsFree?: boolean;
  /** Current voice volume level (0-1) for the local user */
  voiceVolume?: number;
  /** Custom className */
  className?: string;
}

export function VoiceActivityIndicator({
  anyoneSpeaking,
  micOn,
  isTransmitting,
  pttState,
  hostMuted = false,
  shortcut = "Space",
  compact = false,
  handsFree = false,
  voiceVolume = 1,
  className = "",
}: VoiceActivityIndicatorProps) {
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [showHandsFreeHint, setShowHandsFreeHint] = useState(false);
  const volumeRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Voice level visualization - animate when someone is speaking
  useEffect(() => {
    if (anyoneSpeaking && micOn) {
      // Animate volume level for visual feedback
      const animate = () => {
        // Simulate voice level with some randomness for visual effect
        const baseLevel = voiceVolume * 0.7;
        const variance = Math.random() * 0.3;
        volumeRef.current = Math.min(1, baseLevel + variance);
        setVolumeLevel(volumeRef.current);
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
      return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
    } else {
      // Decay to zero when not speaking
      const decay = () => {
        if (volumeRef.current > 0.01) {
          volumeRef.current *= 0.9;
          setVolumeLevel(volumeRef.current);
          animationRef.current = requestAnimationFrame(decay);
        } else {
          volumeRef.current = 0;
          setVolumeLevel(0);
        }
      };
      animationRef.current = requestAnimationFrame(decay);
      return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
    };
  }, [anyoneSpeaking, micOn, voiceVolume]);

  // Show hands-free hint on first activation
  useEffect(() => {
    if (handsFree && !showHandsFreeHint) {
      setShowHandsFreeHint(true);
      hintTimeoutRef.current = setTimeout(() => {
        setShowHandsFreeHint(false);
      }, 5000);
    }
    return () => {
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    };
  }, [handsFree, showHandsFreeHint]);

  const isLive = isTransmitting || (micOn && anyoneSpeaking);
  const isLocked = pttState === "locked";

  if (compact && !anyoneSpeaking && !isLive && !hostMuted && !handsFree) {
    return null;
  }

  return (
    <div
      className={`voice-activity-indicator ${isLive ? "is-live" : ""} ${isLocked ? "is-locked" : ""} ${handsFree ? "is-hands-free" : ""} ${hostMuted ? "is-host-muted" : ""} ${compact ? "compact" : ""} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={
        hostMuted
          ? "Microphone muted by host"
          : isLive
            ? "Transmitting"
            : handsFree
              ? "Hands-free listening"
              : "Push to talk ready"
      }
    >
      <div className="voice-activity-indicator__icon" aria-hidden="true">
        {hostMuted ? (
          <span className="voice-activity-icon voice-activity-icon--muted">
            <VolumeX className="w-4 h-4" />
          </span>
        ) : isLive ? (
          <span className="voice-activity-icon voice-activity-icon--live">
            <Volume2 className="w-4 h-4" />
          </span>
        ) : handsFree ? (
          <span className="voice-activity-icon voice-activity-icon--hands-free">
            <Waves className="w-4 h-4" />
          </span>
        ) : (
          <span className="voice-activity-icon voice-activity-icon--idle">
            <Mic className="w-4 h-4" />
          </span>
        )}

        {/* Pulsing ring when live */}
        {isLive && <span className="voice-activity-ring" aria-hidden />}

        {/* Hands-free badge */}
        {handsFree && !compact && (
          <span className="voice-activity-badge voice-activity-badge--hands-free" aria-label="Hands-free mode active">
            <Waves className="w-3 h-3" />
            <span>Hands-free</span>
          </span>
        )}

        {/* PTT state indicator */}
        {pttState && pttState !== "idle" && !compact && (
          <span className={`voice-activity-badge voice-activity-badge--ptt ${pttState === "locked" ? "locked" : ""}`} aria-label={pttState === "locked" ? "PTT locked" : "PTT listening"}>
            {pttState === "locked" ? "Locked" : "Listening"}
          </span>
        )}
      </div>

      {/* Volume level meter */}
      {!compact && (
        <div className="voice-activity-volume" role="img" aria-label={`Voice volume ${Math.round(voiceVolume * 100)}%`}>
          <div
            className="voice-activity-volume-bar"
            role="progressbar"
            aria-valuenow={Math.round(volumeLevel * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ width: `${volumeLevel * 100}%` }}
          />
        </div>
      )}

      {/* Hands-free hint toast */}
      {showHandsFreeHint && !compact && (
        <div className="voice-activity-hint" role="status" aria-live="polite">
          <Waves className="w-4 h-4" />
          <span>Hands-free mode active — speak freely</span>
          <kbd className="voice-activity-hint-key">Space</kbd>
          <span>to toggle</span>
        </div>
      )}

      {/* Host muted indicator */}
      {hostMuted && !compact && (
        <div className="voice-activity-hint voice-activity-hint--muted" role="alert">
          <AlertCircle className="w-4 h-4" />
          <span>Microphone muted by host</span>
        </div>
      )}

      {!compact && !isLive && !hostMuted && !handsFree && (
        <kbd className="voice-activity-kbd">{shortcut}</kbd>
      )}
    </div>
  );
}

export default memo(VoiceActivityIndicator);