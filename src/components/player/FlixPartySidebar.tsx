"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Users,
  Send,
  Crown,
  LogOut,
  PartyPopper,
  Smile,
} from "lucide-react";
import { useFlixParty, type FlixPartyParticipant } from "@/hooks/player/useFlixParty";
import { SyncStatusBadge, type SyncStatus } from "./SyncStatusBadge";

interface FlixPartySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string | null;
  syncStatus: SyncStatus;
  driftMs?: number;
  onLeaveRoom: () => void;
}

const QUICK_EMOJIS = ["😂", "🔥", "❤️", "👏", "😮", "💀", "🎬", "🍿"];

export function FlixPartySidebar({
  isOpen,
  onClose,
  roomId,
  syncStatus,
  driftMs,
  onLeaveRoom,
}: FlixPartySidebarProps) {
  const { room, messages, isHost, sendMessage, loading } = useFlixParty({ roomId });
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

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
            <h2 className="font-bold text-white text-sm flex items-center gap-2">
              FlixParty
              <SyncStatusBadge status={syncStatus} driftMs={driftMs} />
            </h2>
            <p className="text-xs text-gray-500">
              {participants.length} watching together
            </p>
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

      {/* Participants */}
      <div className="px-4 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-1.5 mb-2">
          <Users className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            In this party
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {participants.map((p) => (
            <div
              key={p.userId}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5"
            >
              {p.avatarUrl ? (
                <img
                  src={p.avatarUrl}
                  alt={p.displayName}
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-[8px] font-bold text-white">
                  {p.displayName.charAt(0)}
                </div>
              )}
              <span className="text-xs text-gray-300 max-w-[80px] truncate">
                {p.displayName}
              </span>
              {p.role === "host" && (
                <Crown className="w-3 h-3 text-amber-400 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {loading && messages.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-gray-500">Loading chat…</div>
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <PartyPopper className="w-8 h-8 text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 font-medium">Party started!</p>
            <p className="text-xs text-gray-600 mt-1">
              Send a message to break the ice
            </p>
          </div>
        )}
        {messages.map((msg) => {
          const isOwn = msg.senderId === room?.hostId;
          return (
            <div key={msg.id} className="flex gap-2.5">
              {msg.senderAvatar ? (
                <img
                  src={msg.senderAvatar}
                  alt={msg.senderName}
                  className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                  {msg.senderName.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-semibold text-gray-300">
                    {msg.senderName}
                  </span>
                  {msg.senderId === room?.hostId && (
                    <Crown className="w-2.5 h-2.5 text-amber-400" />
                  )}
                </div>
                {msg.emoji ? (
                  <span className="text-3xl">{msg.emoji}</span>
                ) : (
                  <p className="text-sm text-gray-200 break-words">{msg.text}</p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick emoji bar */}
      {showEmoji && (
        <div className="px-4 py-2 border-t border-white/5 flex items-center gap-1.5 shrink-0">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleSendEmoji(emoji)}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-xl transition-colors"
              aria-label={`Send ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEmoji(!showEmoji)}
            className={`p-2 rounded-lg transition-colors shrink-0 ${
              showEmoji ? "bg-white/10 text-white" : "hover:bg-white/5 text-gray-500"
            }`}
            aria-label="Toggle emoji"
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
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:hover:bg-red-600 text-white transition-colors shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Leave */}
      <div className="px-4 pb-4 shrink-0">
        <button
          type="button"
          onClick={onLeaveRoom}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-red-400 hover:border-red-500/30 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Leave party
        </button>
      </div>
    </div>
  );
}
