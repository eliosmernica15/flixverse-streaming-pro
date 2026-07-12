"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import type { PartyMediaParticipant } from "@/hooks/player/usePartyMedia";
import { VoiceVolumeSlider } from "./PartyMembersPanel";

function RemoteAudioSink({ stream, volume }: { stream: MediaStream; volume: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
    el.srcObject = stream;
    void el.play().catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, [stream, volume]);
  return <audio ref={audioRef} autoPlay playsInline className="sr-only" aria-hidden />;
}

function CameraTile({
  participant,
  voiceVolume,
}: {
  participant: PartyMediaParticipant;
  voiceVolume: number;
}) {
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
          <RemoteAudioSink stream={participant.stream} volume={voiceVolume} />
          <div className="party-camera-avatar">
            <span>{participant.displayName.charAt(0).toUpperCase()}</span>
          </div>
        </>
      )}
      <div className="party-camera-tile-bar">
        <span className="party-camera-name">{participant.displayName}</span>
        {participant.micMutedByHost ? (
          <MicOff className="w-3 h-3 text-red-400/80" />
        ) : participant.hasAudio ? (
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
  voiceVolume?: number;
}

export function PartyCameraGrid({ participants, voiceVolume = 1 }: PartyCameraGridProps) {
  const visible = participants.filter((p) => p.hasVideo || p.hasAudio);
  if (!visible.length) return null;

  return (
    <aside className="party-camera-grid" aria-label="Party cameras">
      <p className="party-camera-grid-label">Party ({visible.length})</p>
      <div className="party-camera-grid-scroll">
        {visible.map((p) => (
          <CameraTile key={p.peerId} participant={p} voiceVolume={voiceVolume} />
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
  voiceVolume?: number;
  hostMicForcedOff?: boolean;
  hostCamForcedOff?: boolean;
  disabled?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onVoiceVolumeChange?: (v: number) => void;
}

export function PartyMediaControls({
  micOn,
  cameraOn,
  cameraMode,
  anyoneSpeaking,
  mediaError,
  voiceVolume = 1,
  hostMicForcedOff,
  hostCamForcedOff,
  disabled,
  onToggleMic,
  onToggleCamera,
  onVoiceVolumeChange,
}: PartyMediaControlsProps) {
  return (
    <div className="party-media-controls">
      <button
        type="button"
        className={`party-media-btn ${micOn ? "is-on" : ""} ${anyoneSpeaking && micOn ? "is-speaking" : ""}`}
        onClick={onToggleMic}
        disabled={disabled || hostMicForcedOff}
        title={hostMicForcedOff ? "Mic muted by host" : micOn ? "Mute microphone" : "Unmute microphone"}
        aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
        aria-pressed={micOn}
      >
        {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        <span>{hostMicForcedOff ? "Muted by host" : micOn ? "Mic on" : "Mic off"}</span>
      </button>
      <button
        type="button"
        className={`party-media-btn ${cameraOn ? "is-on" : ""}`}
        onClick={onToggleCamera}
        disabled={disabled || hostCamForcedOff}
        title={hostCamForcedOff ? "Camera disabled by host" : cameraOn ? "Turn off camera" : "Turn on camera"}
        aria-label={cameraOn ? "Turn off camera" : "Turn on camera"}
        aria-pressed={cameraOn}
      >
        {cameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        <span>{hostCamForcedOff ? "Cam blocked" : cameraOn ? "Cam on" : "Cam off"}</span>
      </button>
      {onVoiceVolumeChange && (
        <VoiceVolumeSlider value={voiceVolume} onChange={onVoiceVolumeChange} />
      )}
      {cameraMode && (
        <span className="party-media-hint">Movie left · cameras right · HD when available</span>
      )}
      {mediaError && <p className="party-media-error">{mediaError}</p>}
    </div>
  );
}
