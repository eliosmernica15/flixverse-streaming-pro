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
  const [playState, setPlayState] = useState<"playing" | "paused">("playing");
  const [flashIcon, setFlashIcon] = useState<"play" | "pause" | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showCenterPlay, setShowCenterPlay] = useState(false);
  const [seekIndicator, setSeekIndicator] = useState<"back" | "forward" | null>(null);

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
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const centerPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    if (seekIndicatorTimerRef.current) clearTimeout(seekIndicatorTimerRef.current);
    if (centerPlayTimerRef.current) clearTimeout(centerPlayTimerRef.current);
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
    showSeekIndicator(direction);
    bumpControls();
  }, [embedState, seekTo, currentTime, bumpControls, showSeekIndicator]);

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

  // Double-tap seek on mobile
  const handleTap = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    const timeSince = now - lastTapRef.current;
    lastTapRef.current = now;

    if (timeSince < 300 && timeSince > 0) {
      // Double tap — seek based on tap position
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.touches[0].clientX - rect.left;
      const isLeftHalf = x < rect.width / 2;
      seek(isLeftHalf ? "back" : "forward");
    } else {
      // Single tap — toggle controls with center play indicator
      if (controlsVisible) {
        setControlsVisible(false);
      } else {
        bumpControls();
        setShowCenterPlay(true);
        if (centerPlayTimerRef.current) clearTimeout(centerPlayTimerRef.current);
        centerPlayTimerRef.current = setTimeout(() => setShowCenterPlay(false), 1200);
      }
    }
  }, [controlsVisible, bumpControls, seek]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showServerSelector) {
        if (e.key === "Escape") setShowServerSelector(false);
        return;
      }

      if (isPlayerShortcutKey(e.key)) e.preventDefault();

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
      if (e.key === " " || e.key === "k" || e.key === "K") { togglePlayPause(); return; }
      if (e.key === "f" || e.key === "F" || e.key === "t" || e.key === "T") { void toggleTheaterMode(); return; }
      if (e.key === "m" || e.key === "M") { toggleMute(); return; }
      if (e.key === "c" || e.key === "C") { setIsCinematic((p) => !p); bumpControls(); return; }
      if (e.key === "n" || e.key === "N" || e.key === "]") { handleRetry(); return; }
      if (e.key === "[") { prevServer(); return; }
      if (e.key === "s" || e.key === "S") { setShowServerSelector((p) => !p); return; }
      if (e.key === "r" || e.key === "R") { reloadStream(); return; }
      if (e.key === "ArrowLeft") { seek("back"); return; }
      if (e.key === "ArrowRight") { seek("forward"); return; }
      if (e.key === "ArrowUp") { sendEmbedAction(iframeRef.current, "volumeUp"); bumpControls(); return; }
      if (e.key === "ArrowDown") { sendEmbedAction(iframeRef.current, "volumeDown"); bumpControls(); return; }
      if (e.key === "g" || e.key === "G") { setShowPartySidebar((p) => !p); bumpControls(); return; }
      if (e.key === "l" || e.key === "L") { setShowTimelineControls((p) => !p); bumpControls(); return; }
      bumpControls();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose, handleRetry, prevServer, reloadStream, seek, toggleMute, togglePlayPause, bumpControls, toggleTheaterMode, exitContainerFullscreen, showServerSelector]);

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
  };

  const onIframeError = () => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setEmbedState("error");
  };

  return (
    <div
      ref={containerRef}
      className="player-shell fixed inset-0 z-[9999] bg-black flex flex-col"
      onMouseMove={bumpControls}
      onTouchStart={handleTap}
    >
      <AmbientGlowFrame posterPath={fullPosterUrl} />

      {/* Top bar — simplified: back, title, server, fullscreen, close */}
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
        playState={playState}
        showServerSelector={showServerSelector}
        handleClose={handleClose}
        togglePlayPause={togglePlayPause}
        setShowServerSelector={setShowServerSelector}
        toggleTheaterMode={toggleTheaterMode}
        prevServer={prevServer}
        seek={seek}
        reloadStream={reloadStream}
        handleRetry={handleRetry}
        switchServer={switchServer}
        setIsCinematic={setIsCinematic}
      />

      {/* Video embed */}
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

      {/* Center play/pause indicator on tap */}
      {showCenterPlay && embedState === "ready" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20 animate-scale-in">
            {playState === "playing" ? (
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

      {/* Seek indicator (double-tap) */}
      {seekIndicator && (
        <div className={`absolute top-1/2 -translate-y-1/2 z-30 pointer-events-none ${
          seekIndicator === "back" ? "left-8" : "right-8"
        }`}>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/60 backdrop-blur-sm border border-white/10 animate-fade-in">
            <div className="text-white text-sm font-bold">
              {seekIndicator === "back" ? "−10s" : "+10s"}
            </div>
          </div>
        </div>
      )}

      {/* Bottom controls — clean centered layout */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 transition-all duration-300 ${
        controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}>
        <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-16 pb-4 px-4">
          {/* Feature buttons row */}
          <div className="max-w-3xl mx-auto flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTimelineControls((p) => !p)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm border transition-all ${
                  showTimelineControls
                    ? "bg-red-600 border-red-500/50 text-white"
                    : "bg-white/10 border-white/10 text-gray-300 hover:bg-white/20"
                }`}
                title="Timeline comments (L)"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {comments.length > 0 && <span className="tabular-nums">{comments.length}</span>}
              </button>
              <button
                type="button"
                onClick={() => setShowPartySidebar((p) => !p)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm border transition-all ${
                  showPartySidebar
                    ? "bg-purple-600 border-purple-500/50 text-white"
                    : "bg-white/10 border-white/10 text-gray-300 hover:bg-white/20"
                }`}
                title="FlixParty (G)"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Party</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {currentSource.name} · {currentSource.quality}
              </span>
            </div>
          </div>

          {/* Main transport controls */}
          <div className="max-w-2xl mx-auto flex items-center justify-center gap-3 sm:gap-4">
            <button onClick={() => seek("back")} className="player-icon-btn !w-10 !h-10 sm:!w-12 sm:!h-12" title="Rewind 10s">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 17a1 1 0 0 1-1-1v-4l-5 3V9l5 3V8a1 1 0 0 1 1.5-.86l6 4a1 1 0 0 1 0 1.72l-6 4A1 1 0 0 1 11 17z"/><text x="3" y="20" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">10</text></svg>
            </button>

            <button
              onClick={togglePlayPause}
              disabled={embedState !== "ready"}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 shadow-2xl shadow-white/20"
              title="Play / Pause (K)"
            >
              {playState === "paused" ? (
                <div className="w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[18px] border-l-black ml-1" />
              ) : (
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-7 bg-black rounded-sm" />
                  <div className="w-2.5 h-7 bg-black rounded-sm" />
                </div>
              )}
            </button>

            <button onClick={() => seek("forward")} className="player-icon-btn !w-10 !h-10 sm:!w-12 sm:!h-12" title="Forward 10s">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 17a1 1 0 0 0 1-1v-4l5 3V9l-5 3V8a1 1 0 0 0-1.5-.86l-6 4a1 1 0 0 0 0 1.72l6 4A1 1 0 0 0 13 17z"/><text x="14" y="20" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">10</text></svg>
            </button>
          </div>

          {/* Secondary controls row */}
          <div className="max-w-3xl mx-auto flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="player-icon-btn !w-8 !h-8 sm:!w-9 sm:!h-9" title="Mute (M)">
                {isMuted ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                )}
              </button>
              <span className="text-xs text-gray-400 tabular-nums hidden sm:inline">
                {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, "0")}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setIsCinematic((p) => !p)} className="text-xs text-gray-500 hover:text-white transition-colors hidden sm:inline">
                {isCinematic ? "Exit cinematic" : "Cinematic"}
              </button>
              <button onClick={() => setShowServerSelector(true)} className="player-icon-btn !w-8 !h-8 sm:!w-9 sm:!h-9" title="Servers (S)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
              </button>
              <button onClick={toggleTheaterMode} className="player-icon-btn !w-8 !h-8 sm:!w-9 sm:!h-9" title="Fullscreen (F)">
                {isTheaterMode ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18-5h-3m3 0v3m0 12v-3m0 3h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                )}
              </button>
              <button onClick={handleClose} className="player-icon-btn !w-8 !h-8 sm:!w-9 sm:!h-9 hover:!bg-red-500/30" title="Close (Esc)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

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
