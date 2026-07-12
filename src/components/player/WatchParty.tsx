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
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useFriends, type Friend } from "@/hooks/useFriends";
import { useToast } from "@/hooks/use-toast";
import { sendWatchPartyInvite } from "@/lib/notifications/sendWatchPartyInvite";
import { firestoreErrorMessage } from "@/lib/firestore/errors";
import { Send, Users, Copy, Check, X, Loader2 } from "lucide-react";

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

  // Legacy watch_parties listener — skip when using FlixParty (onStartParty)
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

  // Invite a friend to the room
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

  // End the party
  const endParty = useCallback(async () => {
    if (!activeRoom || !user || activeRoom.hostId !== user.uid) return;

    const db = getFirestore();
    await updateDoc(doc(db, "watch_parties", activeRoom.id), {
      status: "ended",
    });
    setActiveRoom(null);
  }, [activeRoom, user]);

  // Leave the party
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

  // Copy invite link (FlixParty external room or legacy watch_parties room)
  const copyInviteLink = useCallback(() => {
    const roomId = activeRoom?.id ?? activeRoomId;
    if (!roomId) return;

    const mid = activeRoom?.movieId ?? movieId;
    const mtype = activeRoom?.mediaType ?? mediaType;
    const params = new URLSearchParams({ type: mtype, party: roomId });
    const s = activeRoom?.season ?? season;
    const e = activeRoom?.episode ?? episode;
    if (s) params.set("season", String(s));
    if (e) params.set("episode", String(e));

    const link = `${window.location.origin}/movie/${mid}?${params}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }, [activeRoom, activeRoomId, movieId, mediaType, season, episode]);

  // Cleanup
  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* No active room — show create/invite */}
      {!activeRoom && !activeRoomId && (
        <div>
          <button
            onClick={() => void handleStart()}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-sm font-bold text-white transition-all disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Users className="w-4 h-4" />
            )}
            {creating ? "Creating party..." : "Start Watch Party"}
          </button>
          <p className="text-[10px] text-gray-500 text-center mt-2">
            Invite friends to watch together in sync
          </p>
        </div>
      )}

      {/* Active room — show party info + invite */}
      {(activeRoom || activeRoomId) && (
        <div className="space-y-3">
          {/* Room status */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-medium text-purple-300">Party active</span>
            </div>
            <span className="text-[10px] text-gray-500">
              {activeRoom?.participants.length ?? 1} watching
            </span>
          </div>

          {/* Share link */}
          <button
            onClick={copyInviteLink}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 transition-colors"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-400" />
                Link copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy invite link
              </>
            )}
          </button>

          {/* Invite friends */}
          <div>
            <button
              onClick={() => setShowInviteList(!showInviteList)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Invite friends
            </button>

            {showInviteList && (
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {friends.length === 0 && (
                  <p className="text-[10px] text-gray-500 text-center py-2">
                    Add friends to invite them
                  </p>
                )}
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    {friend.avatarUrl ? (
                      <img src={friend.avatarUrl} alt={friend.displayName} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-[9px] font-bold text-white">
                        {friend.displayName.charAt(0)}
                      </div>
                    )}
                    <span className="flex-1 text-xs text-gray-300 truncate">{friend.displayName}</span>
                    <button
                      onClick={() => inviteFriend(friend)}
                      disabled={invitedFriend === friend.userId}
                      className="px-2 py-1 rounded-md bg-red-600 hover:bg-red-500 text-[10px] font-semibold text-white transition-colors disabled:opacity-30"
                    >
                      {invitedFriend === friend.userId ? "Sent!" : "Invite"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* End party (host only) */}
          {activeRoom?.hostId === user?.uid && (
            <button
              onClick={endParty}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              End party
            </button>
          )}

          {/* Leave party (non-host) */}
          {activeRoom && activeRoom.hostId !== user?.uid && (
            <button
              onClick={leaveParty}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-500 hover:text-white transition-colors"
            >
              Leave party
            </button>
          )}
        </div>
      )}
    </div>
  );
}
