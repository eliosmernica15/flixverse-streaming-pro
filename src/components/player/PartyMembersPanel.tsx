"use client";

import { Mic, MicOff, Video, VideoOff, Crown, UserX, Volume2 } from "lucide-react";
import type { FlixPartyParticipant } from "@/hooks/player/useFlixParty";

interface PartyMembersPanelProps {
  participants: FlixPartyParticipant[];
  hostId: string;
  currentUserId: string;
  isHost: boolean;
  onKick: (userId: string) => void;
  onToggleMic: (userId: string, muted: boolean) => void;
  onToggleCam: (userId: string, disabled: boolean) => void;
}

export function PartyMembersPanel({
  participants,
  hostId,
  currentUserId,
  isHost,
  onKick,
  onToggleMic,
  onToggleCam,
}: PartyMembersPanelProps) {
  if (!participants.length) return null;

  return (
    <div className="party-members-panel">
      <p className="party-members-label">
        <Crown className="w-3.5 h-3.5 text-amber-400" />
        In this party ({participants.length})
      </p>
      <ul className="party-members-list">
        {participants.map((p) => {
          const isSelf = p.userId === currentUserId;
          const isPartyHost = p.userId === hostId;
          return (
            <li key={p.userId} className="party-member-row">
              <div className="party-member-info">
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt="" className="party-member-avatar" />
                ) : (
                  <span className="party-member-avatar party-member-avatar--fallback">
                    {p.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="party-member-text">
                  <span className="party-member-name">
                    {p.displayName}
                    {isSelf && <span className="party-member-you"> (you)</span>}
                  </span>
                  <span className="party-member-role">
                    {isPartyHost ? "Host" : "Guest"}
                    {p.micMutedByHost && " · mic muted by host"}
                    {p.camDisabledByHost && " · cam off by host"}
                  </span>
                </div>
              </div>
              {isHost && !isSelf && (
                <div className="party-member-actions">
                  <button
                    type="button"
                    className={`party-member-action ${p.micMutedByHost ? "is-active" : ""}`}
                    onClick={() => onToggleMic(p.userId, !p.micMutedByHost)}
                    title={p.micMutedByHost ? "Unmute guest" : "Mute guest mic"}
                    aria-label={p.micMutedByHost ? "Unmute guest" : "Mute guest mic"}
                  >
                    {p.micMutedByHost ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    className={`party-member-action ${p.camDisabledByHost ? "is-active" : ""}`}
                    onClick={() => onToggleCam(p.userId, !p.camDisabledByHost)}
                    title={p.camDisabledByHost ? "Allow camera" : "Disable guest camera"}
                    aria-label={p.camDisabledByHost ? "Allow camera" : "Disable guest camera"}
                  >
                    {p.camDisabledByHost ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    className="party-member-action party-member-action--kick"
                    onClick={() => onKick(p.userId)}
                    title="Remove from party"
                    aria-label={`Kick ${p.displayName}`}
                  >
                    <UserX className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface VoiceVolumeSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function VoiceVolumeSlider({ value, onChange }: VoiceVolumeSliderProps) {
  return (
    <div className="party-voice-volume">
      <div className="party-voice-volume-head">
        <Volume2 className="w-3.5 h-3.5 text-white/60" />
        <span>Voice chat volume</span>
        <span className="party-voice-volume-pct">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="party-voice-volume-slider"
        aria-label="Voice chat volume"
      />
    </div>
  );
}
