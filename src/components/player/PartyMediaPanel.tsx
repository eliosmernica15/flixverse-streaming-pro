"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import type { PartyMediaParticipant } from "@/hooks/player/usePartyMedia";

function RemoteAudioSink({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, [stream]);
  return <audio ref={audioRef} autoPlay playsInline className="sr-only" aria-hidden />;
}

function CameraTile({ participant }: { participant: PartyMediaParticipant }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = participant.hasVideo ? participant.stream : null;
    return () => {
      el.srcObject = null;
    };
  }, [participant.stream, participant.hasVideo]);

  return (
    <div
      className={`party-camera-tile ${participant.isSpeaking ? "is-speaking" : ""} ${participant.isLocal ? "is-local" : ""}`}
    >
      {participant.hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className="party-camera-video"
        />
      ) : participant.isLocal ? (
        <div className="party-camera-avatar">
          <span>{participant.displayName.charAt(0).toUpperCase()}</span>
        </div>
      ) : (
        <>
          <RemoteAudioSink stream={participant.stream} />
          <div className="party-camera-avatar">
            <span>{participant.displayName.charAt(0).toUpperCase()}</span>
          </div>
        </>
      )}
      <div className="party-camera-tile-bar">
        <span className="party-camera-name">{participant.displayName}</span>
        {participant.hasAudio ? (
          participant.isSpeaking ? (
            <Mic className="w-3 h-3 text-emerald-400" />
          ) : (
            <Mic className="w-3 h-3 text-white/50" />
          )
        ) : (
          <MicOff className="w-3 h-3 text-red-400/80" />
        )}
      </div>
      {participant.isSpeaking && <span className="party-camera-speaking-ring" aria-hidden />}
    </div>
  );
}

interface PartyCameraGridProps {
  participants: PartyMediaParticipant[];
}

export function PartyCameraGrid({ participants }: PartyCameraGridProps) {
  const visible = participants.filter((p) => p.hasVideo || p.hasAudio);
  if (!visible.length) return null;

  return (
    <aside className="party-camera-grid" aria-label="Party cameras">
      <p className="party-camera-grid-label">Party ({visible.length})</p>
      <div className="party-camera-grid-scroll">
        {visible.map((p) => (
          <CameraTile key={p.peerId} participant={p} />
        ))}
      </div>
    </aside>
  );
}

interface PartyMediaControlsProps {
  micOn: boolean;
  cameraOn: boolean;
  cameraMode: boolean;
  anyoneSpeaking: boolean;
  mediaError: string | null;
  disabled?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
}

export function PartyMediaControls({
  micOn,
  cameraOn,
  cameraMode,
  anyoneSpeaking,
  mediaError,
  disabled,
  onToggleMic,
  onToggleCamera,
}: PartyMediaControlsProps) {
  return (
    <div className="party-media-controls">
      <button
        type="button"
        className={`party-media-btn ${micOn ? "is-on" : ""} ${anyoneSpeaking && micOn ? "is-speaking" : ""}`}
        onClick={onToggleMic}
        disabled={disabled}
        title={micOn ? "Mute microphone" : "Unmute microphone"}
        aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
        aria-pressed={micOn}
      >
        {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        <span>{micOn ? "Mic on" : "Mic off"}</span>
      </button>
      <button
        type="button"
        className={`party-media-btn ${cameraOn ? "is-on" : ""}`}
        onClick={onToggleCamera}
        disabled={disabled}
        title={cameraOn ? "Turn off camera" : "Turn on camera"}
        aria-label={cameraOn ? "Turn off camera" : "Turn on camera"}
        aria-pressed={cameraOn}
      >
        {cameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        <span>{cameraOn ? "Cam on" : "Cam off"}</span>
      </button>
      {cameraMode && (
        <span className="party-media-hint">Movie left · cameras right</span>
      )}
      {mediaError && <p className="party-media-error">{mediaError}</p>}
    </div>
  );
}
