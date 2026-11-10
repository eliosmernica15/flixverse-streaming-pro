import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useFlixParty } from "@/hooks/player/useFlixParty";
import { useWebRTCSync, type SyncMessage } from "@/hooks/player/useWebRTCSync";
import { usePartyRealtime } from "@/hooks/player/usePartyRealtime";
import {
  encryptPayload,
  generateRoomKey,
  isRoomEncryptionRotationDue,
  buildPartyJoinUrl,
  buildPartyPlayerUrl,
  partyContentMatches,
  resolvePartyContent,
  extractRoomKeyFromHash,
  type PartyContentMeta,
} from "@/lib/player/roomEncryption";
import type { SyncStatus } from "@/components/player/SyncStatusBadge";
import type { GuestSplashPhase } from "@/components/player/PartyGuestSplash";
import {
  trackGuestJoinSynced,
  trackPartyJoin,
  trackDriftSnap,
  trackPartyReconnect,
  breadcrumbDriftSnap,
  breadcrumbReconnect,
  breadcrumbStageHold,
  breadcrumbQualityChange,
  breadcrumbServerSwitch,
  breadcrumbSyncFail,
} from "@/lib/analytics";
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
import { useNetworkQuality, type NetworkQuality } from "@/hooks/useNetworkQuality";
import { pickServerByQuality, type StreamingSource } from "@/lib/streamingSources";

const JOIN_GRACE_MS = 5000;
const SYNC_INTERVAL_MS = 250;
// Drift threshold for postMessage seek attempt (fast, best-effort)
const DRIFT_SOFT_THRESHOLD_SEC = 0.5;
const SEEK_COOLDOWN_MS = 600;
const MAX_GUEST_SPLASH_MS = 14_000;
// Host heartbeat cadence. 4500ms (4.5s) reduces Firestore writes to
// ~0.22 writes/sec per host while still keeping drift correction within
// the 0.5s soft threshold (room poll ~1s, heartbeat extrapolation covers
// the gap). Combined with the realtime channel's sub-second delivery,
// guests stay synced without the write load.
const HOST_HEARTBEAT_MS = 4500;
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
// Minimum gap between iframe rebuilds for a hard resync. A rebuild is a full
// provider reload (~2–5 s of black frame); doing it more than once every
// 20 s is never better than waiting for the soft seek path to converge.
const HARD_RESYNC_COOLDOWN_MS = 20_000;
// Consecutive soft seeks (600 ms apart) that may fail to close the drift
// before we stop trusting postMessage and rebuild the iframe instead.
const MAX_FAILED_SOFT_SEEKS = 4;
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
  /** Streaming sources for quality-based server selection */
  streamingSources?: StreamingSource[];
  /** Enable automatic quality downgrade on network degradation (default: true) */
  autoQualityDowngrade?: boolean;
  /** Callback when quality changes (for UI indicator) */
  onQualityChange?: (quality: NetworkQuality, previousQuality: NetworkQuality) => void;
}

export function usePlayerPartySync({
  movieId,
  mediaType,
  season,
  episode,
  currentServer,
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
  streamingSources = [],
  autoQualityDowngrade = true,
  onQualityChange,
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
  // Mirror for the sync interval: the tick is recreated whenever its deps
  // change, but it must always read the *current* synced flag rather than
  // the one captured when the interval was created.
  const guestInitialSyncedRef = useRef(false);
  guestInitialSyncedRef.current = guestInitialSynced;
  const [guestSplashDismissed, setGuestSplashDismissed] = useState(false);
  // Network quality state for ABR downgrade
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>("high");
  const [previousNetworkQuality, setPreviousNetworkQuality] = useState<NetworkQuality>("high");
  const [showQualityIndicator, setShowQualityIndicator] = useState(false);
  const [qualityIndicatorMessage, setQualityIndicatorMessage] = useState("");
  const qualityChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Refs for values used in quality change effect before they're declared
  const isPartyHostRef = useRef(false);
  const broadcastServerChangeRef = useRef<typeof broadcastServerChange | null>(null);

  // Network quality monitoring for ABR downgrade
  const detectedQuality = useNetworkQuality();

  // Track quality changes and trigger server downgrade
  useEffect(() => {
    if (!autoQualityDowngrade) return;
    if (detectedQuality === previousNetworkQuality) return;

    const previous = previousNetworkQuality;
    const current = detectedQuality;

    // Only act on degradation (not improvement) to avoid flapping
    const qualityRank = { high: 3, medium: 2, low: 1 };
    if (qualityRank[current] >= qualityRank[previous]) {
      // Quality improved or stayed same - just update state
      setNetworkQuality(current);
      setPreviousNetworkQuality(current);
      onQualityChange?.(current, previous);
      return;
    }

    // Quality degraded - trigger downgrade
    setNetworkQuality(current);
    setPreviousNetworkQuality(current);

    // Track quality change for analytics
    if (partyRoomId) {
      breadcrumbQualityChange(partyRoomId, previous, current);
    }

    // Show quality change indicator
    const qualityLabels: Record<NetworkQuality, string> = {
      high: "4K",
      medium: "1080p",
      low: "720p",
    };
    const message = `Network quality dropped — switching to ${qualityLabels[current]} quality`;
    setQualityIndicatorMessage(message);
    setShowQualityIndicator(true);

    // Clear indicator after 5 seconds
    if (qualityChangeTimeoutRef.current) {
      clearTimeout(qualityChangeTimeoutRef.current);
    }
    qualityChangeTimeoutRef.current = setTimeout(() => {
      setShowQualityIndicator(false);
    }, 5000);

    // Determine target quality label for server selection
    // "4K" allows 4K sources (falls back to FHD if unavailable)
    // "1080p" picks FHD
    // "HD" picks HD (720p)
    const targetQualityLabel = current === "low" ? "HD" : current === "medium" ? "1080p" : "4K";

    // Use pickServerByQuality to find the best server for the new quality
    if (streamingSources.length > 0) {
      const newServerIndex = pickServerByQuality(streamingSources, targetQualityLabel, currentServer);
      if (newServerIndex !== currentServer) {
        // Trigger server change
        if (isPartyHostRef.current) {
          broadcastServerChangeRef.current?.(newServerIndex, currentTime);
        } else {
          setGuestServerIndex(newServerIndex);
        }
      }
    }

    onQualityChange?.(current, previous);
  }, [
    detectedQuality,
    previousNetworkQuality,
    autoQualityDowngrade,
    streamingSources,
    currentServer,
    currentTime,
    onQualityChange,
  ]);

  const {
    room: partyRoom,
    messages: partyMessages,
    loading: partyLoading,
    isHost: isPartyHost,
    createRoom: createPartyRoom,
    joinRoomById,
    leaveRoom: leavePartyRoom,
    updatePlaybackState,
    updateEncryptedPayload,
    sendMessage: sendPartyMessage,
    kickParticipant,
    setParticipantMicMuted,
    setParticipantCamDisabled,
    setControlsMode: setControlsModeRoom,
    transferHost,
    pendingQueue: partyPendingQueue,
    suggestToQueue: partySuggestToQueue,
    voteQueueItem: partyVoteQueueItem,
    confirmQueueItem: partyConfirmQueueItem,
    removeQueueItem: partyRemoveQueueItem,
    removeOwnQueueItem: partyRemoveOwnQueueItem,
  } = useFlixParty({ roomId: partyRoomId });

  // Update refs for quality change effect
  isPartyHostRef.current = isPartyHost;

  const partyParticipantIds = partyRoom?.participants?.map((p) => p.userId) ?? [];
  const controlsMode = partyRoom?.controlsMode ?? "HOST_ONLY";
  const isCollaborative = controlsMode === "COLLABORATIVE";

  const onRemoteStreamRef = useRef<(peerId: string, stream: MediaStream) => void>(() => {});
  const onRemoteStreamRemovedRef = useRef<(peerId: string) => void>(() => {});
  const partyJoinAttempted = useRef(false);
  const rotatingEncryptionRef = useRef(false);
  const guestRedirectAttempted = useRef(false);
  const wasInPartyRef = useRef(false);
  const absentPollCountRef = useRef(0);
  const partyJoinTimeRef = useRef<number | null>(null);
  // Track if seek was user-initiated (vs remote sync) to avoid broadcasting remote seeks back
  const isUserSeekRef = useRef(false);
  const lastSeekAtRef = useRef(0);
  // Debounce for user-initiated seeks (400ms) to avoid flooding broadcasts
  const seekDebounceRef = useRef<{ timer: number | null; pendingTime: number | null }>({
    timer: null,
    pendingTime: null,
  });
  const currentTimeRef = useRef(currentTime);
  const isPlayingRef = useRef(isPlaying);
  const hostTimeRef = useRef(0);
  // When `hostTimeRef` was sampled, on the shared NTP timeline. The host
  // only reports every HOST_HEARTBEAT_MS (~1.5 s), so between reports the
  // raw value is stale by up to a full heartbeat. Comparing a live guest
  // clock against a frozen host value makes a correctly-synced guest look
  // 1.5 s behind and triggers a corrective seek on every poll — the
  // "constant micro-stutter / seek loop" symptom. Extrapolating the host
  // position forward from the sample removes that error entirely.
  const hostTimeSampledAtRef = useRef(0);
  const embedReadyRef = useRef(embedReady);
  const embedLiveSyncedRef = useRef(embedLiveSynced);
  const appliedRoomServerRef = useRef(-1);
  const initialSyncDoneRef = useRef(false);
  const partyPlaybackRef = useRef<"playing" | "paused">("paused");
  const partyHostTimeRef = useRef(0);
  // First wall-clock time a host position (>0) arrived for this guest. Used
  // to trigger the fallback hard-sync when the provider stays silent.
  const firstHostTimeAtRef = useRef(0);
  const fallbackHardSyncDoneRef = useRef(false);
  const lastSignalAtRef = useRef(0);
  const lastHardResyncAtRef = useRef(0);
  const failedSeekCountRef = useRef(0);
  // Track previous signal freshness for reconnect detection
  const wasSignalFreshRef = useRef(false);
  // Synced Start cursors (mirrors of the states above for interval/timer use).
  const syncStageRef = useRef<{ targetTime: number; releaseAt: number } | null>(null);
  const stagingRef = useRef<{ targetTime: number; releaseAt: number } | null>(null);
  const autoReleaseTimerRef = useRef(0);
  const scheduledGoTimerRef = useRef(0);
  const prevParticipantCountRef = useRef(0);
  const driftDisplayRef = useRef(0);
  // Latest playback state, mirrored into refs so the interval callbacks and
  // the sync state machine read current values without re-subscribing.
  //
  // These MUST be declared before every callback that closes over them:
  // `noteGuestSignal`, `handlePartyPlaybackSync`, and the heartbeat loop are
  // all referenced from hooks that run during the same render, and a
  // `const` referenced before its declaration throws a temporal-dead-zone
  // ReferenceError. Keeping the whole sync-state block here makes the
  // ordering explicit.
  const partyTimeRef = useRef(currentTime);
  const partyPlayingRef = useRef(isPlaying);
  const partyServerRef = useRef(currentServer);
  const sourceUrlRef = useRef(currentSourceProviderUrl);
  partyTimeRef.current = currentTime;
  partyPlayingRef.current = isPlaying;
  partyServerRef.current = currentServer;
  sourceUrlRef.current = currentSourceProviderUrl;

  // Fresh room → fresh signal cursors.
  useEffect(() => {
    firstHostTimeAtRef.current = 0;
    fallbackHardSyncDoneRef.current = false;
    lastSignalAtRef.current = 0;
    lastHardResyncAtRef.current = 0;
    setLastSignalAt(0);
    window.clearTimeout(autoReleaseTimerRef.current);
    autoReleaseTimerRef.current = 0;
    window.clearTimeout(scheduledGoTimerRef.current);
    scheduledGoTimerRef.current = 0;
    setSyncStage(null);
    setStaging(null);
  }, [partyRoomId]);

  // Cleanup seek debounce timer on unmount
  useEffect(() => {
    const ref = seekDebounceRef.current;
    return () => {
      if (ref.timer) {
        window.clearTimeout(ref.timer);
        ref.timer = null;
        ref.pendingTime = null;
      }
    };
  }, []);

  // Cleanup quality change indicator timeout on unmount
  useEffect(() => {
    return () => {
      if (qualityChangeTimeoutRef.current) {
        window.clearTimeout(qualityChangeTimeoutRef.current);
        qualityChangeTimeoutRef.current = null;
      }
    };
  }, []);

  currentTimeRef.current = currentTime;
  isPlayingRef.current = isPlaying;
  embedReadyRef.current = embedReady;
  embedLiveSyncedRef.current = embedLiveSynced;
  syncStageRef.current = syncStage;
  stagingRef.current = staging;

  /**
   * Host position projected to *now*.
   *
   * `hostTimeRef` holds the position at the moment the last heartbeat was
   * produced. If the room is playing, the host has advanced by the elapsed
   * wall-clock time since then, so add it (bounded — a stale sample after a
   * tab suspension must not extrapolate by minutes).
   */
  const projectedHostTime = useCallback((): number => {
    const base = Math.max(partyHostTimeRef.current, hostTimeRef.current);
    if (base <= 0) return base;
    if (partyPlaybackRef.current !== "playing") return base;
    const sampledAt = hostTimeSampledAtRef.current;
    if (!sampledAt) return base;
    const elapsedSec = (NTPClient.now() - sampledAt) / 1000;
    if (elapsedSec <= 0 || elapsedSec > 10) return base;
    return base + elapsedSec;
  }, []);

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
    // Room-doc polling is a third, independent signal channel (alongside
    // Firestore events and WebRTC): it works even when the events
    // subcollection is unreachable (unpublished rules, quota, offline
    // listener). Stamp guest freshness from it so status, splash, and the
    // silent-provider fallback all engage on polling alone.
    if (!isPartyHost && (partyRoom?.lastKnownTime ?? 0) > 0) {
      const now = Date.now();
      lastSignalAtRef.current = now;
      setLastSignalAt(now);
      if (!firstHostTimeAtRef.current) firstHostTimeAtRef.current = now;
    }
  }, [partyRoom?.playbackState, partyRoom?.lastKnownTime, isPartyHost]);

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

  // Records every host signal landing on this guest (both transports).
  // Also stamps the first host position so the fallback hard-sync knows
  // how long the provider has been silent.
  //
  // Declared before the WebRTC/realtime subscriptions that invoke it: those
  // hooks call their callbacks during render setup, so a later `const`
  // would be in the temporal dead zone and throw.
  const noteGuestSignal = useCallback((hostTime: unknown) => {
    const now = Date.now();
    lastSignalAtRef.current = now;
    setLastSignalAt(now);
    if (typeof hostTime === "number" && hostTime > 0 && !firstHostTimeAtRef.current) {
      firstHostTimeAtRef.current = now;
    }
  }, []);

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
      if (msg.type === "server-change" && typeof msg.data.serverIndex === "number") {
        // Host switched source server mid-party — follow it (bounds-checked
        // where applied). Works over both transports.
        setGuestServerIndex(msg.data.serverIndex);
      }
      if (msg.type === "sync-stage" && typeof msg.data.currentTime === "number") {
        // RTC-delivered stage (events path intercepts earlier with the same
        // call, so this is a no-op duplicate there).
        handleGuestStage(
          msg.data.currentTime,
          typeof msg.data.releaseAt === "number" ? msg.data.releaseAt : 0
        );
      }
      if (msg.type === "sync-go" && typeof msg.data.currentTime === "number") {
        handleGuestGo(
          msg.data.currentTime,
          typeof msg.data.startAt === "number" ? msg.data.startAt : 0
        );
      }
      if (msg.type === "heartbeat" && typeof msg.data.currentTime === "number") {
        hostTimeRef.current = msg.data.currentTime;
        // `timestamp` is the host's NTP-corrected send time, so it already
        // accounts for clock skew — no extra correction needed.
        hostTimeSampledAtRef.current = msg.timestamp || NTPClient.now();
        // Track the host's play/pause state from the heartbeat itself. The
        // room document also carries it, but that updates on the slow
        // Firestore write; the heartbeat is the fastest authoritative
        // signal and keeps the guest from running ahead between persists.
        if (typeof msg.data.playing === "boolean") {
          partyPlaybackRef.current = msg.data.playing ? "playing" : "paused";
        }
        if (!embedReadyRef.current) return;
        // Respect join grace period — don't correct while the iframe is still loading
        if (partyJoinTimeRef.current && Date.now() - partyJoinTimeRef.current < JOIN_GRACE_MS) return;
        const hostTime = projectedHostTime();
        if (currentTimeRef.current === 0 && hostTime > 10) return;
        const drift = Math.abs(currentTimeRef.current - hostTime);
        if (drift > DRIFT_SOFT_THRESHOLD_SEC) {
          softSeekToRef.current(hostTime);
        }
      }
    },
      // All mutable state is accessed via refs; only stable callbacks in deps.
    [isPartyHost, setPlaying, playEmbed, pauseEmbed, clearGuestStaging, handleGuestStage, handleGuestGo, projectedHostTime]
  );

  const [webRTCMuteAll, setWebRTCMuteAll] = useState(false);

  const { isConnected: rtcConnected, sendMessage: sendRtcMessage, sendMuteAll, setLocalStream } = useWebRTCSync({
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
    onMuteAll: () => {
      // Only guests (non-host) should mute when receiving the command
      if (!isPartyHost) {
        setWebRTCMuteAll(true);
      }
    },
  });

  // Self-hosted real-time transport — same handler as WebRTC, so any
  // delivery path (Firestore events or WebRTC data channel) lands the
  // guest in the same state machine.
  const realtime = usePartyRealtime({
    roomId: partyRoomId,
    isHost: !!isPartyHost,
    controlsMode,
    onEvent: (ev) => {
      // Collaborative controls (F9): a guest requested a playback action.
      // The host is the only writer of authoritative state, so it applies
      // the request and re-broadcasts to everyone (including the requester).
      if (isPartyHost) {
        if (ev.type === "guest-control" && ev.senderId !== user?.uid) {
          const action = ev.data?.action;
          const t = typeof ev.data?.currentTime === "number" ? ev.data.currentTime : undefined;
          if (action === "play") {
            broadcastPartyState("playing", t ?? partyTimeRef.current);
          } else if (action === "pause") {
            broadcastPartyState("paused", t ?? partyTimeRef.current);
          } else if (action === "seek" && typeof t === "number") {
            broadcastPartySeek(t);
          } else if (action === "server-change" && typeof ev.data?.serverIndex === "number") {
            broadcastServerChange(ev.data.serverIndex, t ?? partyTimeRef.current);
          }
        }
        return;
      }
      // Guest-control is a request for the host, never an authoritative
      // playback event for other guests.
      if (ev.type === "guest-control") return;
      // Binge sync: host advances to the next episode; guests navigate.
      if (ev.type === "next-episode" && ev.data) {
        const nextSeason = typeof ev.data.season === "number" ? ev.data.season : season;
        const nextEpisode = typeof ev.data.episode === "number" ? ev.data.episode : episode;
        if (mediaType === "tv" && nextSeason !== undefined && nextEpisode !== undefined) {
          // NTP-corrected transition: wait until the shared transition time if provided
          const transitionAt = typeof ev.data.transitionAt === "number" ? ev.data.transitionAt : 0;
          if (transitionAt > 0) {
            const delay = transitionAt - NTPClient.now();
            if (delay > 0 && delay < 5000) {
              // Small delay - wait for precise synchronized transition
              setTimeout(() => {
                window.location.href = `/movie/${movieId}?type=tv&season=${nextSeason}&episode=${nextEpisode}&autoplay=true&party=${partyRoomId}`;
              }, delay);
            } else {
              // Transition time has passed or is too far in future - navigate immediately
              window.location.href = `/movie/${movieId}?type=tv&season=${nextSeason}&episode=${nextEpisode}&autoplay=true&party=${partyRoomId}`;
            }
          } else {
            // No NTP time provided - navigate immediately (backward compatibility)
            window.location.href = `/movie/${movieId}?type=tv&season=${nextSeason}&episode=${nextEpisode}&autoplay=true&party=${partyRoomId}`;
          }
        }
        return;
      }
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

  // `usePartyRealtime` returns a fresh object each render (it memoizes, but
  // `processed` ticks up constantly). Destructure the stable `send` so the
  // host heartbeats and broadcast callbacks do not re-subscribe — every
  // re-subscription tears down the interval and re-writes the room doc.
  const realtimeSend = realtime.send;

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
    webRTCMuteAll: webRTCMuteAll && !isPartyHost, // Only apply to guests, not host
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
        if (appliedRoomServerRef.current !== serverIdx) {
          appliedRoomServerRef.current = serverIdx;
          setGuestServerIndex(serverIdx);
        }
        return;
      }

      guestRedirectAttempted.current = true;
      router.replace(buildPartyPlayerUrl(partyRoomId, content));
    })();
  }, [partyRoomId, isPartyHost, partyRoom, movieId, mediaType, season, episode, router]);

  // Guest: follow the host server index — including mid-party switches,
  // not just the first apply.
  useEffect(() => {
    if (isPartyHost || !partyRoom) return;
    const serverIdx = partyRoom.serverIndex ?? partyRoom.contentMeta?.serverIndex ?? 0;
    if (appliedRoomServerRef.current === serverIdx) return;
    appliedRoomServerRef.current = serverIdx;
    setGuestServerIndex(serverIdx);
  }, [isPartyHost, partyRoom]);

  // Guest: periodic drift sync loop
  useEffect(() => {
    if (!partyRoomId || isPartyHost) return;

    const tick = () => {
      // Background tab: skip all sync work (no seeks, no renders). The next
      // foreground tick re-aligns from the host position.
      if (typeof document !== "undefined" && document.hidden) return;
      if (!embedReadyRef.current) return;
      if (partyJoinTimeRef.current && Date.now() - partyJoinTimeRef.current < JOIN_GRACE_MS) return;

      const guestTime = currentTimeRef.current;
      const hostTime = projectedHostTime();

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
       // Throttle the drift readout: it only feeds a badge label, and
       // pushing it 4x/second re-renders the player shell each time.
       if (Math.abs(driftSec * 1000 - driftDisplayRef.current) >= 250) {
         driftDisplayRef.current = driftSec * 1000;
         setPartyDriftMs(driftSec * 1000);
       }

       // Enforce play/pause state
       if (partyPlaybackRef.current === "playing" && !isPlayingRef.current) {
         setPlaying(true);
         playEmbed();
       } else if (partyPlaybackRef.current === "paused" && isPlayingRef.current) {
         setPlaying(false);
         pauseEmbed();
       }

       // Hard resync check (>30s drift) — rebuild URL with corrected start time.
       //
       // This MUST be rate-limited. The tick runs four times a second and the
       // host clock advances continuously, so `injectSeekParam` produced a
       // *different* URL on every tick and the iframe reloaded four times a
       // second forever — the "guest stuck in a reload loop" party. One hard
       // resync per cooldown is all that is ever needed; if it did not fix
       // the drift, reloading again immediately will not either.
       const resync = computeResync(hostTime, guestTime, sourceUrlRef.current, String(currentServer));

       // Count consecutive soft seeks that failed to close the gap. Many
       // providers ignore postMessage seeks entirely; without this counter
       // the loop issues one every 600 ms for the rest of the film, which is
       // the "party is stuck seeking forever" symptom. After a few failures
       // we stop trusting the soft path and rebuild the iframe at the right
       // position — the only thing a silent provider actually honours.
       if (driftSec >= DRIFT_SOFT_THRESHOLD_SEC) {
         failedSeekCountRef.current += 1;
       } else {
         failedSeekCountRef.current = 0;
       }

       const softSeekExhausted = failedSeekCountRef.current >= MAX_FAILED_SOFT_SEEKS;

       if (resync.kind === "hard" || softSeekExhausted) {
         const seekUrl = resync.kind === "hard"
           ? resync.seekUrl
           : injectSeekParam(sourceUrlRef.current, hostTime);
         const now = Date.now();
         if (now - lastHardResyncAtRef.current >= HARD_RESYNC_COOLDOWN_MS) {
           lastHardResyncAtRef.current = now;
           failedSeekCountRef.current = 0;
           initialSyncDoneRef.current = true;
           setGuestInitialSynced(true);
           lastSeekAtRef.current = 0;
           setResyncSeekUrl(seekUrl);
           setPartySyncStatus("resyncing");
           // Track hard drift correction
           trackDriftSnap(partyRoomId!, driftSec * 1000, "hard");
           breadcrumbDriftSnap(partyRoomId!, driftSec * 1000, "hard");
         } else {
           setPartySyncStatus("drift");
         }
       } else if (driftSec >= DRIFT_SOFT_THRESHOLD_SEC) {
         softSeekTo(hostTime);
         setPartySyncStatus("drift");
         // Track soft drift correction
         trackDriftSnap(partyRoomId!, driftSec * 1000, "soft");
         breadcrumbDriftSnap(partyRoomId!, driftSec * 1000, "soft");
       } else {
         const fresh = Date.now() - lastSignalAtRef.current < SIGNAL_FRESH_MS;
         setPartySyncStatus(
           rtcConnected || guestInitialSyncedRef.current || fresh ? "connected" : "connecting"
         );
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
     projectedHostTime,
   ]);

  /**
   * Guest: manual "Snap to Host".
   *
   * The automatic loop deliberately rate-limits iframe rebuilds (one per
   * HARD_RESYNC_COOLDOWN_MS) so it can never trap a guest in a reload loop.
   * A user tapping the pill is an explicit intent, so it bypasses that
   * cooldown: live-synced providers get an immediate soft seek; silent
   * providers get one positioned reload. The cooldown is re-armed afterwards
   * so the automatic path does not immediately rebuild the iframe again.
   */
  const snapToHost = useCallback((): number | null => {
    if (!partyRoomId || isPartyHost) return null;
    const hostTime = projectedHostTime();
    if (hostTime <= 0) return null;
    const now = Date.now();
    failedSeekCountRef.current = 0;
    lastSeekAtRef.current = 0;
    initialSyncDoneRef.current = true;
    setGuestInitialSynced(true);
    const guestTime = currentTimeRef.current;
    const driftMs = Math.abs(guestTime - hostTime) * 1000;
    if (embedLiveSyncedRef.current) {
      softSeekTo(hostTime);
      // Track manual drift correction
      trackDriftSnap(partyRoomId, driftMs, "manual");
      breadcrumbDriftSnap(partyRoomId, driftMs, "manual");
    } else {
      lastHardResyncAtRef.current = now;
      setResyncSeekUrl(injectSeekParam(sourceUrlRef.current, hostTime));
      // Track manual hard resync
      trackDriftSnap(partyRoomId, driftMs, "manual");
      breadcrumbDriftSnap(partyRoomId, driftMs, "manual");
    }
    if (partyPlaybackRef.current === "playing") {
      setPlaying(true);
      playEmbed();
    } else {
      setPlaying(false);
      pauseEmbed();
    }
    driftDisplayRef.current = 0;
    setPartyDriftMs(0);
    setPartySyncStatus("resyncing");
    return hostTime;
  }, [partyRoomId, isPartyHost, projectedHostTime, softSeekTo, setPlaying, playEmbed, pauseEmbed]);

  // Guest: one-time seek to host position when embed becomes live-synced
  useEffect(() => {
    if (!partyRoomId || isPartyHost || initialSyncDoneRef.current) return;
    if (!embedReady || !embedLiveSynced) return;

    const hostTime = projectedHostTime();
    if (hostTime <= 0) return;

    initialSyncDoneRef.current = true;
    setGuestInitialSynced(true);
    lastSeekAtRef.current = 0;
    softSeekTo(hostTime);
    if (partyPlaybackRef.current === "playing") {
      setPlaying(true);
      playEmbed();
    }
  }, [partyRoomId, isPartyHost, embedReady, embedLiveSynced, softSeekTo, setPlaying, playEmbed, projectedHostTime]);

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
      const isSignalFresh = true;
      // Track reconnect if signal was stale before
      if (!isPartyHost && !wasSignalFreshRef.current && lastSignalAtRef.current > 0) {
        const wasDisconnectedMs = Date.now() - lastSignalAtRef.current;
        trackPartyReconnect(partyRoomId, wasDisconnectedMs, rtcConnected ? "webrtc" : "firestore");
        breadcrumbReconnect(partyRoomId, wasDisconnectedMs, rtcConnected ? "webrtc" : "firestore");
      }
      wasSignalFreshRef.current = isSignalFresh;
      setPartySyncStatus("connected");
    } else if (partyRoom) {
      wasSignalFreshRef.current = false;
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
        trackPartyJoin(joinId);
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
    void realtimeSend("sync-go", { currentTime: T, startAt });
    scheduledGoTimerRef.current = window.setTimeout(() => {
      scheduledGoTimerRef.current = 0;
      setPlaying(true);
      playEmbed();
    }, Math.max(0, startAt - NTPClient.now()));
  }, [partyRoomId, isPartyHost, setPlaying, pauseEmbed, playEmbed, updatePlaybackState, currentServer, realtimeSend]);

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
    void realtimeSend("sync-stage", { currentTime: T, releaseAt });
    // Track stage hold
    breadcrumbStageHold(partyRoomId, T, releaseAt);
    autoReleaseTimerRef.current = window.setTimeout(() => {
      releaseSyncedStart();
    }, SYNC_AUTO_RELEASE_MS);
  }, [partyRoomId, isPartyHost, user, setPlaying, pauseEmbed, updatePlaybackState, currentServer, realtimeSend, releaseSyncedStart]);

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

  /**
   * Collaborative controls (F9): a guest requests a playback action. The
   * host applies it and re-broadcasts. Only meaningful in COLLABORATIVE mode.
   */
  const requestPlaybackState = useCallback(
    (state: "playing" | "paused", time: number) => {
      if (!partyRoomId || isPartyHost) return;
      if (!isCollaborative) return;
      void realtimeSend("guest-control", { action: state, currentTime: time });
    },
    [partyRoomId, isPartyHost, isCollaborative, realtimeSend]
  );

  const requestSeek = useCallback(
    (time: number) => {
      if (!partyRoomId || isPartyHost) return;
      if (!isCollaborative) return;
      void realtimeSend("guest-control", { action: "seek", currentTime: time });
    },
    [partyRoomId, isPartyHost, isCollaborative, realtimeSend]
  );

  const requestServerChange = useCallback(
    (serverIndex: number, time: number) => {
      if (!partyRoomId || isPartyHost) return;
      if (!isCollaborative) return;
      void realtimeSend("guest-control", { action: "server-change", currentTime: time, serverIndex });
    },
    [partyRoomId, isPartyHost, isCollaborative, realtimeSend]
  );

  const broadcastPartyState = useCallback(
    (state: "playing" | "paused", time: number) => {
      if (!partyRoomId) return;
      // Collaborative mode: a guest may drive playback; route through the
      // host instead of writing Firestore directly (rules block guest writes
      // to playbackState).
      if (!isPartyHost) {
        if (isCollaborative) requestPlaybackState(state, time);
        return;
      }
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
      void realtimeSend(state === "playing" ? "play" : "pause", { currentTime: time });
      // Also send via WebRTC data channel so connected peers get the message
      // even if the realtime listener hasn't replayed yet.
      sendRtcMessage(state === "playing" ? "play" : "pause", { currentTime: time });
    },
    [partyRoomId, isPartyHost, isCollaborative, updatePlaybackState, realtimeSend, sendRtcMessage, currentServer, releaseSyncedStart, cancelSyncedStart, requestPlaybackState]
  );

  /**
   * Broadcast an explicit seek to all guests.
   * Called by the host whenever the playhead jumps (keyboard shortcuts,
   * progress-bar click, 0-9 number keys, etc.).
   * Only broadcasts if the seek was user-initiated (not from remote sync).
   */
  const broadcastPartySeek = useCallback(
    (time: number) => {
      if (!partyRoomId) return;
      if (!isPartyHost) {
        if (isCollaborative) requestSeek(time);
        return;
      }
      // Only broadcast user-initiated seeks, not remote sync seeks
      if (!isUserSeekRef.current) return;
      if (syncStageRef.current) cancelSyncedStart();
      // Persist to Firestore so late-joining guests get the right position
      void updatePlaybackState(partyPlayingRef.current ? "playing" : "paused", time, currentServer);
      // Instant delivery through the realtime transport
      void realtimeSend("seek", { currentTime: time });
      // Belt-and-braces: also send via WebRTC
      sendRtcMessage("seek", { currentTime: time });
    },
    [partyRoomId, isPartyHost, isCollaborative, updatePlaybackState, realtimeSend, sendRtcMessage, currentServer, cancelSyncedStart, requestSeek]
  );

  const setControlsMode = useCallback(
    async (mode: "HOST_ONLY" | "COLLABORATIVE") => {
      await setControlsModeRoom(mode);
    },
    [setControlsModeRoom]
  );

  /**
   * Broadcast a source-server switch to all guests. Called by the host when
   * changing servers mid-party so guests follow to the same source instead
   * of being stranded on the old one.
   */
  const broadcastServerChange = useCallback(
    (serverIndex: number, time: number) => {
      if (!partyRoomId) return;
      if (!isPartyHost) {
        if (isCollaborative) requestServerChange(serverIndex, time);
        return;
      }
      const fromServer = partyServerRef.current;
      if (syncStageRef.current) cancelSyncedStart();
      void updatePlaybackState(partyPlayingRef.current ? "playing" : "paused", time, serverIndex);
      void realtimeSend("server-change", { currentTime: time, serverIndex });
      sendRtcMessage("server-change", { currentTime: time, serverIndex });
      // Track server switch
      breadcrumbServerSwitch(partyRoomId, fromServer, serverIndex);
    },
    [partyRoomId, isPartyHost, isCollaborative, updatePlaybackState, realtimeSend, sendRtcMessage, cancelSyncedStart, requestServerChange]
  );

  // Update ref for quality change effect
  broadcastServerChangeRef.current = broadcastServerChange;

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
      // `playing` rides on every heartbeat so guests track play/pause on the
      // fast channel instead of waiting up to a second for the room poll.
      // Without it, a host pause reached the guest late, the guest kept
      // playing, its position ran ahead, and the next poll yanked it
      // backwards — a visible rewind on every pause.
      void realtimeSend("heartbeat", {
        currentTime: time,
        playing,
        staged: stage !== null,
        stageTime: stage?.targetTime ?? 0,
      });
      sendRtcMessage("heartbeat", { currentTime: time, playing });

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
  }, [partyRoomId, isPartyHost, realtimeSend, sendRtcMessage, updatePlaybackState]);

  const hasPartyRoom = partyRoom !== null;
  const encryptedPartyPayload = partyRoom?.encryptedPayload;
  const contentMetaTmdbId = partyRoom?.contentMeta?.tmdbId;
  const contentMetaMediaType = partyRoom?.contentMeta?.mediaType;
  const contentMetaSeason = partyRoom?.contentMeta?.season;
  const contentMetaEpisode = partyRoom?.contentMeta?.episode;
  const contentMetaServerIndex = partyRoom?.contentMeta?.serverIndex;

  useEffect(() => {
    if (
      !partyRoomId ||
      !partyRoomKey ||
      !hasPartyRoom ||
      !encryptedPartyPayload ||
      !isPartyHost
    ) return;

    let active = true;
    const rotateRoomKey = async () => {
      if (
        rotatingEncryptionRef.current ||
        !isRoomEncryptionRotationDue(encryptedPartyPayload)
      ) {
        return;
      }

      rotatingEncryptionRef.current = true;
      try {
        const contentMeta: PartyContentMeta = {
          tmdbId: contentMetaTmdbId ?? movieId,
          mediaType: contentMetaMediaType ?? mediaType,
          season: contentMetaSeason ?? season,
          episode: contentMetaEpisode ?? episode,
          serverIndex: contentMetaServerIndex ?? currentServer,
        };
        const encryptedPayload = await encryptPayload(contentMeta, partyRoomKey);
        if (active) await updateEncryptedPayload(encryptedPayload);
      } catch (error) {
        console.error("Failed to rotate party encryption key:", error);
      } finally {
        rotatingEncryptionRef.current = false;
      }
    };

    const timer = window.setInterval(() => {
      void rotateRoomKey();
    }, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [
    partyRoomId,
    partyRoomKey,
    hasPartyRoom,
    encryptedPartyPayload,
    contentMetaTmdbId,
    contentMetaMediaType,
    contentMetaSeason,
    contentMetaEpisode,
    contentMetaServerIndex,
    isPartyHost,
    movieId,
    mediaType,
    season,
    episode,
    currentServer,
    updateEncryptedPayload,
  ]);

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
    appliedRoomServerRef.current = -1;
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
    appliedRoomServerRef.current = -1;
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
    appliedRoomServerRef.current = -1;
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
    // Debounced version for user-initiated seeks (400ms debounce)
    debouncedBroadcastPartySeek: useCallback(
      (time: number) => {
        const ref = seekDebounceRef.current;
        // Clear any pending debounce timer
        if (ref.timer) {
          window.clearTimeout(ref.timer);
        }
        // Mark this as a user-initiated seek
        isUserSeekRef.current = true;
        ref.pendingTime = time;
        ref.timer = window.setTimeout(() => {
          ref.timer = null;
          if (ref.pendingTime !== null) {
            broadcastPartySeek(ref.pendingTime);
            ref.pendingTime = null;
          }
          // Reset the user-initiated flag after the debounced call
          isUserSeekRef.current = false;
        }, 400);
      },
      [broadcastPartySeek]
    ),
    broadcastServerChange,
    broadcastNextEpisode: useCallback(
      (nextSeason: number, nextEpisode: number, serverIndex?: number, transitionTime?: number) => {
        if (!partyRoomId) return;
        if (!isPartyHost) return;
        // NTP-corrected transition time for precise sync across all clients
        const ntpTransitionTime = transitionTime ?? NTPClient.now();
        void realtimeSend("next-episode", {
          season: nextSeason,
          episode: nextEpisode,
          serverIndex: serverIndex ?? currentServer,
          movieId,
          mediaType,
          transitionAt: ntpTransitionTime,
        });
        sendRtcMessage("next-episode", {
          season: nextSeason,
          episode: nextEpisode,
          serverIndex: serverIndex ?? currentServer,
          transitionAt: ntpTransitionTime,
        });
      },
      [partyRoomId, isPartyHost, realtimeSend, sendRtcMessage, currentServer, movieId, mediaType]
    ),
    controlsMode,
    isCollaborative,
    requestPlaybackState,
    requestSeek,
    requestServerChange,
    setControlsMode,
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
    transferHost,
    media,
    sendMuteAll,
    guestServerIndex,
    guestSplashPhase,
    guestSplashVisible,
    guestJoinHostName: guestJoinSession?.hostName,
    resyncSeekUrl,
    setResyncSeekUrl,
    snapToHost,
    projectedHostTime,
    // Network quality for ABR downgrade indicator
    networkQuality,
    showQualityIndicator,
    qualityIndicatorMessage,
    pendingQueue: partyPendingQueue,
    suggestToQueue: partySuggestToQueue,
    voteQueueItem: partyVoteQueueItem,
    confirmQueueItem: partyConfirmQueueItem,
    removeQueueItem: partyRemoveQueueItem,
    removeOwnQueueItem: partyRemoveOwnQueueItem,
    realtime: {
      processed: realtime.processed,
      isReady: realtime.isReady,
    },
  };
}
