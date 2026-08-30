"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Maximize2, Minimize2, X, Users, LogOut, GripVertical, MessageCircle } from "lucide-react";
import { buildStreamingSources } from "@/lib/streamingSources";
import { usePlaybackClock } from "@/hooks/player/usePlaybackClock";
import { useEmbedBridge } from "@/hooks/player/useEmbedBridge";
import { usePlayerPartySync } from "@/hooks/player/usePlayerPartySync";
import { usePartyLayout } from "@/hooks/player/usePartyLayout";
import { usePlayerWindowDrag } from "@/hooks/player/usePlayerWindowDrag";
import {
  usePlayerWindowResize,
} from "@/hooks/player/usePlayerWindowResize";
import { useVolumeDucking } from "@/hooks/player/useVolumeDucking";
import { useTimelineComments } from "@/hooks/player/useTimelineComments";
import { useAuth } from "@/hooks/useAuth";
import { useLocale } from "@/hooks/useLocale";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { isSpoilerGuardEnabled } from "@/lib/player/spoilerGuard";
import { EmbedFrame } from "./EmbedFrame";
import { PlayerShortcutsDropdown } from "./PlayerShortcutsDropdown";
import { FlixPartySidebar } from "./FlixPartySidebar";
import { FlixPartyInviteDialog } from "./FlixPartyInviteDialog";
import { PartyCameraGrid, PartyCameraPiP } from "./PartyMediaPanel";
import { PartyGuestSplash } from "./PartyGuestSplash";
import { AmbientGlowFrame } from "./AmbientGlowFrame";
import { PlayerOverlayControls } from "./PlayerOverlayControls";
import { AddCommentDialog } from "./AddCommentDialog";
import { UpNextCountdown } from "./UpNextCountdown";
import type { SyncStatus } from "./SyncStatusBadge";
import { trackPlaybackStart } from "@/lib/analytics";
import { releasePageScrollLock } from "@/lib/player/releaseScrollLock";
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
  episodeCount?: number;
  onAdvanceEpisode?: (nextSeason: number, nextEpisode: number) => void;
  initialServer?: number;
  guestJoinMode?: boolean;
}

const LOAD_TIMEOUT_MS = 15_000;

function partyStatusLabel(status: SyncStatus): string {
  switch (status) {
    case "connected":
      return "Party live";
    case "connecting":
      return "Connecting…";
    case "drift":
      return "Re-syncing…";
    case "disconnected":
      return "Party offline";
    default:
      return "Party";
  }
}

function partyStatusClass(status: SyncStatus): string {
  switch (status) {
    case "connected":
      return "player-party-live";
    case "connecting":
    case "drift":
      return "player-party-syncing";
    default:
      return "player-party-offline";
  }
}

export function PlayerShell({
  movieId,
  title,
  onClose,
  mediaType = "movie",
  season,
  episode,
  posterPath,
  resumePosition = 0,
  totalDuration,
  episodeCount,
  onAdvanceEpisode,
  initialServer,
  guestJoinMode = false,
}: PlayerShellProps) {
  const [currentServer, setCurrentServer] = useState(initialServer ?? 0);
  const [embedState, setEmbedState] = useState<"loading" | "ready" | "error">("loading");
  const [showShortcutsMenu, setShowShortcutsMenu] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [liveDuration, setLiveDuration] = useState(0);
  const [showUpNext, setShowUpNext] = useState(false);
  const [commentAt, setCommentAt] = useState<number | null>(null);
  const [cursorIdle, setCursorIdle] = useState(true);
  const cursorIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { user } = useAuth();
  const locale = useLocale();
  const timelineEnabled = isFeatureEnabled("timeline-comments");
  const glowEnabled = isFeatureEnabled("ambient-glow");

  const autoFailoverRef = useRef(0);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const playerDrag = usePlayerWindowDrag(shellRef, windowRef);

  const streamingSources = useMemo(
    () =>
      buildStreamingSources(movieId, mediaType, season, episode, {
        lang: locale === "sq" ? "sq" : undefined,
        title,
      }),
    [movieId, mediaType, season, episode, locale, title]
  );
  const currentSource = streamingSources[currentServer];
  const effectiveDuration = liveDuration || totalDuration || 120 * 60;

  const { currentTime, seekTo, syncTo } = usePlaybackClock({
    movieId,
    mediaType,
    title,
    posterPath: posterPath || null,
    season,
    episode,
    initialPosition: resumePosition,
    totalDuration: effectiveDuration,
    isPlaying: embedState === "ready",
  });

  const nextEpisode = useMemo(() => {
    if (mediaType !== "tv" || !season || !episode) return null;
    if (episodeCount && episode < episodeCount) {
      return { season, episode: episode + 1 };
    }
    return { season: season + 1, episode: 1 };
  }, [mediaType, season, episode, episodeCount]);

  const handleEnded = useCallback(() => {
    if (mediaType === "tv" && onAdvanceEpisode && nextEpisode) {
      setShowUpNext(true);
    }
  }, [mediaType, onAdvanceEpisode, nextEpisode]);

  const {
    isPlaying,
    volume,
    togglePlay,
    toggleMute,
    adjustVolume,
    setVolume,
    seek,
    seekRelative,
    setReady,
    setPlaying,
    play,
    pause,
    isLiveSynced,
  } = useEmbedBridge({
    iframeRef,
    enabled: embedState === "ready",
    totalDuration: effectiveDuration,
    onTimeUpdate: (time) => syncTo(time),
    onDurationChange: (duration) => setLiveDuration(duration),
    onEnded: handleEnded,
  });

  const timeline = useTimelineComments({
    tmdbId: movieId,
    enabled: timelineEnabled && embedState === "ready",
  });

  const overlayMarkers = useMemo(() => {
    const markers = timeline.getMarkers(effectiveDuration);
    if (!isSpoilerGuardEnabled()) return markers;
    return markers.filter((m) => m.timestamp <= currentTime + 1);
  }, [timeline.getMarkers, timeline.comments, effectiveDuration, currentTime]);

  const overlayNearby = useMemo(() => {
    const near = timeline.getCommentsNear(currentTime, 8);
    if (!isSpoilerGuardEnabled()) return near;
    return near.filter((c) => c.timestampSeconds <= currentTime + 1);
  }, [timeline.getCommentsNear, timeline.comments, currentTime]);

  const party = usePlayerPartySync({
    movieId,
    mediaType,
    season,
    episode,
    currentServer,
    currentSourceUrl: currentSource.id,
    currentSourceProviderUrl: currentSource.providerUrl,
    currentTime,
    isPlaying,
    embedReady: embedState === "ready",
    embedLiveSynced: isLiveSynced,
    iframeRef,
    setPlaying,
    playEmbed: play,
    pauseEmbed: pause,
    seekEmbed: seek,
    seekTo,
    seekRelative,
    guestJoinMode,
  });

  const { media, guestServerIndex } = party;
  const layout = usePartyLayout();
  const guestServerAppliedRef = useRef(false);
  const mobilePartyPreparedRef = useRef(false);

  const inParty = !!party.partyRoomId;
  const isMobile = layout.isMobile;

  const playerResize = usePlayerWindowResize(shellRef, windowRef, {
    enabled: !isMobile,
    isFloating: playerDrag.isFloating,
    position: playerDrag.position,
    onPositionChange: playerDrag.setPosition,
  });
  const mobilePartyExpanded = layout.partyPanelMode === "expanded";
  const mobilePartyMinimized =
    layout.partyPanelMode === "minimized" || layout.partyPanelMode === "closed";

  const showPartyPanelDesktop =
    party.showPartyPanel && (!inParty || layout.showPartyPanel) && !party.guestSplashVisible;

  const showPartyPanelMobile =
    party.showPartyPanel && !party.guestSplashVisible;

  const showPartyPanel = isMobile ? showPartyPanelMobile : showPartyPanelDesktop;

  const effectiveCameraLayout = layout.effectiveCameraLayout;
  const showCameras =
    inParty && layout.showCameras && effectiveCameraLayout !== "hidden" && !isMobile;
  const showMobileCameraPiP =
    isMobile &&
    inParty &&
    media.cameraOn &&
    effectiveCameraLayout !== "hidden" &&
    media.participants.some((p) => p.hasVideo);

  const cycleLayoutFocus = useCallback(() => {
    layout.cycleFocusLevel();
  }, [layout]);

  const switchServer = useCallback((index: number) => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    autoFailoverRef.current = 0;
    setCurrentServer(index);
    setEmbedState("loading");
    setLiveDuration(0);
    setPlaying(true);
    setReady(false);
  }, [setPlaying, setReady]);

  useEffect(() => {
    if (guestServerIndex === null || guestServerAppliedRef.current || party.isPartyHost) return;
    if (guestServerIndex < 0 || guestServerIndex >= streamingSources.length) return;
    guestServerAppliedRef.current = true;
    if (guestServerIndex !== currentServer) {
      switchServer(guestServerIndex);
    }
  }, [guestServerIndex, party.isPartyHost, currentServer, streamingSources.length, switchServer]);

  useVolumeDucking({
    enabled: !!party.partyRoomId && (media.micOn || media.anyoneSpeaking),
    anyoneSpeaking: media.anyoneSpeaking,
    baseVolume: volume,
    setVolume,
  });

  const cameraLayout = inParty && showCameras;

  const nextServer = useCallback(() => {
    switchServer((currentServer + 1) % streamingSources.length);
  }, [currentServer, streamingSources.length, switchServer]);

  const prevServer = useCallback(() => {
    switchServer((currentServer - 1 + streamingSources.length) % streamingSources.length);
  }, [currentServer, streamingSources.length, switchServer]);

  const handleClose = useCallback(() => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    }
    releasePageScrollLock();
    onClose();
  }, [onClose]);

  const toggleExpanded = cycleLayoutFocus;

  const handleLeaveParty = useCallback(() => {
    void party.handleLeaveParty();
    party.resetPartySession();
    layout.resetFocusLevel();
    layout.resetPartyPanelMode();
    party.setShowPartyPanel(false);
  }, [party, layout]);

  const togglePartyPanel = useCallback(() => {
    if (!party.showPartyPanel) party.resetPartySession();

    if (isMobile && inParty) {
      if (mobilePartyExpanded) {
        layout.minimizePartyPanel();
      } else {
        layout.expandPartyPanel();
        party.setShowInviteDialog(false);
      }
      party.setShowPartyPanel(true);
      return;
    }

    party.setShowPartyPanel((p) => !p);
    if (!party.showPartyPanel) {
      party.setShowInviteDialog(false);
    }
  }, [party, layout, isMobile, inParty, mobilePartyExpanded]);

  const minimizePartyPanel = useCallback(() => {
    layout.minimizePartyPanel();
  }, [layout]);

  const closePartyPanel = useCallback(() => {
    if (isMobile) {
      layout.minimizePartyPanel();
      return;
    }
    party.setShowPartyPanel(false);
  }, [party, layout, isMobile]);

  useEffect(() => {
    if (!inParty || mobilePartyPreparedRef.current) return;
    mobilePartyPreparedRef.current = true;
    layout.prepareMobilePartyJoin();
  }, [inParty, layout]);

  useEffect(() => {
    setShowUpNext(false);
    setCommentAt(null);
  }, [movieId, season, episode]);

  useEffect(() => {
    if (mediaType !== "tv" || !onAdvanceEpisode || !nextEpisode || effectiveDuration <= 0) return;
    if (embedState !== "ready") return;
    if (currentTime >= Math.max(1, effectiveDuration - 1.25)) {
      setShowUpNext(true);
    }
  }, [mediaType, onAdvanceEpisode, nextEpisode, effectiveDuration, embedState, currentTime]);

  const playNextEpisode = useCallback(() => {
    if (!nextEpisode || !onAdvanceEpisode) return;
    setShowUpNext(false);
    onAdvanceEpisode(nextEpisode.season, nextEpisode.episode);
  }, [nextEpisode, onAdvanceEpisode]);

  const seekOverlay = useCallback(
    (seconds: number) => {
      seek(seconds);
      syncTo(seconds);
      party.broadcastPartySeek(seconds);
    },
    [seek, syncTo, party]
  );

  const openCommentAt = useCallback(
    (timestamp: number) => {
      if (!user) return;
      setCommentAt(Math.floor(timestamp));
    },
    [user]
  );

  useEffect(() => {
    if (!inParty) {
      mobilePartyPreparedRef.current = false;
      layout.resetPartyPanelMode();
    }
  }, [inParty, layout]);

  useEffect(() => {
    if (isMobile && party.showInviteDialog) {
      layout.closePartyPanel();
      party.setShowPartyPanel(false);
    }
  }, [isMobile, party.showInviteDialog, layout, party]);

  useEffect(() => {
    if (isMobile && inParty && party.showPartyPanel && layout.partyPanelMode === "closed") {
      layout.minimizePartyPanel();
    }
  }, [isMobile, inParty, party.showPartyPanel, layout.partyPanelMode, layout]);

  // Fix floating video spawning in middle: when party opens, recenter to default flex layout
  const isFloating = playerDrag.isFloating;
  useEffect(() => {
    if ((showPartyPanel || inParty) && isFloating) {
      playerDrag.resetPosition();
      playerResize.resetSize();
    }
  }, [showPartyPanel, inParty, isFloating, playerDrag, playerResize]);

  const toggleBrowserFullscreen = useCallback(async () => {
    const el = windowRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      }
    } catch {
      // ignore
    }
  }, []);

  const seekToPercent = useCallback(
    (percent: number) => {
      if (embedState !== "ready" || effectiveDuration <= 0) return;
      const seconds = (percent / 100) * effectiveDuration;
      seek(seconds);
      syncTo(seconds);
      // Broadcast seek to all party guests immediately
      party.broadcastPartySeek(seconds);
    },
    [embedState, effectiveDuration, seek, syncTo, party]
  );

  const togglePlayPause = useCallback(() => {
    if (embedState !== "ready") return;
    togglePlay();
    party.broadcastPartyState(!isPlaying ? "playing" : "paused", currentTime);
  }, [embedState, togglePlay, isPlaying, currentTime, party]);

  useEffect(() => {
    const el = windowRef.current;
    if (!el) return;

    const markMoving = () => {
      setCursorIdle(false);
      if (cursorIdleTimerRef.current) clearTimeout(cursorIdleTimerRef.current);
      cursorIdleTimerRef.current = setTimeout(() => setCursorIdle(true), 2000);
    };

    el.addEventListener("mousemove", markMoving);
    el.addEventListener("pointerdown", markMoving);
    el.addEventListener("touchstart", markMoving, { passive: true });

    return () => {
      el.removeEventListener("mousemove", markMoving);
      el.removeEventListener("pointerdown", markMoving);
      el.removeEventListener("touchstart", markMoving);
      if (cursorIdleTimerRef.current) clearTimeout(cursorIdleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const hintTimer = setTimeout(() => setShowHint(false), 10000);

    return () => {
      clearTimeout(hintTimer);
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      releasePageScrollLock();
    };
  }, []);

  useEffect(() => {
    setEmbedState("loading");
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = setTimeout(() => {
      if (autoFailoverRef.current < streamingSources.length - 1) {
        autoFailoverRef.current += 1;
        setLiveDuration(0);
        setReady(false);
        setCurrentServer((prev) => (prev + 1) % streamingSources.length);
        return;
      }
      setEmbedState("error");
    }, LOAD_TIMEOUT_MS);
    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, [currentServer, streamingSources.length, setReady]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (showShortcutsMenu && e.key === "Escape") {
        e.preventDefault();
        setShowShortcutsMenu(false);
        return;
      }

      const handled = [
        " ", "k", "K", "m", "M", "t", "T", "f", "F", "g", "G", "v", "V", "p", "P",
        "c", "C",
        "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
        "n", "N", "]", "[", "?", "/", "+", "=", "-", "_",
        "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
        "Escape",
      ];
      if (handled.includes(e.key)) e.preventDefault();

      if (e.key === "Escape") {
        if (commentAt !== null) {
          setCommentAt(null);
          return;
        }
        if (showUpNext) {
          setShowUpNext(false);
          return;
        }
        if (showShortcutsMenu) {
          setShowShortcutsMenu(false);
          return;
        }
        if (party.showPartyPanel) {
          if (isMobile && mobilePartyExpanded) {
            layout.minimizePartyPanel();
          } else {
            party.setShowPartyPanel(false);
            layout.closePartyPanel();
          }
          return;
        }
        if (document.fullscreenElement) {
          void document.exitFullscreen();
          return;
        }
        if (layout.focusLevel > 0) {
          layout.resetFocusLevel();
          return;
        }
        handleClose();
        return;
      }
      if (e.key === "?" || e.key === "/") {
        setShowShortcutsMenu((p) => !p);
        return;
      }
      if (e.key === "g" || e.key === "G") {
        if (isFeatureEnabled("flixparty")) {
          togglePartyPanel();
        }
        return;
      }
      if (e.key === "v" || e.key === "V") {
        if (party.partyRoomId && isFeatureEnabled("flixparty")) {
          void media.toggleCamera();
        }
        return;
      }
      if (e.key === "p" || e.key === "P") {
        if (party.partyRoomId && isFeatureEnabled("flixparty")) {
          void media.toggleMic();
        }
        return;
      }
      if (e.key === "t" || e.key === "T") {
        toggleExpanded();
        return;
      }
      if (e.key === "f" || e.key === "F") {
        void toggleBrowserFullscreen();
        return;
      }
      if (embedState !== "ready") {
        if (e.key === "n" || e.key === "N" || e.key === "]") nextServer();
        if (e.key === "[") prevServer();
        return;
      }

      if (e.key === " " || e.key === "k" || e.key === "K") togglePlayPause();
      else if (e.key === "m" || e.key === "M") toggleMute();
      else if (e.key === "ArrowLeft") {
        const delta = e.shiftKey ? -30 : -10;
        const newTime = seekRelative(delta);
        party.broadcastPartySeek(newTime);
      }
      else if (e.key === "ArrowRight") {
        const delta = e.shiftKey ? 30 : 10;
        const newTime = seekRelative(delta);
        party.broadcastPartySeek(newTime);
      }
      else if (e.key === "ArrowUp") adjustVolume(e.shiftKey ? 0.2 : 0.1);
      else if (e.key === "ArrowDown") adjustVolume(e.shiftKey ? -0.2 : -0.1);
      else if (e.key === "+" || e.key === "=") adjustVolume(0.1);
      else if (e.key === "-" || e.key === "_") adjustVolume(-0.1);
      else if (e.key === "c" || e.key === "C") openCommentAt(currentTime);
      else if (e.key === "n" || e.key === "N" || e.key === "]") nextServer();
      else if (e.key === "[") prevServer();
      else if (/^[0-9]$/.test(e.key)) seekToPercent(parseInt(e.key, 10) * 10);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    embedState,
    handleClose,
    togglePlayPause,
    toggleMute,
    adjustVolume,
    seekRelative,
    toggleExpanded,
    toggleBrowserFullscreen,
    nextServer,
    prevServer,
    seekToPercent,
    showShortcutsMenu,
    layout,
    party,
    media,
    isMobile,
    mobilePartyExpanded,
    togglePartyPanel,
    commentAt,
    showUpNext,
    openCommentAt,
    currentTime,
  ]);

  const onIframeLoad = () => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    autoFailoverRef.current = 0;
    setEmbedState("ready");
    setReady(true);
    trackPlaybackStart(movieId, mediaType, currentSource.id);
  };

  const onIframeError = () => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setEmbedState("error");
    setReady(false);
  };

  const flixPartyEnabled = isFeatureEnabled("flixparty");

  const shellClasses = [
    "player-shell",
    showPartyPanel ? "player-shell--party-open" : "",
    isMobile && mobilePartyExpanded ? "player-shell--party-expanded" : "",
    isMobile && mobilePartyMinimized && !mobilePartyExpanded ? "player-shell--party-minimized" : "",
    cameraLayout ? "player-shell--camera" : "",
    `player-shell--boost-${layout.focusLevel}`,
    inParty ? `player-shell--cam-${effectiveCameraLayout}` : "",
    party.guestSplashVisible ? "player-shell--guest-splash" : "",
    isMobile ? "player-shell--mobile" : "",
    playerDrag.isFloating ? "player-shell--window-floating" : "",
    playerDrag.isDragging ? "player-shell--window-dragging" : "",
    playerResize.isResizing ? "player-shell--window-resizing" : "",
    playerResize.isCustomSize ? "player-shell--window-custom-size" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={shellRef}
      className={shellClasses}
      role="dialog"
      aria-label={`Watching ${title}`}
    >
      <PartyGuestSplash
        phase={party.guestSplashPhase}
        title={title}
        hostName={party.guestJoinHostName}
        driftMs={party.partyDriftMs}
        visible={party.guestSplashVisible}
      />
      <div className={`player-layout ${cameraLayout ? "player-layout--camera" : ""} ${inParty ? `player-layout--cam-${effectiveCameraLayout}` : ""}`}>
        {glowEnabled && (
          <AmbientGlowFrame
            posterPath={posterPath || null}
            isActive={embedState === "ready"}
          />
        )}
        <div className="player-layout-main">
          <div
            ref={windowRef}
            style={{ ...playerDrag.windowStyle, ...playerResize.sizeStyle }}
            className={`player-window is-framed player-window--boost-${layout.focusLevel} ${playerDrag.isFloating ? "is-floating" : ""} ${playerDrag.isDragging ? "is-dragging" : ""} ${playerResize.isResizing ? "is-resizing" : ""} ${playerResize.isCustomSize ? "is-custom-size" : ""}`}
          >
          <header className="player-window-bar">
            <div
              className="player-window-drag-zone"
              onPointerDown={playerDrag.onDragZonePointerDown}
              onDoubleClick={() => {
                playerDrag.resetPosition();
                playerResize.resetSize();
              }}
              title="Drag anywhere here to move · double-click to re-center"
            >
              <span className="player-window-drag-grip" aria-hidden>
                <GripVertical className="w-3.5 h-3.5" />
              </span>
              <div className="player-window-meta">
                <p className="player-window-title">{title}</p>
                <p className="player-window-sub">
                  {currentSource.name} · {currentServer + 1}/{streamingSources.length}
                  {party.partyRoomId && (
                    <span className={partyStatusClass(party.partySyncStatus)}>
                      {" "}
                      · {partyStatusLabel(party.partySyncStatus)}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div
              className="player-window-actions"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {flixPartyEnabled && inParty && (
                <button
                  type="button"
                  className="player-window-btn player-window-btn--leave"
                  onClick={handleLeaveParty}
                  aria-label={party.isPartyHost ? "End party for everyone" : "Leave party"}
                  title={party.isPartyHost ? "End party for all" : "Leave party"}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
              {flixPartyEnabled && (
                <button
                  type="button"
                  className={`player-window-btn ${party.showPartyPanel ? "is-active" : ""}`}
                  onClick={togglePartyPanel}
                  aria-label="Watch together"
                  aria-pressed={party.showPartyPanel}
                  title="Watch together (G)"
                >
                  <Users className="w-4 h-4" />
                </button>
              )}
              {timelineEnabled && (
                <button
                  type="button"
                  className="player-window-btn"
                  onClick={() => openCommentAt(currentTime)}
                  aria-label="Add comment at current time"
                  title="Add comment (C)"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
              )}
              <PlayerShortcutsDropdown
                open={showShortcutsMenu}
                onToggle={() => setShowShortcutsMenu((p) => !p)}
                onClose={() => setShowShortcutsMenu(false)}
              />
              <button
                type="button"
                className="player-window-btn"
                onClick={cycleLayoutFocus}
                aria-label={`Video size: ${layout.focusLabel}. Click to make bigger.`}
                title={`Size: ${layout.focusLabel} — click to enlarge (T)`}
              >
                {layout.isMaxBoost ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                className="player-window-btn player-window-btn--close"
                onClick={handleClose}
                aria-label="Close player"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          <div
            className="player-window-body"
            style={playerResize.bodyHeight ? { height: playerResize.bodyHeight, aspectRatio: "auto" } : undefined}
          >
            <EmbedFrame
              currentSource={currentSource}
              currentServer={currentServer}
              streamingSourcesCount={streamingSources.length}
              embedState={embedState}
              title={title}
              iframeRef={iframeRef}
              onIframeLoad={onIframeLoad}
              onIframeError={onIframeError}
              onRetry={nextServer}
            />
            {timelineEnabled && embedState === "ready" && !showUpNext && (
              <div
                className={`player-overlay-bar ${cursorIdle ? "is-cursor-idle" : "is-cursor-active"}`}
                aria-hidden={!cursorIdle}
              >
                <PlayerOverlayControls
                  currentTime={currentTime}
                  totalDuration={effectiveDuration}
                  markers={overlayMarkers}
                  nearbyComments={overlayNearby}
                  onSeek={seekOverlay}
                  onAddComment={openCommentAt}
                  onLikeComment={(id) => {
                    void timeline.likeComment(id);
                  }}
                  isPlaying={isPlaying}
                  controlsVisible={cursorIdle}
                />
              </div>
            )}
            {showUpNext && nextEpisode && onAdvanceEpisode && (
              <UpNextCountdown
                nextEpisode={nextEpisode}
                posterPath={posterPath || null}
                onPlay={playNextEpisode}
                onSkip={() => setShowUpNext(false)}
              />
            )}
          </div>

          {showHint && embedState === "ready" && (
            <p className="player-hint" aria-live="polite">
              T maximize · C comment · G watch together · ? shortcuts
            </p>
          )}

          {!isMobile &&
            playerResize.visibleHandles.map((handle) => (
              <div
                key={handle}
                className={`player-resize-handle player-resize-handle--${handle}`}
                onPointerDown={playerResize.onResizeHandlePointerDown(handle)}
                role="presentation"
                aria-hidden
              />
            ))}
        </div>

        {cameraLayout && (
          <PartyCameraGrid
            participants={media.participants}
            voiceVolume={media.voiceVolume}
            roomParticipants={party.partyRoom?.participants}
            hostId={party.partyRoom?.hostId}
            layoutMode={effectiveCameraLayout}
            onLayoutChange={layout.setCameraLayout}
          />
        )}
        </div>

        {showMobileCameraPiP && (
          <PartyCameraPiP
            participants={media.participants}
            voiceVolume={media.voiceVolume}
            roomParticipants={party.partyRoom?.participants}
            hostId={party.partyRoom?.hostId}
            expanded={mobilePartyExpanded}
          />
        )}

        {flixPartyEnabled && showPartyPanel && (
          <FlixPartySidebar
            embedded
            isOpen={showPartyPanel}
            onClose={closePartyPanel}
            isMobile={isMobile}
            mobileExpanded={!isMobile || mobilePartyExpanded}
            onMinimize={minimizePartyPanel}
            roomId={party.partyRoomId}
            syncStatus={party.partySyncStatus}
            driftMs={party.partyDriftMs}
            onLeaveRoom={handleLeaveParty}
            isHost={party.isPartyHost}
            onStartParty={party.handleStartParty}
            movieId={movieId}
            mediaType={mediaType}
            season={season}
            episode={episode}
            title={title}
            posterPath={posterPath || null}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onSyncToPosition={seekTo}
            partyJoinUrl={party.partyJoinUrl}
            media={media}
            partyRoom={party.partyRoom}
            partyMessages={party.partyMessages}
            sendPartyMessage={party.sendPartyMessage}
            kickParticipant={party.kickParticipant}
            setParticipantMicMuted={party.setParticipantMicMuted}
            setParticipantCamDisabled={party.setParticipantCamDisabled}
          />
        )}
      </div>

      {party.showInviteDialog && party.partyJoinUrl && !showPartyPanel && (
        <FlixPartyInviteDialog
          isOpen={party.showInviteDialog}
          onClose={() => {
            party.setShowInviteDialog(false);
            if (isMobile && inParty) {
              party.setShowPartyPanel(true);
              layout.minimizePartyPanel();
            }
          }}
          roomCode={party.partyRoomCode}
          roomUrl={party.partyJoinUrl}
        />
      )}

      {isMobile && inParty && !showPartyPanel && !party.showInviteDialog && (
        <button
          type="button"
          className="player-party-fab"
          onClick={() => {
            party.setShowPartyPanel(true);
            layout.expandPartyPanel();
          }}
          aria-label="Open watch together panel"
          title="Watch together"
        >
          <Users className="w-5 h-5" />
          {party.partyMessages.length > 0 && (
            <span className="player-party-fab-badge" aria-hidden />
          )}
        </button>
      )}

      {commentAt !== null && (
        <AddCommentDialog
          timestamp={commentAt}
          onClose={() => setCommentAt(null)}
          onSubmit={async (text) => {
            await timeline.addComment(commentAt, text);
            setCommentAt(null);
          }}
        />
      )}
    </div>
  );
}

export default PlayerShell;
