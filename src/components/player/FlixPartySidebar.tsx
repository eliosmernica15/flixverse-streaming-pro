"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Users, Send, Crown, LogOut, PartyPopper, Smile, UserPlus
} from "lucide-react";
import { useFlixParty, type FlixPartyParticipant } from "@/hooks/player/useFlixParty";
import { useFriends, type Friend } from "@/hooks/useFriends";
import { FriendsList } from "@/components/FriendsList";
import { WatchParty } from "./WatchParty";
import { SyncStatusBadge, type SyncStatus } from "./SyncStatusBadge";

interface FlixPartySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string | null;
  syncStatus: SyncStatus;
  driftMs?: number;
  onLeaveRoom: () => void;
  onStartParty?: () => void;
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
  movieId,
  mediaType,
  season,
  episode,
  title,
  posterPath,
  currentTime,
  isPlaying,
  onSyncToPosition,
}: FlixPartySidebarProps) {
  const { room, messages, isHost, sendMessage } = useFlixParty({ roomId });
  const { friends, incomingRequests } = useFriends();
  const [activeTab, setActiveTab] = useState<SidebarTab>("friends");
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const QUICK_EMOJIS = ["😂", "🔥", "❤️", "👏", "😮", "💀", "🎬", "🍿"];

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

  const handleInviteFriend = useCallback((friend: Friend) => {
    // This would trigger WatchParty invite
    setActiveTab("party");
  }, []);

  if (!isOpen) return null;

  const participants: FlixPartyParticipant[] = room?.participants || [];

  return (
    <div className="fixed inset-y-0 right-0 z-[10000] w-full sm:w-96 flex flex-col bg-zinc-950 border-l border-white/10 shadow-2xl animate-slide-in-right">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
            <PartyPopper className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">Watch Together</h2>
            <p className="text-xs text-gray-500">
              {friends.length} friend{friends.length !== 1 ? "s" : ""}
              {incomingRequests.length > 0 && (
                <span className="text-red-400 ml-1">· {incomingRequests.length} request{incomingRequests.length !== 1 ? "s" : ""}</span>
              )}
            </p>
            {roomId && (
              <SyncStatusBadge status={syncStatus} driftMs={driftMs} className="mt-1" />
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 shrink-0">
        {[
          { id: "friends" as const, label: "Friends", icon: UserPlus },
          { id: "chat" as const, label: "Chat", icon: Send },
          { id: "party" as const, label: "Party", icon: Users },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium transition-colors border-b-2 ${
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
      <div className="flex-1 overflow-hidden">
        {/* Friends tab */}
        {activeTab === "friends" && (
          <FriendsList inviteMode={true} onInvite={handleInviteFriend} />
        )}

        {/* Chat tab */}
        {activeTab === "chat" && (
          <div className="flex flex-col h-full">
            {!roomId ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <Users className="w-8 h-8 text-gray-700 mb-2" />
                <p className="text-xs text-gray-500">No active party</p>
                <p className="text-[10px] text-gray-600 mt-1">Start a party to chat</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
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

                <div className="p-3 border-t border-white/10 shrink-0">
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
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
