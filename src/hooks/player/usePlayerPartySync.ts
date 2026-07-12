import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useFlixParty } from "@/hooks/player/useFlixParty";
import { useWebRTCSync, type SyncMessage } from "@/hooks/player/useWebRTCSync";
import {
  encryptPayload,
  generateRoomKey,
  buildPartyJoinUrl,
  buildPartyPlayerUrl,
  partyContentMatches,
  resolvePartyContent,
  extractRoomKeyFromHash,
  type PartyContentMeta,
} from "@/lib/player/roomEncryption";
import type { SyncStatus } from "@/components/player/SyncStatusBadge";
import type { GuestSplashPhase } from "@/components/player/PartyGuestSplash";
import { trackGuestJoinSynced } from "@/lib/analytics";
import {
  readGuestJoinSession,
  clearGuestJoinSession,
} from "@/lib/party/guestJoinSession";
import { usePartyMedia } from "@/hooks/player/usePartyMedia";
import { playUiSound } from "@/lib/uiSound";
import { firestoreErrorMessage, isFirestoreQuotaError } from "@/lib/firestore/errors";
import {
  markPartyLeft,
  clearPartyLeftMark,
  hasLeftParty,
  replaceUrlWithoutPartyParams,
  stripGuestJoinParam,
} from "@/lib/player/partyUrl";

const JOIN_GRACE_MS = 1200;
const SYNC_INTERVAL_MS = 1000;
const DRIFT_SEEK_THRESHOLD_SEC = 1.2;
const SEEK_COOLDOWN_MS = 900;
const MAX_GUEST_SPLASH_MS = 14_000;
const HOST_HEARTBEAT_MS = 800;
const MOBILE_BREAKPOINT = 768;

function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;
}

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
  embedReady: boolean;
  embedLiveSynced?: boolean;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  setPlaying: (playing: boolean) => void;
  playEmbed: () => void;
  pauseEmbed: () => void;
  seekEmbed: (time: number) => void;
  seekTo: (time: number) => void;
  seekRelative: (delta: number) => void;
  guestJoinMode?: boolean;
}

export function usePlayerPartySync({
  movieId,
  mediaType,
  season,
  episode,
  currentServer,
  currentTime,
  isPlaying,
  embedReady,
  embedLiveSynced = false,
  setPlaying,
  playEmbed,
  pauseEmbed,
  seekEmbed,
  seekTo,
  guestJoinMode = false,
}: UsePlayerPartySyncOptions) {
  const { user } = useAuth();
  const router = useRouter();
  const [showPartyPanel, setShowPartyPanel] = useState(false);
  const [partyRoomId, setPartyRoomId] = useState<string | null>(null);
  const [partyRoomKey, setPartyRoomKey] = useState<string | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [partySyncStatus, setPartySyncStatus] = useState<SyncStatus>("disconnected");
  const [partyDriftMs, setPartyDriftMs] = useState(0);
  const [guestServerIndex, setGuestServerIndex] = useState<number | null>(null);
  const [guestInitialSynced, setGuestInitialSynced] = useState(false);
  const [guestSplashDismissed, setGuestSplashDismissed] = useState(false);
  const guestJoinSession = useMemo(() => readGuestJoinSession(), []);
  const guestSplashStartedAt = useRef(guestJoinSession?.startedAt ?? Date.now());

  const {
    room: partyRoom,
    messages: partyMessages,
    loading: partyLoading,
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
      if (msg.type === "play") {
        setPlaying(true);
        playEmbed();
      }
      if (msg.type === "pause") {
        setPlaying(false);
        pauseEmbed();
      }
      if (msg.type === "seek" && typeof msg.data.currentTime === "number") {
        seekEmbed(msg.data.currentTime);
        seekTo(msg.data.currentTime);
      }
      if (msg.type === "heartbeat" && typeof msg.data.currentTime === "number") {
        hostTimeRef.current = msg.data.currentTime;
        if (!embedReady) return;
        const hostTime = msg.data.currentTime;
        if (currentTimeRef.current === 0 && hostTime > 10) return;
        const drift = Math.abs(currentTimeRef.current - hostTime);
        if (drift > DRIFT_SEEK_THRESHOLD_SEC) {
          softSeekTo(hostTime);
        }
      }
    },
    [isPartyHost, setPlaying, playEmbed, pauseEmbed, seekEmbed, seekTo, embedReady]
  );

  const onRemoteStreamRef = useRef<(peerId: string, stream: MediaStream) => void>(() => {});
  const onRemoteStreamRemovedRef = useRef<(peerId: string) => void>(() => {});
  const partyJoinAttempted = useRef(false);
  const guestRedirectAttempted = useRef(false);
  const wasInPartyRef = useRef(false);
  const absentPollCountRef = useRef(0);
  const partyJoinTimeRef = useRef<number | null>(null);
  const lastSeekAtRef = useRef(0);
  const currentTimeRef = useRef(currentTime);
  const isPlayingRef = useRef(isPlaying);
  const hostTimeRef = useRef(0);
  const embedReadyRef = useRef(embedReady);
  const embedLiveSyncedRef = useRef(embedLiveSynced);
  const guestServerAppliedRef = useRef(false);
  const initialSyncDoneRef = useRef(false);
  const partyPlaybackRef = useRef<"playing" | "paused">("paused");
  const partyHostTimeRef = useRef(0);

  currentTimeRef.current = currentTime;
  isPlayingRef.current = isPlaying;
  embedReadyRef.current = embedReady;
  embedLiveSyncedRef.current = embedLiveSynced;

  useEffect(() => {
    partyPlaybackRef.current = partyRoom?.playbackState ?? "paused";
    partyHostTimeRef.current = partyRoom?.lastKnownTime ?? 0;
  }, [partyRoom?.playbackState, partyRoom?.lastKnownTime]);

  useEffect(() => {
    if (!embedReady) {
      initialSyncDoneRef.current = false;
      setGuestInitialSynced(false);
    }
  }, [embedReady]);

  const softSeekTo = useCallback(
    (target: number) => {
      const now = Date.now();
      if (now - lastSeekAtRef.current < SEEK_COOLDOWN_MS) return;
      lastSeekAtRef.current = now;
      seekEmbed(target);
      seekTo(target);
    },
    [seekEmbed, seekTo]
  );

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
    roomParticipants: partyRoom?.participants ?? [],
    localUserId: user?.uid ?? null,
    localDisplayName: user?.displayName || "You",
    hostMicForcedOff: partyRoom?.participants?.find((p) => p.userId === user?.uid)?.micMutedByHost ?? false,
    hostCamForcedOff: partyRoom?.participants?.find((p) => p.userId === user?.uid)?.camDisabledByHost ?? false,
  });

  useEffect(() => {
    onRemoteStreamRef.current = media.onRemoteStream;
    onRemoteStreamRemovedRef.current = media.onRemoteStreamRemoved;
  }, [media.onRemoteStream, media.onRemoteStreamRemoved]);

  useEffect(() => {
    if (!partyRoomId || isPartyHost) {
      partyJoinTimeRef.current = null;
      return;
    }
    if (partyJoinTimeRef.current === null) {
      partyJoinTimeRef.current = Date.now();
    }
  }, [partyRoomId, isPartyHost]);

  // Guest: redirect to host content if on wrong movie/episode
  useEffect(() => {
    if (!partyRoomId || isPartyHost || !partyRoom || guestRedirectAttempted.current) return;

    void (async () => {
      const content = await resolvePartyContent(
        partyRoom.contentMeta,
        partyRoom.encryptedPayload,
        extractRoomKeyFromHash()
      );
      if (!content) return;

      if (partyContentMatches(content, movieId, mediaType, season, episode)) {
        const serverIdx = partyRoom.serverIndex ?? content.serverIndex ?? 0;
        if (!guestServerAppliedRef.current) {
          guestServerAppliedRef.current = true;
          setGuestServerIndex(serverIdx);
        }
        return;
      }

      guestRedirectAttempted.current = true;
      router.replace(buildPartyPlayerUrl(partyRoomId, content));
    })();
  }, [partyRoomId, isPartyHost, partyRoom, movieId, mediaType, season, episode, router]);

  // Guest: apply host server index once
  useEffect(() => {
    if (isPartyHost || !partyRoom || guestServerAppliedRef.current) return;
    const serverIdx = partyRoom.serverIndex ?? partyRoom.contentMeta?.serverIndex ?? 0;
    guestServerAppliedRef.current = true;
    setGuestServerIndex(serverIdx);
  }, [isPartyHost, partyRoom]);

  // Guest: periodic drift sync loop — soft seek only, never reload iframe
  useEffect(() => {
    if (!partyRoomId || isPartyHost) return;

    const tick = () => {
      if (!embedReadyRef.current) return;

      if (partyJoinTimeRef.current && Date.now() - partyJoinTimeRef.current < JOIN_GRACE_MS) {
        return;
      }

      const guestTime = currentTimeRef.current;
      const hostTime = Math.max(partyHostTimeRef.current, hostTimeRef.current);

      if (!embedLiveSyncedRef.current && guestTime === 0 && hostTime > 5) {
        return;
      }

      if (guestTime === 0 && hostTime > 10) return;

      const driftSec = Math.abs(guestTime - hostTime);
      setPartyDriftMs(driftSec * 1000);

      if (partyPlaybackRef.current === "playing" && !isPlayingRef.current) {
        setPlaying(true);
        playEmbed();
      } else if (partyPlaybackRef.current === "paused" && isPlayingRef.current) {
        setPlaying(false);
        pauseEmbed();
      }

      if (driftSec >= DRIFT_SEEK_THRESHOLD_SEC) {
        softSeekTo(hostTime);
        setPartySyncStatus("drift");
      } else {
        setPartySyncStatus(rtcConnected ? "connected" : "connecting");
      }
    };

    tick();
    const id = setInterval(tick, SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [
    partyRoomId,
    isPartyHost,
    rtcConnected,
    setPlaying,
    playEmbed,
    pauseEmbed,
    softSeekTo,
  ]);

  // Guest: one-time seek to host position when embed becomes live-synced
  useEffect(() => {
    if (!partyRoomId || isPartyHost || initialSyncDoneRef.current) return;
    if (!embedReady || !embedLiveSynced) return;

    const hostTime = Math.max(partyHostTimeRef.current, hostTimeRef.current);
    if (hostTime <= 0) return;

    initialSyncDoneRef.current = true;
    setGuestInitialSynced(true);
    lastSeekAtRef.current = 0;
    softSeekTo(hostTime);
    if (partyPlaybackRef.current === "playing") {
      setPlaying(true);
      playEmbed();
    }
  }, [partyRoomId, isPartyHost, embedReady, embedLiveSynced, softSeekTo, setPlaying, playEmbed]);

  useEffect(() => {
    if (!partyRoomId) {
      setPartySyncStatus("disconnected");
      return;
    }
    if (rtcConnected) {
      setPartySyncStatus("connected");
    } else if (!isPartyHost && guestInitialSynced) {
      setPartySyncStatus("connected");
    } else if (partyRoom) {
      setPartySyncStatus("connecting");
    }
  }, [partyRoomId, rtcConnected, partyRoom, isPartyHost, guestInitialSynced]);

  // Guest: prime position from room state before WebRTC heartbeats arrive
  useEffect(() => {
    if (!partyRoomId || isPartyHost || !embedReady || initialSyncDoneRef.current) return;
    const hostTime = partyRoom?.lastKnownTime ?? 0;
    if (hostTime <= 0) return;
    lastSeekAtRef.current = 0;
    softSeekTo(hostTime);
  }, [partyRoomId, isPartyHost, embedReady, partyRoom?.lastKnownTime, softSeekTo]);

  // Join party from ?party= URL param
  useEffect(() => {
    if (partyRoomId || !user || partyJoinAttempted.current) return;
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get("party");
    const isGuestEntry = guestJoinMode || params.get("guest") === "1";
    if (!joinId || (hasLeftParty(joinId) && !isGuestEntry)) return;

    if (isGuestEntry) clearPartyLeftMark(joinId);

    partyJoinAttempted.current = true;
    setShowPartyPanel(true);
    void joinRoomById(joinId).then((ok) => {
      if (ok) {
        clearPartyLeftMark(joinId);
        setPartyRoomId(joinId);
      }
    });
  }, [partyRoomId, user, joinRoomById, guestJoinMode]);

  const guestSplashPhase = useMemo((): GuestSplashPhase => {
    if (!guestJoinMode || isPartyHost) return "ready";
    if (!partyRoomId || partyLoading) return "joining";
    if (!embedReady) return "loading";
    if (!guestInitialSynced) return "syncing";
    if (partyDriftMs > 2500) return "syncing";
    if (!rtcConnected && partySyncStatus === "connecting") return "syncing";
    return "ready";
  }, [
    guestJoinMode,
    isPartyHost,
    partyRoomId,
    partyLoading,
    embedReady,
    guestInitialSynced,
    partyDriftMs,
    rtcConnected,
    partySyncStatus,
  ]);

  const guestSplashVisible =
    guestJoinMode && !isPartyHost && !guestSplashDismissed && guestSplashPhase !== "ready";

  useEffect(() => {
    if (!guestJoinMode || isPartyHost || guestSplashDismissed) return;
    if (guestSplashPhase !== "ready") return;
    const t = window.setTimeout(() => {
      setGuestSplashDismissed(true);
      stripGuestJoinParam();
      clearGuestJoinSession();
      trackGuestJoinSynced({
        roomId: partyRoomId ?? undefined,
        driftMs: partyDriftMs,
        elapsedMs: Date.now() - guestSplashStartedAt.current,
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [guestSplashPhase, guestJoinMode, isPartyHost, guestSplashDismissed, partyRoomId, partyDriftMs]);

  // Graceful reveal if sync takes too long — never trap the guest on splash
  useEffect(() => {
    if (!guestJoinMode || isPartyHost || guestSplashDismissed) return;
    const t = window.setTimeout(() => {
      setGuestSplashDismissed(true);
      stripGuestJoinParam();
      clearGuestJoinSession();
      trackGuestJoinSynced({
        roomId: partyRoomId ?? undefined,
        driftMs: partyDriftMs,
        elapsedMs: Date.now() - guestSplashStartedAt.current,
      });
    }, MAX_GUEST_SPLASH_MS);
    return () => window.clearTimeout(t);
  }, [guestJoinMode, isPartyHost, guestSplashDismissed, partyRoomId, partyDriftMs]);

  const broadcastPartyState = useCallback(
    (state: "playing" | "paused", time: number) => {
      if (!partyRoomId || !isPartyHost) return;
      void updatePlaybackState(state, time, currentServer);
      sendRtcMessage(state === "playing" ? "play" : "pause", { currentTime: time });
    },
    [partyRoomId, isPartyHost, updatePlaybackState, sendRtcMessage, currentServer]
  );

  const partyTimeRef = useRef(currentTime);
  const partyPlayingRef = useRef(isPlaying);
  const partyServerRef = useRef(currentServer);
  partyTimeRef.current = currentTime;
  partyPlayingRef.current = isPlaying;
  partyServerRef.current = currentServer;

  useEffect(() => {
    if (!partyRoomId || !isPartyHost) return;

    const tick = () => {
      const time = partyTimeRef.current;
      const playing = partyPlayingRef.current;
      const server = partyServerRef.current;
      sendRtcMessage("heartbeat", { currentTime: time });
      void updatePlaybackState(playing ? "playing" : "paused", time, server);
    };

    tick();
    const id = setInterval(tick, HOST_HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [partyRoomId, isPartyHost, sendRtcMessage, updatePlaybackState]);

  const handleStartParty = useCallback(async (): Promise<{ roomId: string; joinUrl: string } | null> => {
    if (!user) {
      setShowPartyPanel(true);
      return null;
    }
    try {
      const key = generateRoomKey();
      const contentMeta: PartyContentMeta = {
        tmdbId: movieId,
        mediaType,
        season,
        episode,
        serverIndex: currentServer,
      };
      const encrypted = await encryptPayload(contentMeta, key);
      const id = await createPartyRoom(encrypted, contentMeta);
      clearPartyLeftMark(id);
      setPartyRoomId(id);
      setPartyRoomKey(key);
      setShowInviteDialog(true);
      setShowPartyPanel(isMobileViewport() ? false : true);
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
    const leavingId = partyRoomId;
    if (leavingId) markPartyLeft(leavingId);
    void leavePartyRoom();
    setPartyRoomId(null);
    setPartyRoomKey(null);
    setShowInviteDialog(false);
    setShowPartyPanel(false);
    setGuestServerIndex(null);
    wasInPartyRef.current = false;
    absentPollCountRef.current = 0;
    partyJoinTimeRef.current = null;
    guestRedirectAttempted.current = false;
    guestServerAppliedRef.current = false;
    initialSyncDoneRef.current = false;
    setGuestInitialSynced(false);
    setGuestSplashDismissed(false);
    partyJoinAttempted.current = true;
    replaceUrlWithoutPartyParams();
    clearGuestJoinSession();
  }, [leavePartyRoom, partyRoomId]);

  /** Allow opening party panel / starting a new party after leaving. */
  const resetPartySession = useCallback(() => {
    partyJoinAttempted.current = false;
    guestRedirectAttempted.current = false;
    guestServerAppliedRef.current = false;
    initialSyncDoneRef.current = false;
    setGuestInitialSynced(false);
  }, []);

  // Party ended (host left / room deleted)
  useEffect(() => {
    if (!partyRoomId || partyLoading) return;
    if (partyRoom) return;
    if (!wasInPartyRef.current) return;

    setPartyRoomId(null);
    setPartyRoomKey(null);
    setShowInviteDialog(false);
    setGuestServerIndex(null);
    wasInPartyRef.current = false;
    absentPollCountRef.current = 0;
    partyJoinTimeRef.current = null;
    guestRedirectAttempted.current = false;
    guestServerAppliedRef.current = false;
    initialSyncDoneRef.current = false;
    setShowPartyPanel(false);
    if (partyRoomId) markPartyLeft(partyRoomId);
    replaceUrlWithoutPartyParams();
  }, [partyRoom, partyRoomId, partyLoading]);

  // Guest was kicked — no longer in participant list (requires 2+ consecutive absent polls)
  useEffect(() => {
    if (!partyRoomId || !user || !partyRoom) return;
    const inRoom = partyRoom.participants.some((p) => p.userId === user.uid);
    if (inRoom) {
      wasInPartyRef.current = true;
      absentPollCountRef.current = 0;
    } else if (wasInPartyRef.current) {
      absentPollCountRef.current += 1;
      if (absentPollCountRef.current >= 2) {
        handleLeaveParty();
        setShowPartyPanel(false);
      }
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
    resetPartySession,
    broadcastPartyState,
    partyJoinUrl,
    partyRoomCode: partyRoom?.code || (partyRoomId ? partyRoomId.slice(0, 6).toUpperCase() : ""),
    partyMessages,
    sendPartyMessage,
    kickParticipant,
    setParticipantMicMuted,
    setParticipantCamDisabled,
    media,
    guestServerIndex,
    guestSplashPhase,
    guestSplashVisible,
    guestJoinHostName: guestJoinSession?.hostName,
  };
}
