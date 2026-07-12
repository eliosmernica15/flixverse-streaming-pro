"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, Crown } from "lucide-react";
import type { PartyMediaParticipant } from "@/hooks/player/usePartyMedia";
import type { FlixPartyParticipant } from "@/hooks/player/useFlixParty";
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
  isHost,
}: {
  participant: PartyMediaParticipant;
  voiceVolume: number;
  isHost?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = participant.hasVideo ? participant.stream : null;
    if (participant.hasVideo) void el.play().catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, [participant.stream, participant.hasVideo]);

  const initial = participant.displayName.charAt(0).toUpperCase();

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
      ) : (
        <>
          {!participant.isLocal && participant.hasAudio && (
            <RemoteAudioSink stream={participant.stream} volume={voiceVolume} />
          )}
          <div className="party-camera-avatar">
            {participant.avatarUrl ? (
              <img src={participant.avatarUrl} alt="" className="party-camera-avatar-img" />
            ) : (
              <span>{initial}</span>
            )}
          </div>
        </>
      )}
      <div className="party-camera-tile-bar">
        <span className="party-camera-name">
          {isHost && <Crown className="inline w-3 h-3 text-amber-400 mr-0.5" />}
          {participant.displayName}
          {participant.isLocal ? " (you)" : ""}
        </span>
        {participant.micMutedByHost ? (
          <MicOff className="w-3 h-3 text-red-400/80" />
        ) : participant.hasAudio ? (
          participant.isSpeaking ? (
            <Mic className="w-3 h-3 text-emerald-400" />
          ) : (
            <Mic className="w-3 h-3 text-white/50" />
          )
        ) : (
          <VideoOff className="w-3 h-3 text-white/30" />
        )}
      </div>
      {participant.isSpeaking && <span className="party-camera-speaking-ring" aria-hidden />}
    </div>
  );
}

interface PartyCameraGridProps {
  participants: PartyMediaParticipant[];
  voiceVolume?: number;
  roomParticipants?: FlixPartyParticipant[];
}

export function PartyCameraGrid({
  participants,
  voiceVolume = 1,
  roomParticipants = [],
}: PartyCameraGridProps) {
  const hostId = roomParticipants.find((p) => p.role === "host")?.userId;
  const visible = participants.length > 0 ? participants : [];

  if (!visible.length) return null;

  return (
    <aside className="party-camera-grid" aria-label="Party cameras">
      <p className="party-camera-grid-label">Watch together · {visible.length} here</p>
      <div className="party-camera-grid-scroll">
        {visible.map((p) => (
          <CameraTile
            key={p.peerId}
            participant={p}
            voiceVolume={voiceVolume}
            isHost={p.peerId === hostId}
          />
        ))}
      </div>
      <p className="party-camera-hint">Turn on cam/mic in the party panel →</p>
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
