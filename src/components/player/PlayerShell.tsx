"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { buildStreamingSources } from "@/lib/streamingSources";
import { sendEmbedAction, isPlayerShortcutKey } from "@/lib/playerEmbedControls";
import { usePlaybackClock } from "@/hooks/player/usePlaybackClock";
import { useTimelineComments } from "@/hooks/player/useTimelineComments";
import { useAuth } from "@/hooks/useAuth";
import { EmbedFrame } from "./EmbedFrame";
import { PlayerChrome } from "./PlayerChrome";
import { AmbientGlowFrame } from "./AmbientGlowFrame";
import { FlixPartySidebar } from "./FlixPartySidebar";
import { FlixPartyInviteDialog } from "./FlixPartyInviteDialog";
import { PlayerOverlayControls } from "./PlayerOverlayControls";
import { AddCommentDialog } from "./AddCommentDialog";
import { getImageUrl } from "@/utils/tmdbApi";
import { Users, MessageCircle } from "lucide-react";

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
const HELP_PROMPT_DELAY_MS = 6_000;

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
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isCinematic, setIsCinematic] = useState(false);
  const [embedState, setEmbedState] = useState<"loading" | "ready" | "error">("loading");
  const [showHelpPrompt, setShowHelpPrompt] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playState, setPlayState] = useState<"playing" | "paused">("playing");
  const [flashIcon, setFlashIcon] = useState<"play" | "pause" | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // FlixParty state
  const [showPartySidebar, setShowPartySidebar] = useState(false);
  const [partyRoomId, setPartyRoomId] = useState<string | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  // Timeline comments state
  const [showTimelineControls, setShowTimelineControls] = useState(false);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [commentTimestamp, setCommentTimestamp] = useState(0);

  const { user } = useAuth();

  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const helpPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Initialize playback clock
  const { currentTime, seekTo } = usePlaybackClock({
    movieId,
    mediaType,
    title,
    posterPath: posterPath || null,
    season,
    episode,
    initialPosition: resumePosition,
    totalDuration,
    isPlaying: playState === "playing" && embedState === "ready",
  });

  // Initialize timeline comments
  const effectiveDuration = totalDuration || 120 * 60;
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

  const clearTimers = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    if (helpPromptTimerRef.current) clearTimeout(helpPromptTimerRef.current);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, []);

  const showFlash = useCallback((icon: "play" | "pause") => {
    setFlashIcon(icon);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashIcon(null), 700);
  }, []);

  const bumpControls = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => setControlsVisible(false), 4000);
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
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      }
    } catch {
      // Fullscreen blocked
    }
  }, []);

  const exitContainerFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) return;
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleTheaterMode = useCallback(async () => {
    const entering = !isTheaterMode;
    setIsTheaterMode(entering);
    bumpControls();

    if (entering) {
      requestAnimationFrame(() => {
        void requestContainerFullscreen();
      });
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
    setPlayState("playing");
    setIsMuted(false);
  }, [clearTimers]);

  const handleRetry = useCallback(() => {
    switchServer((currentServer + 1) % streamingSources.length);
  }, [currentServer, streamingSources.length, switchServer]);

  const togglePlayPause = useCallback(() => {
    if (embedState !== "ready") return;
    const next = playState === "playing" ? "paused" : "playing";
    setPlayState(next);
    showFlash(next === "paused" ? "pause" : "play");
    sendEmbedAction(iframeRef.current, next === "paused" ? "pause" : "play");
    bumpControls();
  }, [embedState, playState, showFlash, bumpControls]);

  const toggleMute = useCallback(() => {
    if (embedState !== "ready") return;
    setIsMuted((m) => !m);
    sendEmbedAction(iframeRef.current, "mute");
    bumpControls();
  }, [embedState, bumpControls]);

  const seek = useCallback((direction: "back" | "forward") => {
    if (embedState !== "ready") return;
    sendEmbedAction(iframeRef.current, direction === "back" ? "seekBack" : "seekForward");
    const delta = direction === "back" ? -10 : 10;
    seekTo(currentTime + delta);
    bumpControls();
  }, [embedState, seekTo, currentTime, bumpControls]);

  const reloadStream = useCallback(() => {
    if (embedState !== "ready") return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const src = iframe.src;
    iframe.src = "";
    iframe.src = src;
    setPlayState("playing");
    bumpControls();
  }, [embedState, bumpControls]);

  const prevServer = useCallback(() => {
    switchServer((currentServer - 1 + streamingSources.length) % streamingSources.length);
  }, [currentServer, streamingSources.length, switchServer]);

  const startLoadTimeout = useCallback(() => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = setTimeout(() => {
      setEmbedState("error");
      setShowHelpPrompt(false);
    }, LOAD_TIMEOUT_MS);
  }, []);

  const scheduleHelpPrompt = useCallback(() => {
    if (helpPromptTimerRef.current) clearTimeout(helpPromptTimerRef.current);
    helpPromptTimerRef.current = setTimeout(() => {
      setShowHelpPrompt(true);
    }, HELP_PROMPT_DELAY_MS);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showServerSelector || showShortcuts) {
        if (e.key === "Escape") return;
        return;
      }

      if (isPlayerShortcutKey(e.key)) {
        e.preventDefault();
      }

      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          void exitContainerFullscreen();
          setIsTheaterMode(false);
          bumpControls();
          return;
        }
        if (isTheaterMode) {
          void toggleTheaterMode();
          return;
        }
        handleClose();
        return;
      }

      if (e.key === " " || e.key === "p" || e.key === "P" || e.key === "k" || e.key === "K") {
        togglePlayPause();
        return;
      }
      if (e.key === "f" || e.key === "F" || e.key === "t" || e.key === "T") {
        void toggleTheaterMode();
        return;
      }
      if (e.key === "m" || e.key === "M") {
        toggleMute();
        return;
      }
      if (e.key === "c" || e.key === "C") {
        setIsCinematic((p) => !p);
        bumpControls();
        return;
      }
      if (e.key === "n" || e.key === "N" || e.key === "]") {
        handleRetry();
        bumpControls();
        return;
      }
      if (e.key === "[") {
        prevServer();
        bumpControls();
        return;
      }
      if (e.key === "s" || e.key === "S") {
        setShowServerSelector((p) => !p);
        bumpControls();
        return;
      }
      if (e.key === "r" || e.key === "R") {
        reloadStream();
        return;
      }
      if (e.key === "ArrowLeft") {
        seek("back");
        return;
      }
      if (e.key === "ArrowRight") {
        seek("forward");
        return;
      }
      if (e.key === "ArrowUp") {
        sendEmbedAction(iframeRef.current, "volumeUp");
        bumpControls();
        return;
      }
      if (e.key === "ArrowDown") {
        sendEmbedAction(iframeRef.current, "volumeDown");
        bumpControls();
        return;
      }
      if (e.key === "?") {
        setShowShortcuts((p) => !p);
        return;
      }
      if (e.key === "g" || e.key === "G") {
        setShowPartySidebar((p) => !p);
        bumpControls();
        return;
      }
      if (e.key === "l" || e.key === "L") {
        setShowTimelineControls((p) => !p);
        bumpControls();
        return;
      }
      bumpControls();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    handleClose,
    handleRetry,
    prevServer,
    reloadStream,
    seek,
    toggleMute,
    togglePlayPause,
    bumpControls,
    isTheaterMode,
    toggleTheaterMode,
    exitContainerFullscreen,
    showServerSelector,
    showShortcuts,
  ]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === containerRef.current;
      if (!active && isTheaterMode) {
        setIsTheaterMode(false);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [isTheaterMode]);

  useEffect(() => {
    bumpControls();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [bumpControls]);

  useEffect(() => {
    setEmbedState("loading");
    setShowHelpPrompt(false);
    startLoadTimeout();
    return () => clearTimers();
  }, [currentServer, startLoadTimeout, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const onIframeLoad = () => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setEmbedState("ready");
    scheduleHelpPrompt();
  };

  const onIframeError = () => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setEmbedState("error");
    setShowHelpPrompt(false);
  };

  const statusLabel =
    embedState === "loading"
      ? `Connecting to ${currentSource.name}…`
      : embedState === "error"
        ? "Stream unavailable"
        : `Streaming via ${currentSource.name}`;

  return (
    <div
      ref={containerRef}
      className={`player-shell fixed inset-0 z-[9999] bg-black flex flex-col ${isTheaterMode ? "player-theater" : ""}`}
      onMouseMove={bumpControls}
      onTouchStart={bumpControls}
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
        statusLabel={statusLabel}
        currentSource={currentSource}
        currentServer={currentServer}
        streamingSources={streamingSources}
        isTheaterMode={isTheaterMode}
        isCinematic={isCinematic}
        playState={playState}
        isMuted={isMuted}
        showServerSelector={showServerSelector}
        showShortcuts={showShortcuts}
        handleClose={handleClose}
        setShowShortcuts={setShowShortcuts}
        togglePlayPause={togglePlayPause}
        setShowServerSelector={setShowServerSelector}
        toggleTheaterMode={toggleTheaterMode}
        prevServer={prevServer}
        seek={seek}
        toggleMute={toggleMute}
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
        playState={playState}
        title={title}
        iframeRef={iframeRef}
        onIframeLoad={onIframeLoad}
        onIframeError={onIframeError}
        handleRetry={handleRetry}
        setShowHelpPrompt={setShowHelpPrompt}
        isTheaterMode={isTheaterMode}
        isCinematic={isCinematic}
      />

      {/* Player feature buttons - bottom left */}
      {embedState === "ready" && controlsVisible && (
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTimelineControls((p) => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm border transition-colors ${
              showTimelineControls
                ? "bg-red-600/80 border-red-500/50 text-white"
                : "bg-white/10 border-white/10 text-gray-300 hover:bg-white/20"
            }`}
            title="Timeline comments (L)"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {comments.length > 0 && (
              <span className="tabular-nums">{comments.length}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowPartySidebar((p) => !p);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm border transition-colors ${
              showPartySidebar
                ? "bg-purple-600/80 border-purple-500/50 text-white"
                : "bg-white/10 border-white/10 text-gray-300 hover:bg-white/20"
            }`}
            title="FlixParty (G)"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Party</span>
          </button>
        </div>
      )}

      {/* Timeline comment overlay controls */}
      {showTimelineControls && embedState === "ready" && (
        <PlayerOverlayControls
          currentTime={currentTime}
          totalDuration={effectiveDuration}
          markers={commentMarkers}
          nearbyComments={nearbyComments}
          onSeek={(seconds) => {
            seekTo(seconds);
            sendEmbedAction(iframeRef.current, "seekForward");
          }}
          onAddComment={(timestamp) => {
            setCommentTimestamp(timestamp);
            setShowCommentDialog(true);
          }}
          onLikeComment={likeComment}
          isPlaying={playState === "playing"}
          controlsVisible={controlsVisible}
        />
      )}

      {/* Add comment dialog */}
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

      {/* FlixParty Sidebar */}
      <FlixPartySidebar
        isOpen={showPartySidebar}
        onClose={() => setShowPartySidebar(false)}
        roomId={partyRoomId}
        syncStatus="connected"
        onLeaveRoom={() => {
          setPartyRoomId(null);
          setShowPartySidebar(false);
        }}
      />

      {/* FlixParty Invite Dialog */}
      <FlixPartyInviteDialog
        isOpen={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        roomCode={partyRoomId ? partyRoomId.slice(0, 6).toUpperCase() : ""}
        roomUrl={
          typeof window !== "undefined"
            ? `${window.location.origin}/party/join?code=${partyRoomId?.slice(0, 6).toUpperCase() || ""}`
            : ""
        }
      />
    </div>
  );
}
export default PlayerShell;
