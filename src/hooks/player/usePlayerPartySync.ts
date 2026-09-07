import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useFlixParty } from "@/hooks/player/useFlixParty";
import { useWebRTCSync, type SyncMessage } from "@/hooks/player/useWebRTCSync";
import { usePartyRealtime, type PartyRealtimeEvent } from "@/hooks/player/usePartyRealtime";
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
import { computeResync, injectSeekParam } from "@/lib/player/embedSeekUrls";
import { NTPClient } from "@/lib/player/ntpClockSync";

const JOIN_GRACE_MS = 5000;
const SYNC_INTERVAL_MS = 250;
// Drift threshold for postMessage seek attempt (fast, best-effort)
const DRIFT_SOFT_THRESHOLD_SEC = 0.5;
const SEEK_COOLDOWN_MS = 600;
const MAX_GUEST_SPLASH_MS = 14_000;
const HOST_HEARTBEAT_MS = 800;
const FIRESTORE_PERSIST_INTERVAL_MS = 4000;
// Lead time for a joint start: both sides seek first, then play at the
// shared wall-clock moment so network jitter doesn't stagger the start.
const SYNC_STAGE_LEAD_MS = 1500;
// Auto-release a stage after this long so a staged hold can never trap the
// party if the host walks away. The host pressing pause/play or scrubbing
// cancels it sooner.
const SYNC_AUTO_RELEASE_MS = 5000;
// A host signal newer than this means the event channel is live, even when
// the WebRTC data channel never opens (no TURN / strict NAT) and the
// provider iframe never emits PLAYER_EVENTs (cross-origin direct embeds).
const SIGNAL_FRESH_MS = 6000;
// Guest fallback: if the provider never reports playback (no PLAYER_EVENT
// within this window after the first host position arrives), reload the
// iframe once at the host position via the provider seek param (?t=,
// ?progress=, …). Soft postMessage seeks are best-effort guesses that
// silent providers ignore — a positioned reload always works.
const FALLBACK_SYNC_AFTER_MS = 10_000;
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
  currentSourceUrl,
  currentSourceProviderUrl,
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
  const [resyncSeekUrl, setResyncSeekUrl] = useState<string | null>(null);
  // Last wall-clock time a host signal (event or heartbeat, either
  // transport) was applied. Drives the freshness-based "connected" status
  // so guests don't sit on "Connecting" forever when WebRTC can't open.
  const [lastSignalAt, setLastSignalAt] = useState(0);
  // Synced Start — staged simultaneous playback (see block below).
  // Host holds `syncStage`; guests hold `staging`. Both clear on release.
  const [syncStage, setSyncStage] = useState<{ targetTime: number; releaseAt: number } | null>(null);
  const [staging, setStaging] = useState<{ targetTime: number; releaseAt: number } | null>(null);
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
  // First wall-clock time a host position (>0) arrived for this guest. Used
  // to trigger the fallback hard-sync when the provider stays silent.
  const firstHostTimeAtRef = useRef(0);
  const fallbackHardSyncDoneRef = useRef(false);
  const lastSignalAtRef = useRef(0);
  // Synced Start cursors (mirrors of the states above for interval/timer use).
  const syncStageRef = useRef<{ targetTime: number; releaseAt: number } | null>(null);
  const stagingRef = useRef<{ targetTime: number; releaseAt: number } | null>(null);
  const autoReleaseTimerRef = useRef(0);
  const scheduledGoTimerRef = useRef(0);
  const prevParticipantCountRef = useRef(0);

  // Fresh room → fresh signal cursors.
  useEffect(() => {
    firstHostTimeAtRef.current = 0;
    fallbackHardSyncDoneRef.current = false;
    lastSignalAtRef.current = 0;
    setLastSignalAt(0);
    window.clearTimeout(autoReleaseTimerRef.current);
    autoReleaseTimerRef.current = 0;
    window.clearTimeout(scheduledGoTimerRef.current);
    scheduledGoTimerRef.current = 0;
    setSyncStage(null);
    setStaging(null);
  }, [partyRoomId]);

  currentTimeRef.current = currentTime;
  isPlayingRef.current = isPlaying;
  embedReadyRef.current = embedReady;
  embedLiveSyncedRef.current = embedLiveSynced;
  syncStageRef.current = syncStage;
  stagingRef.current = staging;

  // Stable handles to the embed controls for callbacks defined before/after
  // them in this hook — always call the latest prop without re-subscribing.
  const playEmbedRef = useRef(playEmbed);
  playEmbedRef.current = playEmbed;
  const pauseEmbedRef = useRef(pauseEmbed);
  pauseEmbedRef.current = pauseEmbed;
  const setPlayingRef = useRef(setPlaying);
  setPlayingRef.current = setPlaying;
  const providerUrlRef = useRef(currentSourceProviderUrl);
  providerUrlRef.current = currentSourceProviderUrl;

  // Clears any staged hold on this guest (plain play/pause/seek wins over
  // a stage; a new stage re-arms it). Stable + dependency-free so every
  // sync path can call it.
  const clearGuestStaging = useCallback(() => {
    window.clearTimeout(scheduledGoTimerRef.current);
    scheduledGoTimerRef.current = 0;
    setStaging(null);
  }, []);

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

  // Rate-limited seek: prevents flooding the iframe with seek commands from
  // rapid heartbeats or multiple drift-correction triggers firing close together.
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

  // Keep a stable ref so handlePartyPlaybackSync can always call the latest
  // softSeekTo without needing to re-subscribe the WebRTC listener every time.
  const softSeekToRef = useRef(softSeekTo);
  softSeekToRef.current = softSeekTo;

  // Guest side of `sync-stage`: hold paused at the host timestamp. No tap
  // needed — nothing for provider ad scripts to hijack. Silent providers
  // get one positioned reload so they actually land on T.
  const handleGuestStage = useCallback((targetTime: number, releaseAt: number) => {
    window.clearTimeout(scheduledGoTimerRef.current);
    scheduledGoTimerRef.current = 0;
    setStaging({ targetTime, releaseAt });
    setPlayingRef.current(false);
    pauseEmbedRef.current();
    softSeekToRef.current(targetTime);
    if (!embedLiveSyncedRef.current) {
      setResyncSeekUrl(injectSeekParam(providerUrlRef.current, targetTime));
    }
  }, []);

  // Guest side of `sync-go`: seek to T, then play at the shared wall-clock
  // moment so both sides start the same frame together.
  const handleGuestGo = useCallback((targetTime: number, startAt: number) => {
    window.clearTimeout(scheduledGoTimerRef.current);
    scheduledGoTimerRef.current = 0;
    setStaging(null);
    softSeekToRef.current(targetTime);
    initialSyncDoneRef.current = true;
    setGuestInitialSynced(true);
    const delay = startAt > 0 ? startAt - NTPClient.now() : 0;
    if (delay <= 0) {
      setPlayingRef.current(true);
      playEmbedRef.current();
      return;
    }
    setPlayingRef.current(false);
    pauseEmbedRef.current();
    scheduledGoTimerRef.current = window.setTimeout(() => {
      scheduledGoTimerRef.current = 0;
      lastSeekAtRef.current = 0;
      setPlayingRef.current(true);
      playEmbedRef.current();
    }, delay);
  }, []);

  const handlePartyPlaybackSync = useCallback(
    (msg: SyncMessage) => {
      if (isPartyHost) return;
      if (msg.type === "play") {
        clearGuestStaging();
        setPlaying(true);
        playEmbed();
        // Snap to host position so there's no drift at play-start
        if (typeof msg.data.currentTime === "number" && msg.data.currentTime > 0) {
          softSeekToRef.current(msg.data.currentTime);
        }
      }
      if (msg.type === "pause") {
        clearGuestStaging();
        setPlaying(false);
        pauseEmbed();
        // Snap to exact host frame on pause so both sides land together
        if (typeof msg.data.currentTime === "number") {
          softSeekToRef.current(msg.data.currentTime);
        }
      }
      if (msg.type === "seek" && typeof msg.data.currentTime === "number") {
        clearGuestStaging();
        // Rate-limited so rapid scrubber drags don't flood the iframe
        softSeekToRef.current(msg.data.currentTime);
      }
      if (msg.type === "heartbeat" && typeof msg.data.currentTime === "number") {
        hostTimeRef.current = msg.data.currentTime;
        if (!embedReadyRef.current) return;
        // Respect join grace period — don't correct while the iframe is still loading
        if (partyJoinTimeRef.current && Date.now() - partyJoinTimeRef.current < JOIN_GRACE_MS) return;
        const hostTime = msg.data.currentTime;
        if (currentTimeRef.current === 0 && hostTime > 10) return;
        const drift = Math.abs(currentTimeRef.current - hostTime);
        if (drift > DRIFT_SOFT_THRESHOLD_SEC) {
          softSeekToRef.current(hostTime);
        }
      }
    },
      // All mutable state is accessed via refs; only stable callbacks in deps.
    [isPartyHost, setPlaying, playEmbed, pauseEmbed, clearGuestStaging]
  );

  const { isConnected: rtcConnected, sendMessage: sendRtcMessage, setLocalStream } = useWebRTCSync({
    roomId: partyRoomId,
    isHost: !!isPartyHost,
    hostId: partyRoom?.hostId ?? null,
    participantIds: partyParticipantIds,
    onPlaybackSync: (msg) => {
      noteGuestSignal(
        (msg as { data?: { currentTime?: unknown } })?.data?.currentTime
      );
      handlePartyPlaybackSync(msg);
    },
    onRemoteStream: (peerId, stream) => onRemoteStreamRef.current(peerId, stream),
    onRemoteStreamRemoved: (peerId) => onRemoteStreamRemovedRef.current(peerId),
  });

  // Records every host signal landing on this guest (both transports).
  // Also stamps the first host position so the fallback hard-sync knows
  // how long the provider has been silent.
  const noteGuestSignal = useCallback((hostTime: unknown) => {
    const now = Date.now();
    lastSignalAtRef.current = now;
    setLastSignalAt(now);
    if (typeof hostTime === "number" && hostTime > 0 && !firstHostTimeAtRef.current) {
      firstHostTimeAtRef.current = now;
    }
  }, []);

  // Self-hosted real-time transport — same handler as WebRTC, so any
  // delivery path (Firestore events or WebRTC data channel) lands the
  // guest in the same state machine.
  const realtime = usePartyRealtime({
    roomId: partyRoomId,
    isHost: !!isPartyHost,
    onEvent: (ev) => {
      if (isPartyHost) return;
      noteGuestSignal(ev.data?.currentTime);
      if (ev.type === "sync-stage" && typeof ev.data?.currentTime === "number") {
        handleGuestStage(
          ev.data.currentTime,
          typeof ev.data?.releaseAt === "number" ? ev.data.releaseAt : 0
        );
        return;
      }
      if (ev.type === "sync-go" && typeof ev.data?.currentTime === "number") {
        handleGuestGo(
          ev.data.currentTime,
          typeof ev.data?.startAt === "number" ? ev.data.startAt : 0
        );
        return;
      }
      handlePartyPlaybackSync({
        type: ev.type as SyncMessage["type"],
        timestamp: ev.ts,
        data: ev.data,
      });
    },
    onHeartbeat: (ev) => {
      if (isPartyHost) return;
      noteGuestSignal(ev.data?.currentTime);
      // The host re-asserts the staged hold on every heartbeat, so a guest
      // that missed the stage event (or joined mid-stage) still holds —
      // and a cancelled stage clears promptly instead of sticking.
      const staged = ev.data?.staged;
      const stageTime = ev.data?.stageTime;
      if (staged === true && typeof stageTime === "number") {
        const cur = stagingRef.current;
        if (!cur || cur.targetTime !== stageTime) {
          window.clearTimeout(scheduledGoTimerRef.current);
          scheduledGoTimerRef.current = 0;
          setStaging({ targetTime: stageTime, releaseAt: cur?.releaseAt ?? 0 });
        }
      } else if (staged === false && stagingRef.current) {
        clearGuestStaging();
      }
      handlePartyPlaybackSync({
        type: "heartbeat",
        timestamp: ev.ts,
        data: ev.data,
      });
    },
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

  // Guest: periodic drift sync loop
  useEffect(() => {
    if (!partyRoomId || isPartyHost) return;

    const tick = () => {
      if (!embedReadyRef.current) return;
      if (partyJoinTimeRef.current && Date.now() - partyJoinTimeRef.current < JOIN_GRACE_MS) return;

      const guestTime = currentTimeRef.current;
      const hostTime = Math.max(partyHostTimeRef.current, hostTimeRef.current);

      // Fallback initial sync: the provider never reported playback
      // (no PLAYER_EVENT — silent cross-origin embed) but host positions
      // have been arriving for a while. Reload the iframe once AT the host
      // position via the provider seek param — the only mechanism silent
      // providers honor — and consider the guest synced.
      if (
        !initialSyncDoneRef.current &&
        !embedLiveSyncedRef.current &&
        !fallbackHardSyncDoneRef.current &&
        hostTime > 0 &&
        firstHostTimeAtRef.current > 0 &&
        Date.now() - firstHostTimeAtRef.current >= FALLBACK_SYNC_AFTER_MS
      ) {
        fallbackHardSyncDoneRef.current = true;
        initialSyncDoneRef.current = true;
        setGuestInitialSynced(true);
        lastSeekAtRef.current = 0;
        setResyncSeekUrl(injectSeekParam(sourceUrlRef.current, hostTime));
        setPartySyncStatus("resyncing");
        return;
      }

      if (!embedLiveSyncedRef.current && guestTime === 0 && hostTime > 5) return;
      if (guestTime === 0 && hostTime > 10) return;

      // Staged hold: stay paused exactly on the stage timestamp. Never
      // chase drift mid-stage — the joint `sync-go` release does the
      // precise alignment for both sides at once.
      const stagedHold = stagingRef.current;
      if (stagedHold) {
        if (isPlayingRef.current) {
          setPlaying(false);
          pauseEmbed();
        }
        softSeekTo(stagedHold.targetTime);
        setPartyDriftMs(Math.abs(currentTimeRef.current - stagedHold.targetTime) * 1000);
        setPartySyncStatus("staging");
        return;
      }

       const driftSec = Math.abs(guestTime - hostTime);
       setPartyDriftMs(driftSec * 1000);

       // Enforce play/pause state
       if (partyPlaybackRef.current === "playing" && !isPlayingRef.current) {
         setPlaying(true);
         playEmbed();
       } else if (partyPlaybackRef.current === "paused" && isPlayingRef.current) {
         setPlaying(false);
         pauseEmbed();
       }

       // Hard resync check (>30s drift) — rebuild URL with corrected start time
       const resync = computeResync(hostTime, guestTime, sourceUrlRef.current, String(currentServer));
       if (resync.kind === "hard") {
         setResyncSeekUrl(resync.seekUrl);
         setPartySyncStatus("drift");
       } else if (driftSec >= DRIFT_SOFT_THRESHOLD_SEC) {
         softSeekTo(hostTime);
         setPartySyncStatus("drift");
       } else {
         const fresh = Date.now() - lastSignalAtRef.current < SIGNAL_FRESH_MS;
         setPartySyncStatus(rtcConnected || guestInitialSynced || fresh ? "connected" : "connecting");
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
     currentServer,
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
    } else if (!isPartyHost && staging) {
      setPartySyncStatus("staging");
    } else if (!isPartyHost && Date.now() - lastSignalAt < SIGNAL_FRESH_MS) {
      // Host signals are arriving over the event channel — the party is
      // live even though the WebRTC data channel never opened (no TURN /
      // strict NAT) and the provider iframe stays silent.
      setPartySyncStatus("connected");
    } else if (partyRoom) {
      setPartySyncStatus("connecting");
    }
  }, [partyRoomId, rtcConnected, partyRoom, isPartyHost, guestInitialSynced, staging, lastSignalAt]);

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

  /**
   * Synced Start — host controls. Pause everyone at the host timestamp,
   * hold, then release both sides at the same wall-clock moment so the
   * guest never taps anything (no ad popups) and both land on the exact
   * same frame.
   */
  const cancelSyncedStart = useCallback(() => {
    window.clearTimeout(autoReleaseTimerRef.current);
    autoReleaseTimerRef.current = 0;
    window.clearTimeout(scheduledGoTimerRef.current);
    scheduledGoTimerRef.current = 0;
    setSyncStage(null);
  }, []);

  const releaseSyncedStart = useCallback(() => {
    if (!partyRoomId || !isPartyHost) return;
    const st = syncStageRef.current;
    if (!st) return;
    window.clearTimeout(autoReleaseTimerRef.current);
    autoReleaseTimerRef.current = 0;
    const T = st.targetTime;
    // Undo PlayerShell's optimistic toggle: re-pause locally, snap to T,
    // then play exactly at the shared start moment alongside the guests.
    setPlaying(false);
    pauseEmbed();
    softSeekToRef.current(T);
    const startAt = NTPClient.now() + SYNC_STAGE_LEAD_MS;
    setSyncStage(null);
    void updatePlaybackState("paused", T, currentServer);
    void realtime.send("sync-go", { currentTime: T, startAt });
    scheduledGoTimerRef.current = window.setTimeout(() => {
      scheduledGoTimerRef.current = 0;
      setPlaying(true);
      playEmbed();
    }, Math.max(0, startAt - NTPClient.now()));
  }, [partyRoomId, isPartyHost, setPlaying, pauseEmbed, playEmbed, updatePlaybackState, currentServer, realtime.send]);

  const startSyncedStart = useCallback(() => {
    if (!partyRoomId || !isPartyHost || !user) return;
    window.clearTimeout(autoReleaseTimerRef.current);
    window.clearTimeout(scheduledGoTimerRef.current);
    scheduledGoTimerRef.current = 0;
    const T = Math.max(0, Math.floor(partyTimeRef.current));
    setPlaying(false);
    pauseEmbed();
    const releaseAt = NTPClient.now() + SYNC_AUTO_RELEASE_MS;
    setSyncStage({ targetTime: T, releaseAt });
    void updatePlaybackState("paused", T, currentServer);
    void realtime.send("sync-stage", { currentTime: T, releaseAt });
    autoReleaseTimerRef.current = window.setTimeout(() => {
      releaseSyncedStart();
    }, SYNC_AUTO_RELEASE_MS);
  }, [partyRoomId, isPartyHost, user, setPlaying, pauseEmbed, updatePlaybackState, currentServer, realtime.send, releaseSyncedStart]);

  // Host: a guest just joined → pause at the current position and hold
  // everyone there until the host releases. Nobody taps anything, so no
  // provider popups fire on either side.
  useEffect(() => {
    if (!partyRoomId || !isPartyHost) {
      prevParticipantCountRef.current = 0;
      return;
    }
    const count = partyRoom?.participants?.length ?? 0;
    const prev = prevParticipantCountRef.current;
    prevParticipantCountRef.current = count;
    if (prev === 0) return; // baseline (room creation / first load)
    if (count > prev && !syncStageRef.current) startSyncedStart();
  }, [partyRoomId, isPartyHost, partyRoom?.participants?.length, partyRoom, startSyncedStart]);

  const broadcastPartyState = useCallback(
    (state: "playing" | "paused", time: number) => {
      if (!partyRoomId || !isPartyHost) return;
      // Staged hold: the host pressing play releases BOTH sides together
      // at the shared start moment instead of starting the host early.
      if (state === "playing" && syncStageRef.current) {
        releaseSyncedStart();
        return;
      }
      // Any explicit pause/scrub intent while staged cancels the hold; the
      // plain event below clears every guest's banner.
      if (syncStageRef.current) cancelSyncedStart();
      // Write authoritative state to Firestore immediately on explicit play/pause
      void updatePlaybackState(state, time, currentServer);
      // Send the real-time message through the self-hosted realtime transport
      void realtime.send(state === "playing" ? "play" : "pause", { currentTime: time });
      // Also send via WebRTC data channel so connected peers get the message
      // even if the realtime listener hasn't replayed yet.
      sendRtcMessage(state === "playing" ? "play" : "pause", { currentTime: time });
    },
    [partyRoomId, isPartyHost, updatePlaybackState, realtime.send, sendRtcMessage, currentServer, releaseSyncedStart, cancelSyncedStart]
  );

  /**
   * Broadcast an explicit seek to all guests.
   * Called by the host whenever the playhead jumps (keyboard shortcuts,
   * progress-bar click, 0-9 number keys, etc.).
   */
  const broadcastPartySeek = useCallback(
    (time: number) => {
      if (!partyRoomId || !isPartyHost) return;
      if (syncStageRef.current) cancelSyncedStart();
      // Persist to Firestore so late-joining guests get the right position
      void updatePlaybackState(partyPlayingRef.current ? "playing" : "paused", time, currentServer);
      // Instant delivery through the realtime transport
      void realtime.send("seek", { currentTime: time });
      // Belt-and-braces: also send via WebRTC
      sendRtcMessage("seek", { currentTime: time });
    },
    [partyRoomId, isPartyHost, updatePlaybackState, realtime.send, sendRtcMessage, currentServer, cancelSyncedStart]
  );

  const partyTimeRef = useRef(currentTime);
  const partyPlayingRef = useRef(isPlaying);
  const partyServerRef = useRef(currentServer);
  partyTimeRef.current = currentTime;
  partyPlayingRef.current = isPlaying;
  partyServerRef.current = currentServer;
  const sourceUrlRef = useRef(currentSourceProviderUrl);
  sourceUrlRef.current = currentSourceProviderUrl;

  // Host: fast realtime heartbeats (800 ms) so guests correct drift quickly.
  // Firestore writes happen at a much lower cadence (4 s) to avoid rate limits.
  useEffect(() => {
    if (!partyRoomId || !isPartyHost) return;

    let firestoreTimer = 0;

    const tick = () => {
      const time = partyTimeRef.current;
      const playing = partyPlayingRef.current;
      const server = partyServerRef.current;

      // Always send a lightweight heartbeat through the realtime transport.
      // Both the realtime channel and the WebRTC data channel get it — whichever
      // delivers first wins, and the other is a free redundancy boost.
      // The staged hold rides along so guests that missed the stage event
      // (or joined mid-stage) still hold instead of drifting.
      const stage = syncStageRef.current;
      void realtime.send("heartbeat", {
        currentTime: time,
        staged: stage !== null,
        stageTime: stage?.targetTime ?? 0,
      });
      sendRtcMessage("heartbeat", { currentTime: time });

      // Throttle the heavier Firestore write
      firestoreTimer += HOST_HEARTBEAT_MS;
      if (firestoreTimer >= FIRESTORE_PERSIST_INTERVAL_MS) {
        firestoreTimer = 0;
        void updatePlaybackState(playing ? "playing" : "paused", time, server);
      }
    };

    // Immediate first tick + persist so guests have a value right away
    tick();
    void updatePlaybackState(
      partyPlayingRef.current ? "playing" : "paused",
      partyTimeRef.current,
      partyServerRef.current
    );
    firestoreTimer = 0; // reset after the forced initial write

    const id = setInterval(tick, HOST_HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [partyRoomId, isPartyHost, realtime.send, sendRtcMessage, updatePlaybackState]);

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
    setSyncStage(null);
    setStaging(null);
    setLastSignalAt(0);
    window.clearTimeout(autoReleaseTimerRef.current);
    autoReleaseTimerRef.current = 0;
    window.clearTimeout(scheduledGoTimerRef.current);
    scheduledGoTimerRef.current = 0;
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
    broadcastPartySeek,
    syncStage,
    staging,
    startSyncedStart,
    releaseSyncedStart,
    cancelSyncedStart,
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
    resyncSeekUrl,
    setResyncSeekUrl,
    realtime: {
      processed: realtime.processed,
      isReady: realtime.isReady,
    },
  };
}
