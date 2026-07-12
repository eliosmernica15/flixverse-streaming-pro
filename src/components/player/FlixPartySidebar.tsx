"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Users, Send, Crown, LogOut, PartyPopper, Smile, UserPlus, ChevronDown
} from "lucide-react";
import type { FlixPartyParticipant, FlixPartyChatMessage, FlixPartyRoom } from "@/hooks/player/useFlixParty";
import { useFriends, type Friend } from "@/hooks/useFriends";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfileContext } from "@/contexts/UserProfileContext";
import { useToast } from "@/hooks/use-toast";
import { sendWatchPartyInvite } from "@/lib/notifications/sendWatchPartyInvite";
import { firestoreErrorMessage } from "@/lib/firestore/errors";
import { FriendsList } from "@/components/FriendsList";
import { WatchParty } from "./WatchParty";
import { SyncStatusBadge, type SyncStatus } from "./SyncStatusBadge";
import { PartyMediaControls } from "./PartyMediaPanel";
import { PartyMembersPanel } from "./PartyMembersPanel";
import type { usePartyMedia } from "@/hooks/player/usePartyMedia";

type PartyMediaState = ReturnType<typeof usePartyMedia>;

export type PartyStartResult = { roomId: string; joinUrl: string };

interface FlixPartySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string | null;
  syncStatus: SyncStatus;
  driftMs?: number;
  onLeaveRoom: () => void;
  isHost?: boolean;
  onStartParty?: () => Promise<PartyStartResult | null> | void;
  /** Render beside the player window instead of full-screen overlay */
  embedded?: boolean;
  /** Current playback context for WatchParty */
  movieId?: number;
  mediaType?: "movie" | "tv";
  season?: number;
  episode?: number;
  title?: string;
  posterPath?: string | null;
  currentTime?: number;
  isPlaying?: boolean;
  onSyncToPosition?: (position: number) => void;
  partyJoinUrl?: string | null;
  media?: PartyMediaState;
  partyRoom?: FlixPartyRoom | null;
  partyMessages?: FlixPartyChatMessage[];
  sendPartyMessage?: (text: string, emoji?: string) => Promise<void>;
  kickParticipant?: (targetUserId: string) => Promise<void>;
  setParticipantMicMuted?: (targetUserId: string, muted: boolean) => Promise<void>;
  setParticipantCamDisabled?: (targetUserId: string, disabled: boolean) => Promise<void>;
  /** Mobile bottom-sheet mode */
  isMobile?: boolean;
  mobileExpanded?: boolean;
  onMinimize?: () => void;
}

type SidebarTab = "chat" | "friends" | "party";

export function FlixPartySidebar({
  isOpen,
  onClose,
  roomId,
  syncStatus,
  driftMs,
  onLeaveRoom,
  onStartParty,
  isHost: isHostProp = false,
  movieId,
  mediaType,
  season,
  episode,
  title,
  posterPath,
  currentTime,
  isPlaying,
  onSyncToPosition,
  partyJoinUrl,
  embedded = false,
  media,
  partyRoom: room,
  partyMessages: messages = [],
  sendPartyMessage,
  kickParticipant,
  setParticipantMicMuted,
  setParticipantCamDisabled,
  isMobile = false,
  mobileExpanded = true,
  onMinimize,
}: FlixPartySidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>(roomId ? "chat" : "friends");
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const { profile } = useUserProfileContext();
  const { friends, incomingRequests } = useFriends();
  const { toast } = useToast();

  const sendMessage = sendPartyMessage ?? (async () => undefined);

  const QUICK_EMOJIS = ["😂", "🔥", "❤️", "👏", "😮", "💀", "🎬", "🍿"];

  useEffect(() => {
    if (roomId) setActiveTab("chat");
  }, [roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, activeTab]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !roomId) return;
    sendMessage(text);
    setInput("");
    setShowEmoji(false);
  }, [input, roomId, sendMessage]);

  const handleSendEmoji = useCallback(
    (emoji: string) => {
      if (!roomId) return;
      sendMessage(emoji, emoji);
      setShowEmoji(false);
    },
    [roomId, sendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInviteFriend = useCallback(
    async (friend: Friend) => {
      if (!user || invitingFriendId) return;

      setInvitingFriendId(friend.userId);
      let joinUrl = partyJoinUrl;
      let activeRoomId = roomId;

      try {
        if (!joinUrl && onStartParty) {
          toast({ title: "Starting party…", description: "Creating your watch room." });
          const result = await onStartParty();
          if (result && typeof result === "object") {
            joinUrl = result.joinUrl;
            activeRoomId = result.roomId;
          }
        }

        if (!joinUrl || !activeRoomId) {
          toast({
            title: "No active party",
            description: "Open the Party tab and tap Start Watch Party first.",
            variant: "destructive",
          });
          setActiveTab("party");
          return;
        }

        const myName =
          profile?.display_name || user.displayName || user.email?.split("@")[0] || "Someone";
        const movieTitle = title || "this title";

        const sent = await sendWatchPartyInvite({
          roomId: activeRoomId,
          roomTitle: movieTitle,
          fromUserId: user.uid,
          fromUserName: myName,
          toUserId: friend.userId,
          toUserName: friend.displayName,
          movieId: movieId ?? null,
          mediaType: mediaType ?? "movie",
          season: season ?? null,
          episode: episode ?? null,
          posterPath: posterPath ?? null,
          partyJoinUrl: joinUrl,
        });

        const message = `Join me on FlixVerse to watch "${movieTitle}" together!\n${joinUrl}`;
        void navigator.clipboard.writeText(message);

        toast({
          title: sent ? "Invite sent" : "Invite failed",
          description: sent
            ? `${friend.displayName} will see a toast and bell notification.`
            : `Could not notify ${friend.displayName}. Check console for details.`,
          variant: sent ? "default" : "destructive",
        });
      } catch (err) {
        console.error("[party-invite] send failed:", err);
        toast({
          title: "Could not invite",
          description: firestoreErrorMessage(err),
          variant: "destructive",
        });
        if (!roomId) setActiveTab("party");
      } finally {
        setInvitingFriendId(null);
      }
    },
    [
      user,
      profile,
      partyJoinUrl,
      title,
      roomId,
      onStartParty,
      toast,
      movieId,
      mediaType,
      season,
      episode,
      posterPath,
      invitingFriendId,
    ]
  );

  if (!isOpen) return null;

  const participants: FlixPartyParticipant[] = room?.participants || [];
  const panelClass = embedded
    ? `player-party-panel${isMobile ? " player-party-panel--mobile" : ""}${isMobile && mobileExpanded ? " player-party-panel--expanded" : ""}${isMobile && !mobileExpanded ? " player-party-panel--minimized" : ""}`
    : "fixed inset-y-0 right-0 z-[10000] w-full sm:w-96 flex flex-col bg-zinc-950 border-l border-white/10 shadow-2xl animate-slide-in-right";

  return (
    <div className={panelClass}>
      {isMobile && mobileExpanded && (
        <div className="player-party-drag-handle" aria-hidden>
          <span />
        </div>
      )}

      {/* Header */}
      <div className={`player-party-header ${isMobile ? "player-party-header--mobile" : ""}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shrink-0">
            <PartyPopper className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-white text-sm truncate">Watch Together</h2>
            {!isMobile && (
              <p className="text-xs text-gray-500">
                {friends.length} friend{friends.length !== 1 ? "s" : ""}
                {incomingRequests.length > 0 && (
                  <span className="text-red-400 ml-1">· {incomingRequests.length} request{incomingRequests.length !== 1 ? "s" : ""}</span>
                )}
              </p>
            )}
            {roomId && (
              <SyncStatusBadge status={syncStatus} driftMs={driftMs} className="mt-1" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {roomId && isMobile && (
            <button
              type="button"
              onClick={onLeaveRoom}
              className="player-party-icon-btn player-party-icon-btn--danger"
              aria-label={isHostProp ? "End party for everyone" : "Leave party"}
              title={isHostProp ? "End party" : "Leave"}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
          {isMobile && mobileExpanded && onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className="player-party-icon-btn"
              aria-label="Minimize party panel"
              title="Minimize"
            >
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="player-party-icon-btn"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {roomId && !isMobile && (
        <div className="px-3 py-2 border-b border-white/10 shrink-0">
          <button
            type="button"
            onClick={onLeaveRoom}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 min-h-[2.75rem] rounded-xl text-sm font-semibold transition-colors bg-red-600/20 hover:bg-red-600/35 text-red-200 border border-red-500/30"
          >
            <LogOut className="w-4 h-4" />
            {isHostProp ? "End party for everyone" : "Leave party"}
          </button>
        </div>
      )}

      {(!isMobile || mobileExpanded) && (
        <>
      {/* Tabs */}
      <div className="player-party-tabs">
        {[
          { id: "friends" as const, label: "Friends", icon: UserPlus },
          { id: "chat" as const, label: "Chat", icon: Send },
          { id: "party" as const, label: "Party", icon: Users },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 min-h-[2.75rem] text-xs font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? "text-white border-red-500"
                : "text-gray-500 border-transparent hover:text-gray-300"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        {roomId && media && activeTab !== "chat" && (
          <div className="shrink-0 border-b border-white/10 px-3 py-2 space-y-2">
            <PartyMediaControls
              micOn={media.micOn}
              cameraOn={media.cameraOn}
              cameraMode={media.cameraMode}
              anyoneSpeaking={media.anyoneSpeaking}
              mediaError={media.mediaError}
              voiceVolume={media.voiceVolume}
              hostMicForcedOff={media.hostMicForcedOff}
              hostCamForcedOff={media.hostCamForcedOff}
              onToggleMic={() => void media.toggleMic()}
              onToggleCamera={() => void media.toggleCamera()}
              onVoiceVolumeChange={media.setVoiceVolume}
              compact={isMobile}
            />
            {room && user && (
              <PartyMembersPanel
                participants={room.participants}
                hostId={room.hostId}
                currentUserId={user.uid}
                isHost={isHostProp}
                onKick={(id) => {
                  void kickParticipant?.(id);
                  toast({ title: "Guest removed", description: "They were removed from the party." });
                }}
                onToggleMic={(id, muted) => void setParticipantMicMuted?.(id, muted)}
                onToggleCam={(id, off) => void setParticipantCamDisabled?.(id, off)}
              />
            )}
          </div>
        )}
        {/* Friends tab */}
        {activeTab === "friends" && (
          <FriendsList
            inviteMode={true}
            onInvite={handleInviteFriend}
            invitingUserId={invitingFriendId}
          />
        )}

        {/* Chat tab */}
        {activeTab === "chat" && (
          <div className="flex flex-col flex-1 min-h-0">
            {!roomId ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <Users className="w-8 h-8 text-gray-700 mb-2" />
                <p className="text-xs text-gray-500">No active party</p>
                <p className="text-[10px] text-gray-600 mt-1">Start a party to chat</p>
              </div>
            ) : (
              <>
                {media && (
                  <div className="shrink-0 border-b border-white/10 px-3 py-2">
                    <PartyMediaControls
                      micOn={media.micOn}
                      cameraOn={media.cameraOn}
                      cameraMode={media.cameraMode}
                      anyoneSpeaking={media.anyoneSpeaking}
                      mediaError={media.mediaError}
                      voiceVolume={media.voiceVolume}
                      hostMicForcedOff={media.hostMicForcedOff}
                      hostCamForcedOff={media.hostCamForcedOff}
                      onToggleMic={() => void media.toggleMic()}
                      onToggleCamera={() => void media.toggleCamera()}
                      onVoiceVolumeChange={media.setVoiceVolume}
                      compact={isMobile}
                    />
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex gap-2.5">
                      {msg.senderAvatar ? (
                        <img src={msg.senderAvatar} alt={msg.senderName} className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5">
                          {msg.senderName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[11px] font-semibold text-gray-300">{msg.senderName}</span>
                        </div>
                        {msg.emoji ? (
                          <span className="text-2xl">{msg.emoji}</span>
                        ) : (
                          <p className="text-xs text-gray-200 break-words">{msg.text}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {showEmoji && (
                  <div className="px-3 py-2 border-t border-white/5 flex items-center gap-1 shrink-0">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleSendEmoji(emoji)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-lg transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                <div className="p-3 border-t border-white/10 shrink-0 bg-zinc-950/95 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowEmoji(!showEmoji)}
                      className={`p-2 rounded-lg transition-colors shrink-0 ${showEmoji ? "bg-white/10 text-white" : "hover:bg-white/5 text-gray-500"}`}
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Say something…"
                      maxLength={500}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20 transition-colors"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim()}
                      className="p-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:hover:bg-red-600 text-white transition-colors shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Party tab */}
        {activeTab === "party" && (
          <div className="p-3">
            {movieId && title && (
              <WatchParty
                movieId={movieId}
                mediaType={mediaType || "movie"}
                season={season}
                episode={episode}
                title={title}
                posterPath={posterPath || null}
                currentTime={currentTime || 0}
                isPlaying={isPlaying || false}
                onSyncToPosition={onSyncToPosition || (() => {})}
                onStartParty={onStartParty}
                externalRoomId={roomId}
                partyJoinUrl={partyJoinUrl}
              />
            )}
          </div>
        )}
      </div>
        </>
      )}

      {isMobile && !mobileExpanded && roomId && media && (
        <div className="player-party-minibar">
          <PartyMediaControls
            micOn={media.micOn}
            cameraOn={media.cameraOn}
            cameraMode={media.cameraMode}
            anyoneSpeaking={media.anyoneSpeaking}
            mediaError={media.mediaError}
            voiceVolume={media.voiceVolume}
            hostMicForcedOff={media.hostMicForcedOff}
            hostCamForcedOff={media.hostCamForcedOff}
            onToggleMic={() => void media.toggleMic()}
            onToggleCamera={() => void media.toggleCamera()}
            onVoiceVolumeChange={media.setVoiceVolume}
            compact
          />
        </div>
      )}
    </div>
  );
}
