"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  limit,
  Timestamp,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useFriends, type Friend } from "@/hooks/useFriends";
import { useToast } from "@/hooks/use-toast";
import { sendWatchPartyInvite } from "@/lib/notifications/sendWatchPartyInvite";
import { firestoreErrorMessage } from "@/lib/firestore/errors";
import {
  Send,
  Users,
  Copy,
  Check,
  X,
  Loader2,
  PartyPopper,
  Link2,
  Shield,
} from "lucide-react";

export interface WatchPartyRoom {
  id: string;
  hostId: string;
  hostName: string;
  movieId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  title: string;
  posterPath: string | null;
  status: "active" | "ended";
  participants: string[];
  createdAt: number;
}

interface WatchPartyProps {
  movieId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  title: string;
  posterPath: string | null;
  currentTime: number;
  isPlaying: boolean;
  onSyncToPosition: (position: number) => void;
  onStartParty?: () => Promise<{ roomId: string; joinUrl: string } | null> | void;
  externalRoomId?: string | null;
  partyJoinUrl?: string | null;
}

export function WatchParty({
  movieId,
  mediaType,
  season,
  episode,
  title,
  posterPath,
  currentTime,
  isPlaying,
  onSyncToPosition,
  onStartParty,
  externalRoomId,
  partyJoinUrl,
}: WatchPartyProps) {
  const { user } = useAuth();
  const { friends } = useFriends();
  const { toast } = useToast();
  const [activeRoom, setActiveRoom] = useState<WatchPartyRoom | null>(null);
  const [invitedFriend, setInvitedFriend] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [creating, setCreating] = useState(false);
  const [localRoomId, setLocalRoomId] = useState<string | null>(null);
  const [showInviteList, setShowInviteList] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const activeRoomId = externalRoomId ?? localRoomId;

  useEffect(() => {
    if (!user || onStartParty) return;

    const db = getFirestore();
    const roomsRef = collection(db, "watch_parties");
    const q = query(
      roomsRef,
      where("participants", "array-contains", user.uid),
      where("status", "==", "active"),
      limit(1)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const roomDoc = snap.docs[0];
        setActiveRoom({ id: roomDoc.id, ...roomDoc.data() } as WatchPartyRoom);
      } else {
        setActiveRoom(null);
      }
    });

    unsubscribeRef.current = unsub;
    return () => unsub();
  }, [user, onStartParty]);

  const createRoom = useCallback(async () => {
    if (!user || creating) return;
    setCreating(true);

    try {
      const db = getFirestore();
      const roomId = crypto.randomUUID().slice(0, 12);

      const roomData: Omit<WatchPartyRoom, "id"> = {
        hostId: user.uid,
        hostName: user.displayName || "Host",
        movieId,
        mediaType,
        season,
        episode,
        title,
        posterPath,
        status: "active",
        participants: [user.uid],
        createdAt: Date.now(),
      };

      await setDoc(doc(db, "watch_parties", roomId), roomData);
      setLocalRoomId(roomId);
      setActiveRoom({ id: roomId, ...roomData });
    } catch (err) {
      console.error("Failed to create room:", err);
      toast({
        title: "Could not create party",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }, [user, creating, movieId, mediaType, season, episode, title, posterPath, toast]);

  const handleStart = useCallback(async () => {
    if (creating) return;
    if (onStartParty) {
      setCreating(true);
      try {
        const result = await onStartParty();
        if (result && typeof result === "object") {
          setLocalRoomId(result.roomId);
          toast({ title: "Party started", description: "Invite friends from the Friends tab." });
        }
      } catch (err) {
        toast({
          title: "Could not start party",
          description: firestoreErrorMessage(err),
          variant: "destructive",
        });
      } finally {
        setCreating(false);
      }
      return;
    }
    await createRoom();
  }, [creating, onStartParty, createRoom, toast]);

  const inviteFriend = useCallback(async (friend: Friend) => {
    if (!user) return;

    const roomIdForInvite = activeRoom?.id ?? activeRoomId;
    if (!roomIdForInvite) return;

    const myName = user.displayName || user.email?.split("@")[0] || "Host";
    const joinUrl =
      partyJoinUrl ||
      `${window.location.origin}/movie/${activeRoom?.movieId ?? movieId}?type=${activeRoom?.mediaType ?? mediaType}&party=${roomIdForInvite}`;

    try {
      const sent = await sendWatchPartyInvite({
        roomId: roomIdForInvite,
        roomTitle: activeRoom?.title ?? title,
        fromUserId: user.uid,
        fromUserName: myName,
        toUserId: friend.userId,
        toUserName: friend.displayName,
        movieId: activeRoom?.movieId ?? movieId,
        mediaType: activeRoom?.mediaType ?? mediaType,
        season: activeRoom?.season ?? season,
        episode: activeRoom?.episode ?? episode,
        posterPath: activeRoom?.posterPath ?? posterPath,
        partyJoinUrl: joinUrl,
      });

      setInvitedFriend(friend.userId);
      setTimeout(() => setInvitedFriend(null), 2000);
      toast({
        title: sent ? "Invite sent" : "Invite failed",
        description: sent
          ? `${friend.displayName} will see a toast and bell notification.`
          : `Could not notify ${friend.displayName}.`,
        variant: sent ? "default" : "destructive",
      });
    } catch (err) {
      console.error("[party-invite] send failed:", err);
      toast({
        title: "Invite failed",
        description: "Could not send the invite. Try again.",
        variant: "destructive",
      });
    }
  }, [activeRoom, activeRoomId, user, partyJoinUrl, movieId, mediaType, season, episode, title, posterPath, toast]);

  const endParty = useCallback(async () => {
    if (!activeRoom || !user || activeRoom.hostId !== user.uid) return;

    const db = getFirestore();
    await updateDoc(doc(db, "watch_parties", activeRoom.id), {
      status: "ended",
    });
    setActiveRoom(null);
  }, [activeRoom, user]);

  const leaveParty = useCallback(async () => {
    if (!activeRoom || !user) return;

    const db = getFirestore();
    const roomRef = doc(db, "watch_parties", activeRoom.id);

    if (activeRoom.hostId === user.uid) {
      await endParty();
    } else {
      const newParticipants = activeRoom.participants.filter((p) => p !== user.uid);
      if (newParticipants.length === 0) {
        await deleteDoc(roomRef);
      } else {
        await updateDoc(roomRef, { participants: newParticipants });
      }
    }
    setActiveRoom(null);
  }, [activeRoom, user, endParty]);

  const copyInviteLink = useCallback(() => {
    const link = partyJoinUrl || (() => {
      const roomId = activeRoom?.id ?? activeRoomId;
      if (!roomId) return null;
      const mid = activeRoom?.movieId ?? movieId;
      const mtype = activeRoom?.mediaType ?? mediaType;
      const params = new URLSearchParams({ type: mtype, party: roomId });
      const s = activeRoom?.season ?? season;
      const e = activeRoom?.episode ?? episode;
      if (s) params.set("season", String(s));
      if (e) params.set("episode", String(e));
      return `${window.location.origin}/movie/${mid}?${params}`;
    })();
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }, [activeRoom, activeRoomId, movieId, mediaType, season, episode, partyJoinUrl]);

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  return (
    <div className="space-y-3">
      {/* Empty state — Netflix-style invite affordance */}
      {!activeRoom && !activeRoomId && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={creating}
            className="group relative w-full overflow-hidden rounded-md bg-white px-4 py-3 text-sm font-bold text-black transition-all duration-200 hover:bg-white/90 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className="relative z-10 inline-flex items-center justify-center gap-2">
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PartyPopper className="w-4 h-4" />
              )}
              {creating ? "Creating party…" : "Start Watch Party"}
            </span>
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/20 to-red-500/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </button>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
            <Shield className="h-3 w-3" />
            End-to-end synced · invite-only
          </p>
        </div>
      )}

      {/* Active room — clean Netflix-style status + actions */}
      {(activeRoom || activeRoomId) && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between rounded-md border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Live</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white">
              <Users className="h-3 w-3 text-emerald-300" />
              {activeRoom?.participants.length ?? 1} watching
            </div>
          </div>

          <button
            type="button"
            onClick={copyInviteLink}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-[13px] font-semibold text-gray-200 transition-colors hover:bg-white/10 hover:border-white/20"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                Link copied
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                Copy invite link
              </>
            )}
          </button>

          <div>
            <button
              type="button"
              onClick={() => setShowInviteList(!showInviteList)}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                showInviteList
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 hover:border-white/20"
              }`}
              aria-expanded={showInviteList}
            >
              <Send className="w-4 h-4" />
              {showInviteList ? "Hide invite list" : "Invite friends"}
            </button>

            {showInviteList && (
              <div className="mt-2 space-y-1 rounded-md border border-white/10 bg-black/40 p-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                {friends.length === 0 && (
                  <p className="text-[11px] text-gray-500 text-center py-2">
                    Add friends to invite them
                  </p>
                )}
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center gap-2.5 rounded-md p-2 hover:bg-white/5 transition-colors"
                  >
                    {friend.avatarUrl ? (
                      <img
                        src={friend.avatarUrl}
                        alt={friend.displayName}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="grid w-7 h-7 place-items-center rounded-full bg-gradient-to-br from-red-500 to-orange-600 text-[10px] font-bold text-white ring-1 ring-white/10">
                        {friend.displayName.charAt(0)}
                      </div>
                    )}
                    <span className="flex-1 text-[12px] text-gray-200 truncate font-medium">
                      {friend.displayName}
                    </span>
                    <button
                      type="button"
                      onClick={() => inviteFriend(friend)}
                      disabled={invitedFriend === friend.userId}
                      className="rounded-md bg-red-600 hover:bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white transition-colors disabled:opacity-50 focus-ring"
                    >
                      {invitedFriend === friend.userId ? "Sent" : "Invite"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {activeRoom?.hostId === user?.uid && (
            <button
              type="button"
              onClick={endParty}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-red-500/20 bg-red-500/8 px-3 py-2.5 text-[12px] font-bold text-red-300 transition-colors hover:bg-red-500/15 hover:border-red-500/30"
            >
              <X className="w-3.5 h-3.5" />
              End party for everyone
            </button>
          )}

          {activeRoom && activeRoom.hostId !== user?.uid && (
            <button
              type="button"
              onClick={leaveParty}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-[12px] font-semibold text-gray-400 transition-colors hover:text-white hover:bg-white/10"
            >
              Leave party
            </button>
          )}
        </div>
      )}
    </div>
  );
}
