"use client";

import { memo, useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  X, Users, Send, Crown, LogOut, PartyPopper, Smile, UserPlus, ChevronDown, Copy, Check, Link2, List, ThumbsUp, XCircle, PlayCircle, MicOff, Bell
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { FlixPartyParticipant, FlixPartyChatMessage, FlixPartyRoom } from "@/hooks/player/useFlixParty";
import { useFriends, type Friend } from "@/hooks/useFriends";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfileContext } from "@/contexts/UserProfileContext";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { sendWatchPartyInvite } from "@/lib/notifications/sendWatchPartyInvite";
import { firestoreErrorMessage } from "@/lib/firestore/errors";
import { FriendsList } from "@/components/FriendsList";
import { WatchParty } from "./WatchParty";
import { SyncStatusBadge, type SyncStatus } from "./SyncStatusBadge";
import { HostSyncCard, GuestStagingBanner } from "./SyncedStartCard";
import { PartyMediaControls } from "./PartyMediaPanel";
import { usePushToTalk } from "@/hooks/player/usePushToTalk";
import { PartyMembersPanel } from "./PartyMembersPanel";
import { PassCrownDialog } from "./PassCrownDialog";
import type { usePartyMedia } from "@/hooks/player/usePartyMedia";

type PartyMediaState = ReturnType<typeof usePartyMedia>;

export type PartyStartResult = { roomId: string; joinUrl: string };

/**
 * C4 â€” presence art: stacked member avatars drifting on a gentle sine wave
 * in the sidebar header. Pure CSS animation, staggered per member, disabled
 * under prefers-reduced-motion via the party-float guard in globals.css.
 */
function PartyPresenceArt({
  participants,
  currentUserId,
}: {
  participants: FlixPartyParticipant[];
  currentUserId: string | undefined;
}) {
  if (!participants.length) return null;
  const shown = participants.slice(0, 5);
  return (
    <div className="party-presence ml-auto hidden shrink-0 items-center sm:flex" aria-hidden="true">
      {shown.map((p, i) => (
        <span
          key={p.userId}
          className="party-float -ml-2 first:ml-0"
          style={{ animationDelay: `${i * 260}ms` }}
        >
          <span
            className={`block h-7 w-7 overflow-hidden rounded-full ring-2 ${
              p.userId === currentUserId ? "ring-red-500/70" : "ring-white/20"
            } bg-white/10`}
          >
            {p.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={p.avatarUrl}
                alt=""
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="grid h-full w-full place-items-center text-[10px] font-bold text-white/80">
                {p.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </span>
        </span>
      ))}
      {participants.length > shown.length && (
        <span className="-ml-2 grid h-7 w-7 place-items-center rounded-full bg-white/10 text-[10px] font-bold text-white/80 ring-2 ring-white/20">
          +{participants.length - shown.length}
        </span>
      )}
    </div>
  );
}

function QueueItemCard({
  item,
  isHost,
  currentUserId,
  onVote,
  onConfirm,
  onRemove,
  onRemoveOwn,
  t,
  toast,
}: {
  item: QueueItem;
  isHost: boolean;
  currentUserId: string | undefined;
  onVote?: (itemId: string) => Promise<void>;
  onConfirm?: (itemId: string) => Promise<void>;
  onRemove?: (itemId: string) => Promise<void>;
  onRemoveOwn?: (itemId: string) => Promise<void>;
  t: (key: string) => string;
  toast: (options: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
}) {
  const hasVoted = currentUserId ? item.votes.includes(currentUserId) : false;
  const isSuggester = currentUserId === item.suggestedBy;

  const handleVote = async () => {
    if (!onVote) return;
    try {
      await onVote(item.id);
    } catch (err) {
      console.error("Vote failed:", err);
      toast({ title: t("voteFailed"), description: String(err), variant: "destructive" });
    }
  };

  const handleConfirm = async () => {
    if (!onConfirm) return;
    try {
      await onConfirm(item.id);
      toast({ title: t("queueConfirmed"), description: `${item.title} ${t("willPlayNext")}` });
    } catch (err) {
      console.error("Confirm failed:", err);
      toast({ title: t("confirmFailed"), description: String(err), variant: "destructive" });
    }
  };

  const handleRemove = async () => {
    const removeFn = isHost ? onRemove : isSuggester ? onRemoveOwn : undefined;
    if (!removeFn) return;
    try {
      await removeFn(item.id);
      toast({ title: t("queueItemRemoved") });
    } catch (err) {
      console.error("Remove failed:", err);
      toast({ title: t("removeFailed"), description: String(err), variant: "destructive" });
    }
  };

  const mediaTypeLabel = item.mediaType === "tv"
    ? `${item.title} ${item.season ? `S${item.season}` : ""}${item.episode ? `E${item.episode}` : ""}`
    : item.title;

  return (
    <div className="flex gap-2 p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
      {item.posterPath && (
        <img
          src={`https://image.tmdb.org/t/p/w92${item.posterPath}`}
          alt={item.title}
          className="w-16 h-24 object-cover rounded-lg shrink-0"
          loading="lazy"
        />
      )}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="font-medium text-white truncate">{mediaTypeLabel}</span>
          {item.confirmed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 border border-green-500/30 px-1.5 py-0.5 text-[9px] font-bold text-green-300">
              <PlayCircle className="w-2.5 h-2.5" />
              {t("confirmed")}
            </span>
          )}
          {isSuggester && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 border border-blue-500/30 px-1.5 py-0.5 text-[9px] font-bold text-blue-300">
              {t("yours")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-400">
          <span className="flex items-center gap-0.5">
            {item.suggestedByAvatar ? (
              <img src={item.suggestedByAvatar} alt="" className="w-3 h-3 rounded-full" />
            ) : (
              <div className="w-3 h-3 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-[8px] font-bold text-white/60">{item.suggestedByName.charAt(0)}</span>
              </div>
            )}
            <span className="truncate max-w-[100px]">{item.suggestedByName}</span>
          </span>
          <span>·</span>
          <span>{new Date(item.suggestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <button
          onClick={handleVote}
          disabled={hasVoted}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            hasVoted
              ? "bg-green-500/20 text-green-300 border border-green-500/30 cursor-default"
              : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/10"
          }`}
          aria-pressed={hasVoted}
          aria-label={hasVoted ? t("voted") : t("vote")}
        >
          <ThumbsUp className={hasVoted ? "w-3.5 h-3.5 fill-current" : "w-3.5 h-3.5"} />
          <span>{item.voteCount}</span>
        </button>
        {isHost && !item.confirmed && (
          <button
            onClick={handleConfirm}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 text-[10px] font-medium transition-colors"
            aria-label={t("confirm")}
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>{t("confirm")}</span>
          </button>
        )}
        {(isHost || isSuggester) && (
          <button
            onClick={handleRemove}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            aria-label={t("remove")}
          >
            <XCircle className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function AddToQueueForm({
  onSuggest,
  isHost,
  t,
  toast,
}: {
  onSuggest?: (item: Omit<QueueItem, "id" | "votes" | "voteCount" | "suggestedAt" | "suggestedBy" | "suggestedByName" | "suggestedByAvatar">) => Promise<void>;
  isHost: boolean;
  t: (key: string) => string;
  toast: (options: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{
    id: number;
    mediaType: "movie" | "tv";
    title: string;
    posterPath: string | null;
    season?: number;
    episode?: number;
  }>>([]);
  const [searching, setSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<typeof searchResults[0] | null>(null);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !onSuggest) return;
    setSearching(true);
    try {
      // Use the existing search API
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      const results = (data.results || []).map((r: any) => ({
        id: r.id,
        mediaType: r.media_type || (r.first_air_date ? "tv" : "movie"),
        title: r.title || r.name,
        posterPath: r.poster_path,
        season: r.season_number,
        episode: r.episode_number,
      }));
      setSearchResults(results);
      if (results.length > 0) setSelectedResult(results[0]);
    } catch (err) {
      console.error("Search error:", err);
      toast({ title: t("searchFailed"), variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }, [searchQuery, onSuggest, t, toast]);

  const handleSuggest = async () => {
    if (!selectedResult || !onSuggest) return;
    try {
      await onSuggest({
        tmdbId: selectedResult.id,
        mediaType: selectedResult.mediaType,
        title: selectedResult.title,
        posterPath: selectedResult.posterPath,
        season: selectedResult.season,
        episode: selectedResult.episode,
        serverIndex: 0,
      });
      setSearchQuery("");
      setSearchResults([]);
      setSelectedResult(null);
      toast({ title: t("suggested") });
    } catch (err) {
      console.error("Suggest failed:", err);
      toast({ title: t("suggestFailed"), description: String(err), variant: "destructive" });
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, handleSearch]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20 transition-colors"
        />
        <button
          onClick={handleSuggest}
          disabled={!selectedResult || searching}
          className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:hover:bg-red-600 text-white text-sm font-medium transition-colors shrink-0"
        >
          {t("addToQueue")}
        </button>
      </div>

      {searchResults.length > 0 && (
        <div className="max-h-32 overflow-y-auto space-y-1">
          {searchResults.map((result) => (
            <button
              key={`${result.mediaType}-${result.id}-${result.season || 0}-${result.episode || 0}`}
              onClick={() => setSelectedResult(result)}
              className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                selectedResult?.id === result.id &&
                selectedResult?.mediaType === result.mediaType &&
                selectedResult?.season === result.season &&
                selectedResult?.episode === result.episode
                  ? "bg-red-500/20 border border-red-500/30"
                  : "bg-white/5 hover:bg-white/10 border border-white/10"
              }`}
            >
              {result.posterPath && (
                <img
                  src={`https://image.tmdb.org/t/p/w45${result.posterPath}`}
                  alt={result.title}
                  className="w-10 h-15 object-cover rounded shrink-0"
                  loading="lazy"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {result.title}
                  {result.mediaType === "tv" && result.season && (
                    <> S{result.season} {result.episode && `E${result.episode}`}</>
                  )}
                </p>
                <p className="text-[10px] text-gray-500 capitalize">{result.mediaType}</p>
              </div>
              {selectedResult?.id === result.id &&
                selectedResult?.mediaType === result.mediaType &&
                selectedResult?.season === result.season &&
                selectedResult?.episode === result.episode && (
                <div className="w-4 h-4 rounded-full border-2 border-red-500 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  onSyncToPosition?: (position: number) => void;
  partyJoinUrl?: string | null;
  media?: PartyMediaState;
  partyRoom?: FlixPartyRoom | null;
  partyMessages?: FlixPartyChatMessage[];
  sendPartyMessage?: (text: string, emoji?: string) => Promise<void>;
  kickParticipant?: (targetUserId: string) => Promise<void>;
  setParticipantMicMuted?: (targetUserId: string, muted: boolean) => Promise<void>;
  setParticipantCamDisabled?: (targetUserId: string, disabled: boolean) => Promise<void>;
  /** Pass the Crown. Omitted on transports that cannot transfer host. */
  transferHost?: (targetUserId: string) => Promise<boolean>;
  /** Mobile bottom-sheet mode */
  isMobile?: boolean;
  mobileExpanded?: boolean;
  onMinimize?: () => void;
  /** Telemetry for the SyncStatusBadge. */
  realtimeProcessed?: number;
  realtimeReady?: boolean;
  peerCount?: number;
  /** Synced Start: host holds `syncStage`, guests hold `staging`. */
  syncStage?: { targetTime: number; releaseAt: number } | null;
  staging?: { targetTime: number; releaseAt: number } | null;
  onSyncStart?: () => void;
  onReleaseSyncNow?: () => void;
  onCancelSync?: () => void;
  /** Collaborative controls toggle (host only). */
  controlsMode?: "HOST_ONLY" | "COLLABORATIVE";
  onSetControlsMode?: (mode: "HOST_ONLY" | "COLLABORATIVE") => void;
  /** Queue items from the party room */
  pendingQueue?: QueueItem[];
  /** Function to suggest content to queue */
  suggestToQueue?: (item: Omit<QueueItem, "id" | "votes" | "voteCount" | "suggestedAt" | "suggestedBy" | "suggestedByName" | "suggestedByAvatar">) => Promise<void>;
  /** Function to vote on a queue item */
  voteQueueItem?: (itemId: string) => Promise<void>;
  /** Function for host to confirm a queue item */
  confirmQueueItem?: (itemId: string) => Promise<void>;
  /** Function for host to remove a queue item */
  removeQueueItem?: (itemId: string) => Promise<void>;
  /** Function for user to remove their own queue item */
  removeOwnQueueItem?: (itemId: string) => Promise<void>;
  /** Broadcast mute-all command to all guests via WebRTC data channel (host only) */
  sendMuteAll?: () => void;
}

type SidebarTab = "chat" | "friends" | "party" | "queue";

interface QueueItem {
  id: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  title: string;
  posterPath?: string | null;
  serverIndex?: number;
  suggestedBy: string;
  suggestedByName: string;
  suggestedByAvatar?: string | null;
  suggestedAt: number;
  votes: string[];
  voteCount: number;
  confirmed?: boolean;
}

export const FlixPartySidebar = memo(function FlixPartySidebar({
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
  transferHost,
  sendMuteAll,
  isMobile = false,
  mobileExpanded = true,
  onMinimize,
  realtimeProcessed,
  peerCount,
  syncStage = null,
  staging = null,
  onSyncStart,
  onReleaseSyncNow,
  onCancelSync,
  controlsMode = "HOST_ONLY",
  onSetControlsMode,
  pendingQueue = [],
  suggestToQueue,
  voteQueueItem,
  confirmQueueItem,
  removeQueueItem,
  removeOwnQueueItem,
}: FlixPartySidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>(roomId ? "chat" : "friends");
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showPassCrown, setShowPassCrown] = useState(false);
  const [passingCrown, setPassingCrown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Push-to-talk: when the mic is off, holding Space transmits. When the mic
  // is already on, PTT is a no-op (mic stays live). This keeps the behaviour
  // predictable for users who prefer always-on mics.
  const ptt = usePushToTalk({
    enabled: Boolean(media && !media.micOn),
    mode: "hold",
    onStateChange: (live) => {
      if (!media?.micOn) media?.setMicLive?.(live);
    },
  });

  const { user } = useAuth();
  const { profile } = useUserProfileContext();
  const { friends, incomingRequests } = useFriends();
  const { toast } = useToast();
  const t = useTranslations("party");

  // Memoised so the chat callbacks below stay referentially stable â€” the
  // inline fallback otherwise re-created them on every sidebar render.
  const sendMessage = useMemo(
    () => sendPartyMessage ?? (async (_text: string, _emoji?: string) => undefined),
    [sendPartyMessage]
  );

  const QUICK_EMOJIS = ["ðŸ˜‚", "ðŸ”¥", "â¤ï¸", "ðŸ‘", "ðŸ˜®", "ðŸ’€", "ðŸŽ¬", "ðŸ¿"];

  useEffect(() => {
    if (roomId) setActiveTab("chat");
  }, [roomId]);

  // D5 — toast once when playback drift resolves back into sync.
  const sawDriftRef = useRef(false);
  const [syncAnnouncement, setSyncAnnouncement] = useState("");

  useEffect(() => {
    if (syncStatus === "drift" || syncStatus === "resyncing") {
      sawDriftRef.current = true;
      return;
    }
    if (syncStatus === "connected" && sawDriftRef.current) {
      sawDriftRef.current = false;
      toast({ title: "Back in sync", description: "Playback caught up with the host." });
      // Also announce to screen readers
      setSyncAnnouncement("Playback back in sync with host");
      setTimeout(() => setSyncAnnouncement(""), 1000);
    }
  }, [syncStatus, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, activeTab]);

  // Handle Escape key to close sidebar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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

  const handlePassCrown = useCallback(
    async (targetUserId: string) => {
      if (!transferHost || passingCrown) return;
      const target = room?.participants?.find((p) => p.userId === targetUserId);
      setPassingCrown(true);
      try {
        const ok = await transferHost(targetUserId);
        setShowPassCrown(false);
        toast(
          ok
            ? {
                title: "Crown passed",
                description: `${target?.displayName ?? "They"} now control${target ? "s" : ""} playback for the room.`,
              }
            : {
                title: "Could not pass the crown",
                description: "They may have left the party. Try again.",
                variant: "destructive",
              }
        );
      } catch (err) {
        toast({
          title: "Could not pass the crown",
          description: firestoreErrorMessage(err),
          variant: "destructive",
        });
      } finally {
        setPassingCrown(false);
      }
    },
    [transferHost, passingCrown, room?.participants, toast]
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

  const handleCopyPartyLink = useCallback(() => {
    if (!partyJoinUrl) {
      toast({
        title: t("noActivePartyToast"),
        description: t("openPartyTab"),
        variant: "destructive",
      });
      setActiveTab("party");
      return;
    }
    void navigator.clipboard.writeText(partyJoinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast({ title: t("linkCopied") });
  }, [partyJoinUrl, toast, t]);

  const handleInviteFriend = useCallback(
    async (friend: Friend) => {
      if (!user || invitingFriendId) return;

      setInvitingFriendId(friend.userId);
      let joinUrl = partyJoinUrl;
      let activeRoomId = roomId;

      try {
        if (!joinUrl && onStartParty) {
          toast({ title: "Starting partyâ€¦", description: "Creating your watch room." });
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

  const _participants: FlixPartyParticipant[] = room?.participants || [];
  const panelClass = embedded
    ? `player-party-panel${isMobile ? " player-party-panel--mobile" : ""}${isMobile && mobileExpanded ? " player-party-panel--expanded" : ""}${isMobile && !mobileExpanded ? " player-party-panel--minimized" : ""}`
    : "fixed inset-y-0 right-0 z-[10000] w-full sm:w-96 lg:w-[28rem] 2xl:w-[32rem] 3xl:w-[36rem] 4xl:w-[42rem] flex flex-col bg-zinc-950 border-l border-white/10 shadow-2xl animate-slide-in-right";

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
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="font-bold text-white text-sm truncate">{t("watchTogether")}</h2>
              {isHostProp && roomId && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300 shrink-0">
                  <Crown className="w-3 h-3" />
                  {t("host")}
                </span>
              )}
            </div>
            {!isMobile && (
              <p className="text-xs text-gray-500">
                {roomId && room ? (
                  <>
                    {room.participants?.length ?? 0} here
                    <span className="ml-1 opacity-70">
                      Â· {friends.length} friend{friends.length !== 1 ? "s" : ""}
                    </span>
                  </>
                ) : (
                  <>
                    {friends.length} friend{friends.length !== 1 ? "s" : ""}
                  </>
                )}
                {incomingRequests.length > 0 && (
                  <span className="text-red-400 ml-1">Â· {incomingRequests.length} request{incomingRequests.length !== 1 ? "s" : ""}</span>
                )}
              </p>
            )}
            {roomId && (
              <>
                {/* Live region for sync status changes */}
                <div
                  className="sr-only"
                  aria-live="assertive"
                  aria-atomic="true"
                  aria-label="Playback sync status"
                >
                  {syncStatus === "connected" && "Playback in sync"}
                  {syncStatus === "drift" && "Playback drifting"}
                  {syncStatus === "resyncing" && "Resyncing playback"}
                  {syncStatus === "connecting" && "Connecting to party"}
                  {syncStatus === "disconnected" && "Disconnected from party"}
                </div>
                {/* Live region for "Back in sync" announcement */}
                {syncAnnouncement && (
                  <div
                    className="sr-only"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {syncAnnouncement}
                  </div>
                )}
                <SyncStatusBadge
                  status={syncStatus}
                  driftMs={driftMs}
                  processed={realtimeProcessed}
                  peers={peerCount}
                  className="mt-1"
                />
              </>
            )}
            {roomId && isHostProp && onSetControlsMode && (
              <button
                type="button"
                className="mt-1 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/70 hover:bg-white/10"
                onClick={() =>
                  onSetControlsMode(controlsMode === "COLLABORATIVE" ? "HOST_ONLY" : "COLLABORATIVE")
                }
                title="Toggle who can control playback"
                aria-pressed={controlsMode === "COLLABORATIVE"}
              >
                {controlsMode === "COLLABORATIVE" ? "Collaborative" : "Host only"}
              </button>
            )}
            {roomId && isHostProp && transferHost && (room?.participants?.length ?? 0) > 1 && (
              <button
                type="button"
                className="mt-1 ml-1 inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200 hover:bg-amber-500/20"
                onClick={() => setShowPassCrown(true)}
                title="Hand host controls to someone else"
              >
                <Crown className="w-3 h-3" aria-hidden="true" />
                Pass crown
              </button>
            )}
          </div>
        </div>
        {room && !isMobile && (
          <PartyPresenceArt participants={room.participants} currentUserId={user?.uid} />
        )}
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

      {roomId && !isHostProp && staging && (
        <GuestStagingBanner staging={staging} />
      )}

      {roomId && partyJoinUrl && !isMobile && (
        <div className="px-3 py-2 border-b border-white/10 shrink-0">
          <button
            type="button"
            onClick={handleCopyPartyLink}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 min-h-[2.75rem] rounded-xl text-sm font-semibold transition-colors bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-green-400" />
                {t("linkCopied")}
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                {t("shareLink")}
              </>
            )}
          </button>
        </div>
      )}

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
          { id: "friends" as const, label: t("friends"), icon: UserPlus },
          { id: "chat" as const, label: t("chat"), icon: Send },
          { id: "party" as const, label: t("party"), icon: Users },
          { id: "queue" as const, label: t("queue"), icon: List },
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
        {/* Friends tab */}
        {activeTab === "friends" && (
          <div className="flex flex-col flex-1 min-h-0">
            {roomId && (
              <div className="shrink-0 border-b border-white/10 px-3 py-2">
                <p className="text-[10px] text-gray-500 leading-relaxed">{t("friendsHint")}</p>
                {partyJoinUrl && (
                  <button
                    type="button"
                    onClick={handleCopyPartyLink}
                    className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-gray-300 hover:bg-white/10 transition-colors"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        {t("linkCopied")}
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        {t("shareLink")}
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <FriendsList
                inviteMode={!!roomId}
                onInvite={handleInviteFriend}
                invitingUserId={invitingFriendId}
              />
            </div>
          </div>
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
                      pttState={ptt.state}
                      compact={isMobile}
                    />
                  </div>
                )}
                {/* Live region for chat messages and reactions */}
                <div
                  ref={messagesEndRef}
                  className="sr-only"
                  aria-live="polite"
                  aria-atomic="true"
                  aria-label="Chat messages"
                />
                <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex gap-2.5">
                      {msg.senderAvatar ? (
                        <Image
                          src={msg.senderAvatar}
                          alt={msg.senderName}
                          width={24}
                          height={24}
                          className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
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
                          <span className="text-2xl" role="img" aria-label={`${msg.senderName} reacted with ${msg.emoji}`}>{msg.emoji}</span>
                        ) : (
                          <p className="text-xs text-gray-200 break-words">{msg.text}</p>
                        )}
                      </div>
                    </div>
                  ))}
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
                      placeholder="Say somethingâ€¦"
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
          <div className="flex-1 overflow-y-auto min-h-0">
            {roomId && isHostProp && onSyncStart && onReleaseSyncNow && onCancelSync && (
              <div className="px-3 pt-3">
                <HostSyncCard
                  stage={syncStage}
                  onStart={onSyncStart}
                  onReleaseNow={onReleaseSyncNow}
                  onCancel={onCancelSync}
                />
              </div>
            )}
            {roomId && syncStatus === "connecting" && !staging && (
              <div className="mx-3 mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
                Waiting for the host signalâ€¦ your video syncs automatically
                once it arrives. If this persists, press{" "}
                <kbd className="rounded border border-white/20 bg-white/10 px-1 font-semibold">N</kbd>{" "}
                to try the next server.
              </div>
            )}
            {roomId && media && (
              <div className="px-3 pt-3 space-y-2">
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
                  pttState={ptt.state}
                  compact={isMobile}
                />
                {/* Mute all except host button - host only */}
                {isHostProp && sendMuteAll && (
                  <button
                    type="button"
                    onClick={() => {
                      sendMuteAll();
                      toast({
                        title: "Muted all guests",
                        description: "All guests' microphones have been muted. You remain unmuted.",
                      });
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-600/20 border border-amber-500/30 text-amber-200 hover:bg-amber-600/30 text-sm font-medium transition-colors"
                    title="Mute all guests except yourself"
                  >
                    <MicOff className="w-4 h-4" />
                    <span>Mute all except host</span>
                  </button>
                )}
                {room && user && (
                  <PartyMembersPanel
                    participants={room.participants}
                    hostId={room.hostId}
                    currentUserId={user.uid}
                    isHost={isHostProp}
                    onKick={(id) => {
                      const kicked = room?.participants?.find((p) => p.userId === id);
                      void kickParticipant?.(id);
                      toast({
                        title: "Guest removed",
                        description: kicked?.displayName
                          ? `${kicked.displayName} was removed from the party.`
                          : "They were removed from the party.",
                      });
                    }}
                    onToggleMic={(id, muted) => void setParticipantMicMuted?.(id, muted)}
                    onToggleCam={(id, off) => void setParticipantCamDisabled?.(id, off)}
                  />
                )}
              </div>
            )}
            <div className="p-3">
              {movieId && title && (
                <WatchParty
                  movieId={movieId}
                  mediaType={mediaType || "movie"}
                  season={season}
                  episode={episode}
                  title={title}
                  posterPath={posterPath || null}
                  onSyncToPosition={onSyncToPosition || (() => {})}
                  onStartParty={onStartParty}
                  externalRoomId={roomId}
                  partyJoinUrl={partyJoinUrl}
                />
              )}
            </div>
          </div>
        )}

        {/* Queue tab */}
        {activeTab === "queue" && (
          <div className="flex-1 overflow-y-auto min-h-0">
            {!roomId ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <List className="w-8 h-8 text-gray-700 mb-2" />
                <p className="text-xs text-gray-500">No active party</p>
                <p className="text-[10px] text-gray-600 mt-1">Start a party to use the queue</p>
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="shrink-0 border-b border-white/10 px-3 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-white text-sm">{t("queueTitle")}</h3>
                    {isHostProp && (
                      <span className="text-[10px] text-amber-400">
                        {t("hostCanConfirm")}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    {t("queueHint")}
                  </p>
                </div>

                {pendingQueue && pendingQueue.length > 0 ? (
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                    {pendingQueue.map((item) => (
                      <QueueItemCard
                        key={item.id}
                        item={item}
                        isHost={isHostProp}
                        currentUserId={user?.uid}
                        onVote={voteQueueItem}
                        onConfirm={confirmQueueItem}
                        onRemove={removeQueueItem}
                        onRemoveOwn={removeOwnQueueItem}
                        t={t}
                        toast={toast}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <List className="w-12 h-12 text-gray-700 mb-3" />
                    <p className="text-sm text-gray-400">{t("queueEmpty")}</p>
                    <p className="text-[10px] text-gray-600 mt-1">{t("queueEmptyHint")}</p>
                  </div>
                )}

                {/* Add to queue form */}
                <div className="shrink-0 p-3 border-t border-white/10 bg-zinc-950/95">
                  <AddToQueueForm
                    onSuggest={suggestToQueue}
                    isHost={isHostProp}
                    t={t}
                    toast={toast}
                  />
                </div>
              </div>
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
            pttState={ptt.state}
            compact
          />
        </div>
      )}

      {room && transferHost && (
        <PassCrownDialog
          open={showPassCrown}
          busy={passingCrown}
          participants={room.participants}
          currentHostId={room.hostId}
          onSelect={(id) => void handlePassCrown(id)}
          onCancel={() => setShowPassCrown(false)}
        />
      )}
    </div>
  );
});
