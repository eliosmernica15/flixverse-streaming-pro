"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { buildStreamingSources, wrapEmbedUrl } from "@/lib/streamingSources";
import { usePlaybackClock } from "@/hooks/player/usePlaybackClock";
import { useTimelineComments } from "@/hooks/player/useTimelineComments";
import { useEmbedBridge } from "@/hooks/player/useEmbedBridge";
import { useFlixParty } from "@/hooks/player/useFlixParty";
import { useWebRTCSync, type SyncMessage } from "@/hooks/player/useWebRTCSync";
import { useCaptions } from "@/hooks/player/useCaptions";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { PaywallGate } from "@/components/PaywallGate";
import { CaptionOverlay } from "./CaptionOverlay";
import { computeResync, sendSoftSeek, injectSeekParam } from "@/lib/player/embedSeekUrls";
import {
  encryptPayload,
  generateRoomKey,
  buildPartyJoinUrl,
} from "@/lib/player/roomEncryption";
import type { SyncStatus } from "./SyncStatusBadge";
import { EmbedFrame } from "./EmbedFrame";
import { PlayerChrome } from "./PlayerChrome";
import { AmbientGlowFrame } from "./AmbientGlowFrame";
import { FlixPartySidebar } from "./FlixPartySidebar";
import { FlixPartyInviteDialog } from "./FlixPartyInviteDialog";
import { PlayerOverlayControls } from "./PlayerOverlayControls";
import { AddCommentDialog } from "./AddCommentDialog";
import { getImageUrl } from "@/utils/tmdbApi";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  Settings,
  Captions,
  PictureInPicture2,
  Sparkles,
  AudioLines,
  ListVideo,
  Activity,
  Film,
  HelpCircle,
  Users,
  Server,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
import { playUiSound, getUiSoundsEnabled, setUiSoundsEnabled } from "@/lib/uiSound";
import "@/app/video-player.css";

interface PlayerShellProps {
  movieId: number;
  title: string;
  description?: string;
  onClose: () => void;
  isTrailer?: boolean;
  mediaType?: "movie" | "tv";
  season?: number;
  episode?: number;
  posterPath?: string;
  resumePosition?: number;
  totalDuration?: number;
}

const LOAD_TIMEOUT_MS = 22_000;

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function SettingsToggle({
  label,
  icon,
  checked,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="video-cc-row">
      <span className="video-cc-label">
        {icon}
        <span>{label}</span>
      </span>
      <button
        type="button"
        className="video-switch focus-ring"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
      >
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

export function PlayerShell({
  movieId,
  title,
  onClose,
  isTrailer = false,
  mediaType = "movie",
  season,
  episode,
  posterPath,
  resumePosition = 0,
  totalDuration,
}: PlayerShellProps) {
  const [currentServer, setCurrentServer] = useState(0);
  const [showServerSelector, setShowServerSelector] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(true);
  const [isCinematic, setIsCinematic] = useState(false);
  const [embedState, setEmbedState] = useState<"loading" | "ready" | "error">("loading");
  const [showHelpPrompt, setShowHelpPrompt] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [flashIcon, setFlashIcon] = useState<"play" | "pause" | null>(null);
  const [showCenterPlay, setShowCenterPlay] = useState(false);
  const [seekIndicator, setSeekIndicator] = useState<"back" | "forward" | null>(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Advanced settings panel state
  const [quality, setQuality] = useState<string>("Auto");
  const [showCaptions, setShowCaptions] = useState(false);
  const [ambientEnabled, setAmbientEnabled] = useState(true);
  const [uiSounds, setUiSounds] = useState(true);
  const [liveDuration, setLiveDuration] = useState(0);
  const [autoplayNext, setAutoplayNext] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [upNextDismissed, setUpNextDismissed] = useState(false);
  const [upNextCount, setUpNextCount] = useState(10);

  // FlixParty state
  const [showPartySidebar, setShowPartySidebar] = useState(false);
  const [partyRoomId, setPartyRoomId] = useState<string | null>(null);
  const [partyRoomKey, setPartyRoomKey] = useState<string | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [partySyncStatus, setPartySyncStatus] = useState<SyncStatus>("disconnected");
  const [partyDriftMs, setPartyDriftMs] = useState(0);
  const [captionLang, setCaptionLang] = useState("en");

  // Timeline comments state
  const [showTimelineControls, setShowTimelineControls] = useState(false);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [commentTimestamp, setCommentTimestamp] = useState(0);

  const { user } = useAuth();
  const { hasStandard } = useSubscription();
  const {
    room: partyRoom,
    isHost: isPartyHost,
    createRoom: createPartyRoom,
    joinRoom: joinPartyRoom,
    leaveRoom: leavePartyRoom,
    updatePlaybackState,
  } = useFlixParty({ roomId: partyRoomId });

  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const centerPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const upNextTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTapRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const streamingSources = useMemo(
    () => buildStreamingSources(movieId, mediaType, season, episode),
    [movieId, mediaType, season, episode]
  );
  const currentSource = streamingSources[currentServer];

  const fullPosterUrl = useMemo(() => {
    return posterPath ? getImageUrl(posterPath, "medium") : null;
  }, [posterPath]);

  // Prefer the real duration reported by the embed over the TMDB estimate.
  const effectiveDuration = liveDuration || totalDuration || 120 * 60;

  const {
    isPlaying,
    isMuted,
    volume,
    providerName,
    isLiveSynced,
    togglePlay,
    toggleMute,
    setVolume,
    adjustVolume,
    seek,
    seekRelative,
    setReady,
    setPlaying,
  } = useEmbedBridge({
    iframeRef,
    enabled: embedState === "ready",
    totalDuration: effectiveDuration,
    onTimeUpdate: (time) => syncTo(time),
    onPlayStateChange: (playing) => setPlaying(playing),
    onDurationChange: (duration) => setLiveDuration(duration),
    onEnded: () => setUpNextDismissed(false),
  });

  const { currentTime, seekTo, syncTo } = usePlaybackClock({
    movieId,
    mediaType,
    title,
    posterPath: posterPath || null,
    season,
    episode,
    initialPosition: resumePosition,
    totalDuration: effectiveDuration,
    isPlaying: isPlaying && embedState === "ready",
  });

  const { comments, addComment, likeComment, getMarkers, getCommentsNear } =
    useTimelineComments({ tmdbId: movieId, enabled: showTimelineControls });
  const commentMarkers = useMemo(
    () => getMarkers(effectiveDuration),
    [getMarkers, effectiveDuration]
  );
  const nearbyComments = useMemo(
    () => getCommentsNear(currentTime, 5),
    [getCommentsNear, currentTime]
  );

  const { getCueAt, source: captionSource, loading: captionsLoading } = useCaptions({
    tmdbId: movieId,
    mediaType,
    season,
    episode,
    duration: effectiveDuration,
    enabled: showCaptions,
    lang: captionLang,
  });
  const activeCaption = getCueAt(currentTime);

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

  const { isConnected: rtcConnected, sendMessage: sendRtcMessage } = useWebRTCSync({
    roomId: partyRoomId,
    isHost: !!isPartyHost,
    onPlaybackSync: handlePartyPlaybackSync,
  });

  // Guest sync via Firestore room state (fallback when WebRTC is not connected)
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
      currentSource.providerUrl,
      currentSource.id
    );

    if (action.kind === "soft") {
      setPartySyncStatus("drift");
      sendSoftSeek(iframeRef.current, action.deltaSeconds);
      seekRelative(action.deltaSeconds);
    } else if (action.kind === "hard" && iframeRef.current) {
      setPartySyncStatus("drift");
      iframeRef.current.src = wrapEmbedUrl(injectSeekParam(currentSource.providerUrl, partyRoom.lastKnownTime));
    }
  }, [
    partyRoom?.lastKnownTime,
    partyRoom?.playbackState,
    isPartyHost,
    partyRoomId,
    isPlaying,
    currentSource,
    rtcConnected,
    setPlaying,
    seekRelative,
    currentTime,
  ]);

  useEffect(() => {
    if (!partyRoomId) {
      setPartySyncStatus("disconnected");
      return;
    }
    if (rtcConnected) setPartySyncStatus("connected");
    else if (partyRoom) setPartySyncStatus("connecting");
  }, [partyRoomId, rtcConnected, partyRoom]);

  // Auto-join party from URL ?party=ROOM_ID
  useEffect(() => {
    if (partyRoomId || !user) return;
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get("party");
    if (joinId) setPartyRoomId(joinId);
  }, [partyRoomId, user]);

  const broadcastPartyState = useCallback(
    (state: "playing" | "paused", time: number) => {
      if (!partyRoomId || !isPartyHost) return;
      void updatePlaybackState(state, time);
      sendRtcMessage(state === "playing" ? "play" : "pause", { currentTime: time });
    },
    [partyRoomId, isPartyHost, updatePlaybackState, sendRtcMessage]
  );

  const handleStartParty = useCallback(async () => {
    if (!user || !hasStandard) {
      setShowPartySidebar(true);
      return;
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
      setShowPartySidebar(true);
      playUiSound("success");
    } catch (err) {
      console.error("Failed to create party:", err);
      playUiSound("error");
    }
  }, [user, hasStandard, movieId, mediaType, season, episode, currentServer, createPartyRoom]);

  const buffered = Math.min(effectiveDuration, currentTime + effectiveDuration * 0.12 + 15);

  const clearTimers = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    if (seekIndicatorTimerRef.current) clearTimeout(seekIndicatorTimerRef.current);
    if (centerPlayTimerRef.current) clearTimeout(centerPlayTimerRef.current);
    if (bufferingTimerRef.current) clearTimeout(bufferingTimerRef.current);
    if (upNextTimerRef.current) clearInterval(upNextTimerRef.current);
  }, []);

  const showFlash = useCallback((icon: "play" | "pause") => {
    setFlashIcon(icon);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashIcon(null), 600);
  }, []);

  const showSeekIndicator = useCallback((dir: "back" | "forward") => {
    setSeekIndicator(dir);
    if (seekIndicatorTimerRef.current) clearTimeout(seekIndicatorTimerRef.current);
    seekIndicatorTimerRef.current = setTimeout(() => setSeekIndicator(null), 500);
  }, []);

  const bumpControls = useCallback(() => {
    setControlsVisible(true);
    setShowSettings(false);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => setControlsVisible(false), 3500);
  }, []);

  const handleClose = useCallback(() => {
    clearTimers();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    }
    onClose();
  }, [clearTimers, onClose]);

  const requestContainerFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
    } catch {}
  }, []);

  const exitContainerFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) return;
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
    } catch {}
  }, []);

  const toggleTheaterMode = useCallback(async () => {
    const entering = !isTheaterMode;
    setIsTheaterMode(entering);
    bumpControls();
    if (entering) {
      requestAnimationFrame(() => void requestContainerFullscreen());
    } else {
      await exitContainerFullscreen();
    }
  }, [isTheaterMode, bumpControls, requestContainerFullscreen, exitContainerFullscreen]);

  const switchServer = useCallback((index: number) => {
    clearTimers();
    setCurrentServer(index);
    setShowServerSelector(false);
    setEmbedState("loading");
    setShowHelpPrompt(false);
    setLiveDuration(0);
    setPlaying(true);
    setReady(false);
    playUiSound("tap");
  }, [clearTimers, setPlaying, setReady]);

  const handleRetry = useCallback(() => {
    switchServer((currentServer + 1) % streamingSources.length);
  }, [currentServer, streamingSources.length, switchServer]);

  const triggerBuffering = useCallback(() => {
    setIsBuffering(true);
    if (bufferingTimerRef.current) clearTimeout(bufferingTimerRef.current);
    bufferingTimerRef.current = setTimeout(() => setIsBuffering(false), 650);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (embedState !== "ready") return;
    togglePlay();
    const nextPlaying = !isPlaying;
    showFlash(isPlaying ? "pause" : "play");
    playUiSound(isPlaying ? "pause" : "play");
    broadcastPartyState(nextPlaying ? "playing" : "paused", currentTime);
    bumpControls();
  }, [embedState, togglePlay, isPlaying, showFlash, bumpControls, broadcastPartyState, currentTime]);

  const handleToggleMute = useCallback(() => {
    if (embedState !== "ready") return;
    toggleMute();
    playUiSound("volume");
    bumpControls();
  }, [embedState, toggleMute, bumpControls]);

  const handleAdjustVolume = useCallback((delta: number) => {
    if (embedState !== "ready") return;
    adjustVolume(delta);
    playUiSound("volume");
    bumpControls();
  }, [embedState, adjustVolume, bumpControls]);

  const handleSeek = useCallback((direction: "back" | "forward") => {
    if (embedState !== "ready") return;
    const delta = direction === "back" ? -10 : 10;
    seekRelative(delta);
    showSeekIndicator(direction);
    playUiSound("seek");
    triggerBuffering();
    bumpControls();
  }, [embedState, seekRelative, showSeekIndicator, triggerBuffering, bumpControls]);

  const handleScrub = useCallback((seconds: number) => {
    if (embedState !== "ready") return;
    seek(seconds);
    seekTo(seconds);
    playUiSound("seek");
    triggerBuffering();
    if (isPartyHost) sendRtcMessage("seek", { currentTime: seconds });
    bumpControls();
  }, [embedState, seek, seekTo, triggerBuffering, bumpControls, isPartyHost, sendRtcMessage]);

  const handleSeekToPercent = useCallback((percent: number) => {
    if (embedState !== "ready" || effectiveDuration <= 0) return;
    handleScrub((percent / 100) * effectiveDuration);
    showSeekIndicator(percent >= 50 ? "forward" : "back");
  }, [embedState, effectiveDuration, handleScrub, showSeekIndicator]);

  const reloadStream = useCallback(() => {
    if (embedState !== "ready") return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const src = iframe.src;
    iframe.src = "";
    iframe.src = src;
    setPlaying(true);
    bumpControls();
  }, [embedState, setPlaying, bumpControls]);

  const prevServer = useCallback(() => {
    switchServer((currentServer - 1 + streamingSources.length) % streamingSources.length);
  }, [currentServer, streamingSources.length, switchServer]);

  const skipIntro = useCallback(() => {
    if (embedState !== "ready") return;
    seekRelative(85);
    showSeekIndicator("forward");
    playUiSound("seek");
    triggerBuffering();
    bumpControls();
  }, [embedState, seekRelative, showSeekIndicator, triggerBuffering, bumpControls]);

  const toggleAmbient = useCallback(() => {
    const next = !ambientEnabled;
    setAmbientEnabled(next);
    try {
      window.dispatchEvent(
        new CustomEvent("toggle-ambient-glow", { detail: { enabled: next } })
      );
    } catch {}
    bumpControls();
  }, [ambientEnabled, bumpControls]);

  const handlePictureInPicture = useCallback(() => {
    const iframe = iframeRef.current as unknown as {
      requestPictureInPicture?: () => Promise<void>;
    } | null;
    if (!iframe || typeof iframe.requestPictureInPicture !== "function") return;
    try {
      void iframe.requestPictureInPicture();
    } catch {}
    bumpControls();
  }, [bumpControls]);

  const toggleCaptions = useCallback(() => {
    setShowCaptions((p) => !p);
    bumpControls();
  }, [bumpControls]);

  const toggleAutoNext = useCallback(() => {
    setAutoplayNext((p) => !p);
    setUpNextDismissed(false);
    bumpControls();
  }, [bumpControls]);

  const toggleStats = useCallback(() => {
    setShowStats((p) => !p);
    bumpControls();
  }, [bumpControls]);

  const QUALITY_OPTIONS = ["Auto", "4K", "1080p", "720p", "480p"];
  const qualityFromSource = (q: string): string => {
    if (q === "4K") return "4K";
    if (q === "FHD") return "1080p";
    return "720p";
  };

  const changePlaybackRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    setShowSettings(false);
    bumpControls();
  }, [bumpControls]);

  // Double-tap seek on mobile
  const handleTap = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    const timeSince = now - lastTapRef.current;
    lastTapRef.current = now;

    if (timeSince < 300 && timeSince > 0) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.touches[0].clientX - rect.left;
      const isLeftHalf = x < rect.width / 2;
      handleSeek(isLeftHalf ? "back" : "forward");
    } else {
      if (controlsVisible) {
        setControlsVisible(false);
      } else {
        bumpControls();
        setShowCenterPlay(true);
        if (centerPlayTimerRef.current) clearTimeout(centerPlayTimerRef.current);
        centerPlayTimerRef.current = setTimeout(() => setShowCenterPlay(false), 1200);
      }
    }
  }, [controlsVisible, bumpControls, handleSeek]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showServerSelector) {
        if (e.key === "Escape") setShowServerSelector(false);
        return;
      }

      // Don't hijack typing or slider interactions
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        if (e.key === "Escape") (target as HTMLElement).blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const handledKeys = [
        " ", "k", "K", "m", "M",
        "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
        "f", "F", "t", "T", "c", "C", "n", "N", "]", "[",
        "s", "S", "r", "R", "g", "G", "l", "L", "i", "I", "d", "D", "?", "/",
        "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
      ];
      if (handledKeys.includes(e.key)) e.preventDefault();

      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          void exitContainerFullscreen();
          setIsTheaterMode(false);
          bumpControls();
          return;
        }
        handleClose();
        return;
      }
      // Playback
      if (e.key === " " || e.key === "k" || e.key === "K") { togglePlayPause(); return; }
      if (e.key === "m" || e.key === "M") { handleToggleMute(); return; }
      if (e.key === "ArrowLeft") { handleSeek("back"); return; }
      if (e.key === "ArrowRight") { handleSeek("forward"); return; }
      if (e.key === "ArrowUp") { handleAdjustVolume(0.1); return; }
      if (e.key === "ArrowDown") { handleAdjustVolume(-0.1); return; }
      if (/^[0-9]$/.test(e.key)) { handleSeekToPercent(parseInt(e.key, 10) * 10); return; }
      // UI / modes
      if (e.key === "f" || e.key === "F" || e.key === "t" || e.key === "T") { void toggleTheaterMode(); return; }
      if (e.key === "c" || e.key === "C") { setIsCinematic((p) => !p); bumpControls(); return; }
      if (e.key === "n" || e.key === "N" || e.key === "]") { handleRetry(); return; }
      if (e.key === "[") { prevServer(); return; }
      if (e.key === "s" || e.key === "S") { setShowServerSelector((p) => !p); return; }
      if (e.key === "r" || e.key === "R") { reloadStream(); return; }
      if (e.key === "g" || e.key === "G") { setShowPartySidebar((p) => !p); bumpControls(); return; }
      if (e.key === "l" || e.key === "L") { setShowTimelineControls((p) => !p); bumpControls(); return; }
      if (e.key === "i" || e.key === "I") { skipIntro(); return; }
      if (e.key === "d" || e.key === "D") { setShowStats((p) => !p); bumpControls(); return; }
      if (e.key === "?" || e.key === "/") { setShowShortcuts((p) => !p); return; }
      bumpControls();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose, handleRetry, prevServer, reloadStream, handleSeek, handleToggleMute, togglePlayPause, bumpControls, toggleTheaterMode, exitContainerFullscreen, showServerSelector, handleAdjustVolume, handleSeekToPercent, skipIntro]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (document.fullscreenElement !== containerRef.current && isTheaterMode) {
        setIsTheaterMode(false);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [isTheaterMode]);

  useEffect(() => {
    bumpControls();
    return () => { document.body.style.overflow = ""; };
  }, [bumpControls]);

  useEffect(() => {
    setEmbedState("loading");
    setShowHelpPrompt(false);
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = setTimeout(() => {
      setEmbedState("error");
      setShowHelpPrompt(false);
    }, LOAD_TIMEOUT_MS);
    return () => clearTimers();
  }, [currentServer, clearTimers]);

  const onIframeLoad = () => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setEmbedState("ready");
    setReady(true);
    playUiSound("success");
  };

  const onIframeError = () => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setEmbedState("error");
    setReady(false);
    playUiSound("error");
  };

  // Sync quality label with the active server (UI-only)
  useEffect(() => {
    setQuality((prev) => (prev === "Auto" ? "Auto" : qualityFromSource(currentSource.quality)));
  }, [currentServer, currentSource.quality]);

  // Initialize ambient + sound toggles from persisted preferences
  useEffect(() => {
    try {
      const stored = localStorage.getItem("flixverse-ambient-glow");
      if (stored !== null) setAmbientEnabled(stored === "true");
    } catch {}
    setUiSounds(getUiSoundsEnabled());
  }, []);

  const toggleUiSounds = useCallback(() => {
    setUiSounds((prev) => {
      const next = !prev;
      setUiSoundsEnabled(next);
      return next;
    });
    bumpControls();
  }, [bumpControls]);

  // Keep ambient toggle in sync if changed elsewhere
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ enabled: boolean }>).detail;
      setAmbientEnabled(detail.enabled);
    };
    window.addEventListener("toggle-ambient-glow", handler);
    return () => window.removeEventListener("toggle-ambient-glow", handler);
  }, []);

  // Up Next countdown — best-effort auto-advance when near the end
  const nearEnd =
    autoplayNext &&
    embedState === "ready" &&
    effectiveDuration > 0 &&
    currentTime / effectiveDuration > 0.95 &&
    !upNextDismissed;

  useEffect(() => {
    if (!nearEnd) {
      setUpNextCount(10);
      return;
    }
    if (upNextTimerRef.current) clearInterval(upNextTimerRef.current);
    upNextTimerRef.current = setInterval(() => {
      setUpNextCount((c) => {
        if (c <= 1) {
          if (upNextTimerRef.current) clearInterval(upNextTimerRef.current);
          setUpNextDismissed(true);
          handleRetry();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (upNextTimerRef.current) clearInterval(upNextTimerRef.current);
    };
  }, [nearEnd, handleRetry]);

  const volumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const VolumeIcon = volumeIcon;

  return (
    <div
      ref={containerRef}
      className="player-shell fixed inset-0 z-[9999] bg-black flex flex-col"
      onMouseMove={bumpControls}
      onTouchStart={handleTap}
    >
      <AmbientGlowFrame posterPath={fullPosterUrl} />

      <PlayerChrome
        title={title}
        mediaType={mediaType}
        season={season}
        episode={episode}
        isTrailer={isTrailer}
        controlsVisible={controlsVisible}
        embedState={embedState}
        currentSource={currentSource}
        currentServer={currentServer}
        streamingSources={streamingSources}
        isTheaterMode={isTheaterMode}
        isCinematic={isCinematic}
        playState={isPlaying ? "playing" : "paused"}
        showServerSelector={showServerSelector}
        handleClose={handleClose}
        togglePlayPause={togglePlayPause}
        setShowServerSelector={setShowServerSelector}
        toggleTheaterMode={toggleTheaterMode}
        prevServer={prevServer}
        seek={handleSeek}
        reloadStream={reloadStream}
        handleRetry={handleRetry}
        switchServer={switchServer}
        setIsCinematic={setIsCinematic}
      />

      <EmbedFrame
        currentSource={currentSource}
        currentServer={currentServer}
        streamingSourcesCount={streamingSources.length}
        embedState={embedState}
        showHelpPrompt={showHelpPrompt}
        flashIcon={flashIcon}
        playState={isPlaying ? "playing" : "paused"}
        title={title}
        iframeRef={iframeRef}
        onIframeLoad={onIframeLoad}
        onIframeError={onIframeError}
        handleRetry={handleRetry}
        setShowHelpPrompt={setShowHelpPrompt}
        isTheaterMode={isTheaterMode}
        isCinematic={isCinematic}
      />

      {showCenterPlay && embedState === "ready" && (
        <div className="video-center-play">
          <div className="video-center-play-circle">
            {isPlaying ? (
              <div className="flex gap-1.5">
                <div className="w-2 h-6 bg-white rounded-sm" />
                <div className="w-2 h-6 bg-white rounded-sm" />
              </div>
            ) : (
              <div className="w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[16px] border-l-white ml-1" />
            )}
          </div>
        </div>
      )}

      {seekIndicator && (
        <div
          className={`video-seek-ind ${seekIndicator === "back" ? "left-8" : "right-8"}`}
          aria-hidden="true"
        >
          {seekIndicator === "back" ? "−10s" : "+10s"}
        </div>
      )}

      {/* ── Floating glass control dock ── */}
      <div
        className={`video-dock-wrap ${controlsVisible ? "" : "video-hidden"}`}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="video-dock">
          {/* Centerpiece scrubber + comment markers */}
          <PlayerOverlayControls
            currentTime={currentTime}
            totalDuration={effectiveDuration}
            markers={commentMarkers}
            nearbyComments={nearbyComments}
            onSeek={handleScrub}
            onAddComment={(t) => {
              if (!hasStandard) {
                setShowPartySidebar(true);
                return;
              }
              setCommentTimestamp(t);
              setShowCommentDialog(true);
            }}
            onLikeComment={likeComment}
            isPlaying={isPlaying}
            controlsVisible={controlsVisible}
            buffered={buffered}
          />

          {/* Controls row */}
          <div className="video-controls">
            <div className="video-left">
              {/* Play / pause (primary) */}
              <button
                type="button"
                onClick={togglePlayPause}
                className="video-btn video-btn-primary video-btn-shine focus-ring"
                aria-label={isPlaying ? "Pause" : "Play"}
                title="Play / Pause (Space)"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>

              {/* Skip back / forward ±10s */}
              <button
                type="button"
                onClick={() => handleSeek("back")}
                className="video-btn video-btn-icon video-hide-sm"
                aria-label="Seek back 10 seconds"
                title="Seek back 10s"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => handleSeek("forward")}
                className="video-btn video-btn-icon video-hide-sm"
                aria-label="Seek forward 10 seconds"
                title="Seek forward 10s"
              >
                <SkipForward className="w-5 h-5" />
              </button>

              {/* Volume */}
              <div className="video-volume-wrap video-hide-sm">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="video-btn video-btn-icon video-hide-sm"
                  aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
                  aria-pressed={isMuted || volume === 0}
                  title="Mute (M)"
                >
                  <VolumeIcon className="w-5 h-5" />
                </button>
                <input
                  type="range"
                  className={`video-volume ${showVolumeSlider ? "is-open" : ""}`}
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    playUiSound("volume");
                  }}
                  aria-label="Volume"
                  tabIndex={0}
                />
              </div>

              {/* Time readout */}
              <div className="video-time video-hide-sm">
                <span>{formatTime(currentTime)}</span>
                <span className="video-time-sep">/</span>
                <span className="video-time-total">{formatTime(effectiveDuration)}</span>
              </div>

              {/* Live sync indicator */}
              <span
                className={`video-sync-chip video-hide-sm ${isLiveSynced ? "is-live" : ""}`}
                title={
                  isLiveSynced
                    ? `Controls synced live with ${providerName}`
                    : "Estimated time — waiting for player events"
                }
              >
                <span className="video-sync-dot" aria-hidden="true" />
                {isLiveSynced ? "SYNCED" : "EST"}
              </span>

              {/* FlixParty */}
              <button
                type="button"
                onClick={() => setShowPartySidebar((p) => !p)}
                className={`video-btn video-btn-icon video-hide-sm ${showPartySidebar ? "is-active" : ""}`}
                aria-label="Toggle FlixParty"
                aria-pressed={showPartySidebar}
                title="FlixParty (G)"
              >
                <Users className="w-5 h-5" />
              </button>

              {/* Skip intro */}
              <button
                type="button"
                onClick={skipIntro}
                className="video-btn video-hide-sm"
                aria-label="Skip intro"
                title="Skip intro (I)"
              >
                <SkipForward className="w-5 h-5" />
                <span className="video-btn-label">Skip Intro</span>
              </button>
            </div>

            <div className="video-right">
              {/* Settings panel */}
              <div className="relative video-hide-sm">
                <button
                  type="button"
                  onClick={() => {
                    playUiSound(showSettings ? "close" : "open");
                    setShowSettings((p) => !p);
                  }}
                  className={`video-btn video-btn-icon focus-ring press-effect ${showSettings ? "is-active" : ""}`}
                  aria-label="Player settings"
                  aria-haspopup="menu"
                  aria-expanded={showSettings}
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
                {showSettings && (
                  <div className="video-settings scrollbar-thin" role="menu" aria-label="Player settings">
                    {/* Playback speed */}
                    <div className="video-settings-section">
                      <p className="video-settings-head">Playback speed</p>
                      <div className="video-settings-grid">
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            role="menuitemradio"
                            aria-checked={playbackRate === rate}
                            onClick={() => changePlaybackRate(rate)}
                            className={`video-quality ${playbackRate === rate ? "is-selected" : ""}`}
                          >
                            {rate === 1 ? "Normal" : `${rate}x`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="video-settings-divider" />

                    {/* Quality (UI-only) */}
                    <div className="video-settings-section">
                      <p className="video-settings-head">Quality</p>
                      <div className="video-settings-grid">
                        {QUALITY_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            role="menuitemradio"
                            aria-checked={quality === opt}
                            onClick={() => setQuality(opt)}
                            className={`video-quality ${quality === opt ? "is-selected" : ""}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="video-settings-divider" />

                    {/* Toggles */}
                    <div className="video-settings-section video-settings-toggles">
                      <SettingsToggle
                        label="Captions / Subtitles"
                        icon={<Captions className="w-4 h-4" />}
                        checked={showCaptions}
                        onChange={toggleCaptions}
                      />
                      <SettingsToggle
                        label="Ambient light"
                        icon={<Sparkles className="w-4 h-4" />}
                        checked={ambientEnabled}
                        onChange={toggleAmbient}
                      />
                      <SettingsToggle
                        label="UI sounds"
                        icon={<AudioLines className="w-4 h-4" />}
                        checked={uiSounds}
                        onChange={toggleUiSounds}
                      />
                      <SettingsToggle
                        label="Autoplay next"
                        icon={<ListVideo className="w-4 h-4" />}
                        checked={autoplayNext}
                        onChange={toggleAutoNext}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Picture-in-Picture (best-effort) */}
              <button
                type="button"
                onClick={handlePictureInPicture}
                className="video-btn video-btn-icon video-hide-sm focus-ring press-effect"
                aria-label="Picture in picture (best-effort)"
                title="Picture in picture"
              >
                <PictureInPicture2 className="w-5 h-5" />
              </button>

              {/* Captions quick toggle */}
              <button
                type="button"
                onClick={toggleCaptions}
                className={`video-btn video-btn-icon video-hide-sm focus-ring press-effect ${showCaptions ? "is-active" : ""}`}
                aria-label="Toggle captions"
                aria-pressed={showCaptions}
                title="Captions (CC)"
              >
                <Captions className="w-5 h-5" />
              </button>

              {/* Stats for nerds */}
              <button
                type="button"
                onClick={toggleStats}
                className={`video-btn video-btn-icon video-hide-sm focus-ring press-effect ${showStats ? "is-active" : ""}`}
                aria-label="Toggle stats"
                aria-pressed={showStats}
                title="Stats (D)"
              >
                <Activity className="w-5 h-5" />
              </button>

              {/* Cinematic toggle */}
              <button
                type="button"
                onClick={() => setIsCinematic((p) => !p)}
                className={`video-btn video-btn-icon video-hide-sm ${isCinematic ? "is-active" : ""}`}
                aria-label={isCinematic ? "Exit cinematic mode" : "Enable cinematic mode"}
                aria-pressed={isCinematic}
                title="Cinematic (C)"
              >
                <Film className="w-5 h-5" />
              </button>

              {/* Keyboard shortcuts */}
              <button
                type="button"
                onClick={() => setShowShortcuts(true)}
                className="video-btn video-btn-icon video-hide-sm"
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts (?)"
              >
                <HelpCircle className="w-5 h-5" />
              </button>

              {/* Server selector */}
              <button
                type="button"
                onClick={() => setShowServerSelector(true)}
                className="video-btn video-btn-icon"
                aria-label={`Server: ${currentSource.name}, ${currentServer + 1} of ${streamingSources.length}`}
                title="Servers (S)"
              >
                <Server className="w-5 h-5" />
              </button>

              {/* Theater / fullscreen */}
              <button
                type="button"
                onClick={toggleTheaterMode}
                className="video-btn video-btn-icon"
                aria-label={isTheaterMode ? "Exit theater / fullscreen" : "Enter theater / fullscreen"}
                title="Theater (F)"
              >
                {isTheaterMode ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={handleClose}
                className="video-btn video-btn-icon is-danger"
                aria-label="Close player"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCommentDialog && (
        <AddCommentDialog
          timestamp={commentTimestamp}
          onSubmit={async (text) => {
            await addComment(commentTimestamp, text);
            setShowCommentDialog(false);
          }}
          onClose={() => setShowCommentDialog(false)}
        />
      )}

      <PaywallGate feature="FlixParty" locked={!hasStandard}>
        <FlixPartySidebar
          isOpen={showPartySidebar}
          onClose={() => setShowPartySidebar(false)}
          roomId={partyRoomId}
          syncStatus={partySyncStatus}
          driftMs={partyDriftMs}
          onLeaveRoom={() => {
            void leavePartyRoom();
            setPartyRoomId(null);
            setPartyRoomKey(null);
            setShowPartySidebar(false);
          }}
          onStartParty={handleStartParty}
          movieId={movieId}
          mediaType={mediaType}
          season={season}
          episode={episode}
          title={title}
          posterPath={posterPath || null}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onSyncToPosition={seekTo}
        />
      </PaywallGate>

      <KeyboardShortcutsHelp isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      <FlixPartyInviteDialog
        isOpen={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        roomCode={partyRoom?.code || (partyRoomId ? partyRoomId.slice(0, 6).toUpperCase() : "")}
        roomUrl={
          partyRoomId && partyRoomKey
            ? buildPartyJoinUrl(partyRoomId, partyRoomKey)
            : typeof window !== "undefined"
              ? `${window.location.origin}/party/join?code=${partyRoom?.code || ""}`
              : ""
        }
      />

      {/* Buffering / seeking indicator (not during normal playback) */}
      {isBuffering && embedState === "ready" && (
        <div className="video-buffering" aria-hidden="true">
          <div className="video-spinner" role="status" aria-label="Buffering" />
        </div>
      )}

      {/* Real caption overlay synced to playback clock */}
      <CaptionOverlay cue={activeCaption} visible={showCaptions && embedState === "ready"} source={captionSource} />
      {showCaptions && captionsLoading && embedState === "ready" && (
        <div className="video-caption" role="status">
          <span className="video-caption-demo">Loading subtitles…</span>
        </div>
      )}

      {/* Stats for nerds */}
      {showStats && embedState === "ready" && (
        <div className="video-stats" role="status" aria-label="Player stats">
          <p className="video-stats-title">Stats for nerds</p>
          <div className="video-stats-row"><span>Time</span><span>{formatTime(currentTime)}</span></div>
          <div className="video-stats-row"><span>Duration</span><span>{formatTime(effectiveDuration)}{liveDuration ? " (live)" : " (est)"}</span></div>
          <div className="video-stats-row"><span>Server</span><span>{currentSource.name}</span></div>
          <div className="video-stats-row"><span>Provider</span><span>{providerName}</span></div>
          <div className="video-stats-row"><span>Sync</span><span>{isLiveSynced ? "Live (postMessage)" : "Estimated clock"}</span></div>
          <div className="video-stats-row"><span>Quality</span><span>{quality}</span></div>
          <div className="video-stats-row"><span>Buffered</span><span>{formatTime(buffered)}</span></div>
        </div>
      )}

      {/* Up Next (autoplay next) */}
      {nearEnd && (
        <div className="video-autonext" role="dialog" aria-label="Up next">
          <div className="video-autonext-head">
            <span className="video-autonext-title">Up Next</span>
            <span className="video-autonext-count">{upNextCount}s</span>
          </div>
          <p className="video-autonext-sub">
            {title} will play automatically. Demo only — advances to the next server.
          </p>
          <div className="video-autonext-actions">
            <button
              type="button"
              className="video-autonext-btn focus-ring press-effect"
              onClick={() => setUpNextDismissed(true)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="video-autonext-btn is-primary focus-ring press-effect"
              onClick={() => {
                setUpNextDismissed(true);
                handleRetry();
              }}
            >
              Play now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayerShell;
