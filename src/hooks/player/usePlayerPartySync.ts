import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFlixParty } from "@/hooks/player/useFlixParty";
import { useWebRTCSync, type SyncMessage } from "@/hooks/player/useWebRTCSync";
import { computeResync, sendSoftSeek, injectSeekParam } from "@/lib/player/embedSeekUrls";
import {
  encryptPayload,
  generateRoomKey,
  buildPartyJoinUrl,
} from "@/lib/player/roomEncryption";
import type { SyncStatus } from "@/components/player/SyncStatusBadge";
import { usePartyMedia } from "@/hooks/player/usePartyMedia";
import { playUiSound } from "@/lib/uiSound";
import { firestoreErrorMessage, isFirestoreQuotaError } from "@/lib/firestore/errors";

interface UsePlayerPartySyncOptions {
  movieId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  currentServer: number;
  currentSourceUrl: string;
  currentSourceProviderUrl: string;
  currentTime: number;
  isPlaying: boolean;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  setPlaying: (playing: boolean) => void;
  seekTo: (time: number) => void;
  seekRelative: (delta: number) => void;
}

export function usePlayerPartySync({
  movieId,
  mediaType,
  season,
  episode,
  currentServer,
  currentSourceUrl,
  currentSourceProviderUrl,
  currentTime,
  isPlaying,
  iframeRef,
  setPlaying,
  seekTo,
  seekRelative,
}: UsePlayerPartySyncOptions) {
  const { user } = useAuth();
  const [showPartyPanel, setShowPartyPanel] = useState(false);
  const [partyRoomId, setPartyRoomId] = useState<string | null>(null);
  const [partyRoomKey, setPartyRoomKey] = useState<string | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [partySyncStatus, setPartySyncStatus] = useState<SyncStatus>("disconnected");
  const [partyDriftMs, setPartyDriftMs] = useState(0);

  const {
    room: partyRoom,
    messages: partyMessages,
    isHost: isPartyHost,
    createRoom: createPartyRoom,
    joinRoomById,
    leaveRoom: leavePartyRoom,
    updatePlaybackState,
    sendMessage: sendPartyMessage,
    kickParticipant,
    setParticipantMicMuted,
    setParticipantCamDisabled,
  } = useFlixParty({ roomId: partyRoomId });

  const partyParticipantIds = partyRoom?.participants?.map((p) => p.userId) ?? [];

  const handlePartyPlaybackSync = useCallback(
    (msg: SyncMessage) => {
      if (isPartyHost) return;
      if (msg.type === "play") setPlaying(true);
      if (msg.type === "pause") setPlaying(false);
      if (msg.type === "seek" && typeof msg.data.currentTime === "number") {
        seekTo(msg.data.currentTime);
      }
      if (msg.type === "heartbeat" && typeof msg.data.currentTime === "number") {
        const drift = Math.abs(currentTime - msg.data.currentTime);
        if (drift > 3) seekTo(msg.data.currentTime);
      }
    },
    [isPartyHost, setPlaying, seekTo, currentTime]
  );

  const onRemoteStreamRef = useRef<(peerId: string, stream: MediaStream) => void>(() => {});
  const onRemoteStreamRemovedRef = useRef<(peerId: string) => void>(() => {});
  const partyJoinAttempted = useRef(false);
  const wasInPartyRef = useRef(false);

  const { isConnected: rtcConnected, sendMessage: sendRtcMessage, setLocalStream } = useWebRTCSync({
    roomId: partyRoomId,
    isHost: !!isPartyHost,
    hostId: partyRoom?.hostId ?? null,
    participantIds: partyParticipantIds,
    onPlaybackSync: handlePartyPlaybackSync,
    onRemoteStream: (peerId, stream) => onRemoteStreamRef.current(peerId, stream),
    onRemoteStreamRemoved: (peerId) => onRemoteStreamRemovedRef.current(peerId),
  });

  const participantNames = useMemo(() => {
    const map = new Map<string, string>();
    partyRoom?.participants?.forEach((p) => map.set(p.userId, p.displayName));
    return map;
  }, [partyRoom?.participants]);

  const media = usePartyMedia({
    roomId: partyRoomId,
    setLocalStream,
    sendSpeakingState: (speaking) => sendRtcMessage("speaking", { speaking }),
    participantNames,
    localUserId: user?.uid ?? null,
    localDisplayName: user?.displayName || "You",
    hostMicForcedOff: partyRoom?.participants?.find((p) => p.userId === user?.uid)?.micMutedByHost ?? false,
    hostCamForcedOff: partyRoom?.participants?.find((p) => p.userId === user?.uid)?.camDisabledByHost ?? false,
  });

  useEffect(() => {
    onRemoteStreamRef.current = media.onRemoteStream;
    onRemoteStreamRemovedRef.current = media.onRemoteStreamRemoved;
  }, [media.onRemoteStream, media.onRemoteStreamRemoved]);

  const lastPartyResyncRef = useRef(0);

  useEffect(() => {
    if (!partyRoom || isPartyHost || !partyRoomId) return;

    const driftSec = Math.abs(currentTime - partyRoom.lastKnownTime);
    setPartyDriftMs(driftSec * 1000);

    if (partyRoom.playbackState === "playing" && !isPlaying) setPlaying(true);
    if (partyRoom.playbackState === "paused" && isPlaying) setPlaying(false);

    if (driftSec < 3) {
      setPartySyncStatus(rtcConnected ? "connected" : "connecting");
      return;
    }

    const now = Date.now();
    if (now - lastPartyResyncRef.current < 4000) return;
    lastPartyResyncRef.current = now;

    const action = computeResync(
      partyRoom.lastKnownTime,
      currentTime,
      currentSourceProviderUrl,
      currentSourceUrl
    );

    if (action.kind === "soft") {
      setPartySyncStatus("drift");
      sendSoftSeek(iframeRef.current, action.deltaSeconds);
      seekRelative(action.deltaSeconds);
    } else if (action.kind === "hard" && iframeRef.current) {
      setPartySyncStatus("drift");
      iframeRef.current.src = injectSeekParam(currentSourceProviderUrl, partyRoom.lastKnownTime);
    }
  }, [
    partyRoom?.lastKnownTime,
    partyRoom?.playbackState,
    isPartyHost,
    partyRoomId,
    isPlaying,
    currentSourceUrl,
    currentSourceProviderUrl,
    rtcConnected,
    setPlaying,
    seekRelative,
    currentTime,
    iframeRef,
  ]);

  useEffect(() => {
    if (!partyRoomId) {
      setPartySyncStatus("disconnected");
      return;
    }
    if (rtcConnected) setPartySyncStatus("connected");
    else if (partyRoom) setPartySyncStatus("connecting");
  }, [partyRoomId, rtcConnected, partyRoom]);

  useEffect(() => {
    if (partyRoomId || !user || partyJoinAttempted.current) return;
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get("party");
    if (!joinId) return;

    partyJoinAttempted.current = true;
    setShowPartyPanel(true);
    void joinRoomById(joinId).then((ok) => {
      if (ok) setPartyRoomId(joinId);
    });
  }, [partyRoomId, user, joinRoomById]);

  const broadcastPartyState = useCallback(
    (state: "playing" | "paused", time: number) => {
      if (!partyRoomId || !isPartyHost) return;
      void updatePlaybackState(state, time);
      sendRtcMessage(state === "playing" ? "play" : "pause", { currentTime: time });
    },
    [partyRoomId, isPartyHost, updatePlaybackState, sendRtcMessage]
  );

  const partyTimeRef = useRef(currentTime);
  const partyPlayingRef = useRef(isPlaying);
  partyTimeRef.current = currentTime;
  partyPlayingRef.current = isPlaying;

  useEffect(() => {
    if (!partyRoomId || !isPartyHost) return;

    const tick = () => {
      const time = partyTimeRef.current;
      sendRtcMessage("heartbeat", { currentTime: time });
    };

    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [partyRoomId, isPartyHost, sendRtcMessage]);

  const handleStartParty = useCallback(async (): Promise<{ roomId: string; joinUrl: string } | null> => {
    if (!user) {
      setShowPartyPanel(true);
      return null;
    }
    try {
      const key = generateRoomKey();
      const encrypted = await encryptPayload(
        { tmdbId: movieId, mediaType, season, episode, serverIndex: currentServer },
        key
      );
      const id = await createPartyRoom(encrypted);
      setPartyRoomId(id);
      setPartyRoomKey(key);
      setShowInviteDialog(true);
      setShowPartyPanel(true);
      playUiSound("success");
      return { roomId: id, joinUrl: buildPartyJoinUrl(id, key) };
    } catch (err) {
      console.error("Failed to create party:", err);
      playUiSound("error");
      if (isFirestoreQuotaError(err)) {
        throw new Error(firestoreErrorMessage(err));
      }
      throw err;
    }
  }, [user, movieId, mediaType, season, episode, currentServer, createPartyRoom]);

  const handleLeaveParty = useCallback(() => {
    void leavePartyRoom();
    setPartyRoomId(null);
    setPartyRoomKey(null);
    setShowInviteDialog(false);
    wasInPartyRef.current = false;
  }, [leavePartyRoom]);

  // Guest was kicked — no longer in participant list
  useEffect(() => {
    if (!partyRoomId || !user || !partyRoom) return;
    const inRoom = partyRoom.participants.some((p) => p.userId === user.uid);
    if (inRoom) wasInPartyRef.current = true;
    else if (wasInPartyRef.current) {
      handleLeaveParty();
      setShowPartyPanel(false);
    }
  }, [partyRoom?.participants, partyRoomId, user, partyRoom, handleLeaveParty]);

  const partyJoinUrl =
    partyRoomId && partyRoomKey
      ? buildPartyJoinUrl(partyRoomId, partyRoomKey)
      : partyRoom?.code
        ? `${typeof window !== "undefined" ? window.location.origin : ""}/party/join?code=${partyRoom.code}`
        : null;

  return {
    showPartyPanel,
    setShowPartyPanel,
    partyRoomId,
    partyRoom,
    partySyncStatus,
    partyDriftMs,
    showInviteDialog,
    setShowInviteDialog,
    isPartyHost,
    handleStartParty,
    handleLeaveParty,
    broadcastPartyState,
    partyJoinUrl,
    partyRoomCode: partyRoom?.code || (partyRoomId ? partyRoomId.slice(0, 6).toUpperCase() : ""),
    partyMessages,
    sendPartyMessage,
    kickParticipant,
    setParticipantMicMuted,
    setParticipantCamDisabled,
    media,
  };
}
