"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Mic, MicOff, Video, VideoOff, Crown, LayoutGrid, PanelRight, Rows3, EyeOff } from "lucide-react";
import type { PartyMediaParticipant } from "@/hooks/player/usePartyMedia";
import type { FlixPartyParticipant } from "@/hooks/player/useFlixParty";
import type { CameraLayoutMode } from "@/hooks/player/usePartyLayout";
import { VoiceVolumeSlider } from "./PartyMembersPanel";
import { PTTIndicator } from "./PTTIndicator";
import type { PTTState } from "./PTTIndicator";
import { PiPTile } from "./PiPTile";
import {
  attachSpatialVoice,
  detachSpatialVoice,
  panForTile,
  updateSpatialVoicePan,
  type SpatialVoiceNode,
} from "@/lib/player/spatialAudio";

/**
 * Remote party voice.
 *
 * The `<audio>` element is the playback path (it keeps the browser's media
 * session intact and respects autoplay heuristics); a `StereoPannerNode` is
 * spliced into its Web Audio chain so the voice is positioned across the
 * stereo stage to match where the speaker's tile sits on screen. If the
 * element cannot be routed through Web Audio (already tapped, or an engine
 * restriction) we fall back to plain centred playback rather than going
 * silent.
 */
function RemoteAudioSink({
  stream,
  volume,
  pan = 0,
}: {
  stream: MediaStream;
  volume: number;
  pan?: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const spatialRef = useRef<SpatialVoiceNode | null>(null);

  // Bind the stream once. Volume is handled by its own effect â€” putting it in
  // this dependency list re-assigned `srcObject` on every slider tick, which
  // restarted playback and clipped the peer's voice mid-word.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);

  // Attach the panner once per element, then glide it when the layout moves.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!spatialRef.current) {
      spatialRef.current = attachSpatialVoice(el, pan);
    } else {
      updateSpatialVoicePan(spatialRef.current, pan);
    }
    return () => {
      detachSpatialVoice(spatialRef.current);
      spatialRef.current = null;
    };
    // `pan` intentionally excluded: handled by the update effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (spatialRef.current) updateSpatialVoicePan(spatialRef.current, pan);
  }, [pan]);

  return <audio ref={audioRef} autoPlay playsInline className="sr-only" aria-hidden />;
}

function CameraTile({
  participant,
  voiceVolume,
  isHost,
  pan = 0,
}: {
  participant: PartyMediaParticipant;
  voiceVolume: number;
  isHost?: boolean;
  /** Stereo position matching this tile's slot in the rail. */
  pan?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = participant.hasVideo ? participant.stream : null;
    if (participant.hasVideo) {
      // Always muted: remote voice is played by RemoteAudioSink so it obeys
      // the volume slider, ducking and the spatial pan.
      el.muted = true;
      el.setAttribute("playsinline", "true");
      el.setAttribute("webkit-playsinline", "true");
      void el.play().catch(() => undefined);
    }
    return () => {
      el.srcObject = null;
    };
  }, [participant.stream, participant.hasVideo]);

  const initial = participant.displayName.charAt(0).toUpperCase();

  return (
    <div
      className={`party-camera-tile ${participant.isSpeaking ? "is-speaking" : ""} ${participant.isLocal ? "is-local" : ""}`}
    >
      {/*
        Remote video is ALWAYS muted at the element and their voice comes from
        the dedicated <audio> sink below. Previously a peer who had a camera on
        had their audio played by this <video> element â€” at full volume, with
        no spatial pan, and ignoring the "Voice volume" slider entirely. One
        audio path for every remote peer keeps volume, ducking and stereo
        placement consistent whether or not a camera is on.
      */}
      {participant.hasVideo && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          disablePictureInPicture
          className="party-camera-video"
        />
      )}
      {!participant.isLocal && participant.hasAudio && (
        <RemoteAudioSink stream={participant.stream} volume={voiceVolume} pan={pan} />
      )}
      {!participant.hasVideo && (
        <>
          <div className="party-camera-avatar">
            {participant.avatarUrl ? (
              <Image
                src={participant.avatarUrl}
                alt=""
                fill
                sizes="100vw"
                className="party-camera-avatar-img"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
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
      {/*
        Stereo placement indicator. Their voice really is panned to this
        position in the stereo field (see spatialAudio.ts) â€” showing it turns
        an inaudible-on-laptop-speakers effect into something the user can
        understand and trust.
      */}
      {!participant.isLocal && participant.hasAudio && Math.abs(pan) > 0.02 && (
        <span
          className="party-voice-pan"
          title={`Voice panned ${pan < 0 ? "left" : "right"} to match this tile`}
        >
          <span className="party-voice-pan-bar">
            <span
              className="party-voice-pan-dot"
              style={{ left: `${((pan + 1) / 2) * 100}%` }}
            />
          </span>
        </span>
      )}
      {participant.isSpeaking && <span className="party-camera-speaking-ring" aria-hidden />}
    </div>
  );
}

interface PartyCameraGridProps {
  participants: PartyMediaParticipant[];
  voiceVolume?: number;
  roomParticipants?: FlixPartyParticipant[];
  hostId?: string | null;
  layoutMode?: CameraLayoutMode;
  onLayoutChange?: (mode: CameraLayoutMode) => void;
}

const LAYOUT_OPTIONS: { id: CameraLayoutMode; label: string; icon: typeof LayoutGrid }[] = [
  { id: "side", label: "Side", icon: PanelRight },
  { id: "bottom", label: "Bottom", icon: Rows3 },
  { id: "grid", label: "Grid", icon: LayoutGrid },
  { id: "hidden", label: "Hide", icon: EyeOff },
];

export function PartyCameraGrid({
  participants,
  voiceVolume = 1,
  roomParticipants = [],
  hostId = null,
  layoutMode = "side",
  onLayoutChange,
}: PartyCameraGridProps) {
  const resolvedHostId = hostId ?? roomParticipants.find((p) => p.role === "host")?.userId ?? null;
  const visible = participants.length > 0 ? participants : [];

  if (!visible.length && layoutMode === "hidden") return null;
  if (!visible.length) return null;

  return (
    <aside className="party-camera-grid" aria-label="Party cameras">
      <div className="party-camera-grid-head">
        <p className="party-camera-grid-label">Watch together Â· {visible.length} here</p>
        {onLayoutChange && (
          <div className="party-camera-layout-picker" role="group" aria-label="Camera layout">
            {LAYOUT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`party-camera-layout-btn ${layoutMode === opt.id ? "is-active" : ""}`}
                onClick={() => onLayoutChange(opt.id)}
                title={opt.label}
                aria-label={opt.label}
                aria-pressed={layoutMode === opt.id}
              >
                <opt.icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="party-camera-grid-scroll">
        {visible.map((p, index) => (
          <CameraTile
            key={p.peerId}
            participant={p}
            voiceVolume={voiceVolume}
            isHost={resolvedHostId ? p.peerId === resolvedHostId : false}
            pan={panForTile(index, visible.length)}
          />
        ))}
      </div>
      <p className="party-camera-hint">Turn on cam/mic in the party panel â†’</p>
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
  /** Push-to-talk state for the mic button. When provided, renders a PTTIndicator. */
  pttState?: PTTState;
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
  pttState,
  onToggleMic,
  onToggleCamera,
  onVoiceVolumeChange,
  compact = false,
}: PartyMediaControlsProps & { compact?: boolean }) {
  return (
    <div className={`party-media-controls ${compact ? "party-media-controls--compact" : ""}`}>
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
      {pttState !== undefined && (
        <PTTIndicator state={pttState} hostMuted={hostMicForcedOff} compact />
      )}
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
        <span className="party-media-hint party-media-hint--desktop">Movie left Â· cameras right Â· HD when available</span>
      )}
      {mediaError && <p className="party-media-error">{mediaError}</p>}
    </div>
  );
}

interface PartyCameraPiPProps {
  participants: PartyMediaParticipant[];
  voiceVolume?: number;
  roomParticipants?: FlixPartyParticipant[];
  hostId?: string | null;
  expanded?: boolean;
  /** Called when the user dismisses the floating preview. */
  onClose?: () => void;
  /** Storage key for persisting the PiP position/size. */
  storageKey?: string;
}

/** Floating camera preview for mobile â€” draggable/resizable PIP above party bottom sheet */
export function PartyCameraPiP({
  participants,
  voiceVolume = 1,
  roomParticipants = [],
  hostId = null,
  expanded = false,
  onClose,
  storageKey = "party:pip:camera",
}: PartyCameraPiPProps) {
  const resolvedHostId = hostId ?? roomParticipants.find((p) => p.role === "host")?.userId ?? null;
  const withVideo = participants.filter((p) => p.hasVideo);
  if (!withVideo.length) return null;

  const primary = withVideo.find((p) => p.isLocal) ?? withVideo[0];
  const others = withVideo.filter((p) => p.peerId !== primary.peerId).slice(0, 2);

  return (
    <PiPTile
      storageKey={storageKey}
      defaultSize={{ w: expanded ? 320 : 200, h: expanded ? 240 : 150 }}
      ariaLabel="Your camera preview"
      onClose={onClose}
      className={expanded ? "party-camera-pip--expanded" : ""}
    >
      <div className="party-camera-pip" aria-label="Your camera preview">
        <CameraTile
          participant={primary}
          voiceVolume={voiceVolume}
          isHost={resolvedHostId ? primary.peerId === resolvedHostId : false}
        />
        {others.length > 0 && (
          <div className="party-camera-pip-stack" aria-hidden>
            {others.map((p, index) => (
              <CameraTile
                key={p.peerId}
                participant={p}
                voiceVolume={voiceVolume}
                isHost={resolvedHostId ? p.peerId === resolvedHostId : false}
                pan={panForTile(index + 1, others.length + 1)}
              />
            ))}
          </div>
        )}
      </div>
    </PiPTile>
  );
}
