"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  X, Server, ArrowLeft, Maximize2, Minimize2, Tv, Film,
  RefreshCw, AlertTriangle, Keyboard, Signal, ChevronRight, HelpCircle,
  Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Rewind, FastForward,
} from "lucide-react";
import { buildStreamingSources } from "@/lib/streamingSources";
import { sendEmbedAction, isPlayerShortcutKey } from "@/lib/playerEmbedControls";

interface VideoPlayerProps {
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

type EmbedState = "loading" | "ready" | "error";

const LOAD_TIMEOUT_MS = 22_000;
const HELP_PROMPT_DELAY_MS = 6_000;

const VideoPlayer = ({
  movieId, title, onClose, isTrailer = false, mediaType = "movie",
  season, episode,
}: VideoPlayerProps) => {
  const [currentServer, setCurrentServer] = useState(0);
  const [showServerSelector, setShowServerSelector] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isCinematic, setIsCinematic] = useState(false);
  const [embedState, setEmbedState] = useState<EmbedState>("loading");
  const [showHelpPrompt, setShowHelpPrompt] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playState, setPlayState] = useState<"playing" | "paused">("playing");
  const [flashIcon, setFlashIcon] = useState<"play" | "pause" | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const helpPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const streamingSources = useMemo(
    () => buildStreamingSources(movieId, mediaType, season, episode),
    [movieId, mediaType, season, episode]
  );
  const currentSource = streamingSources[currentServer];

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

  const requestFrameFullscreen = useCallback(async () => {
    const el = frameRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ("webkitRequestFullscreen" in el) {
        await (el as HTMLElement & { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
      }
    } catch {
      // Fullscreen blocked — theater layout still applies
    }
  }, []);

  const exitFrameFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) return;
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ("webkitExitFullscreen" in document) {
        await (document as Document & { webkitExitFullscreen: () => Promise<void> }).webkitExitFullscreen();
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
      // Let the expand animation start, then snap to browser fullscreen
      requestAnimationFrame(() => {
        void requestFrameFullscreen();
      });
    } else {
      await exitFrameFullscreen();
    }
  }, [isTheaterMode, bumpControls, requestFrameFullscreen, exitFrameFullscreen]);

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
    bumpControls();
  }, [embedState, bumpControls]);

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
          void exitFrameFullscreen();
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
      if (e.key === "[" ) {
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
    exitFrameFullscreen,
    showServerSelector,
    showShortcuts,
  ]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === frameRef.current;
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
    return () => { document.body.style.overflow = prev; };
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

  const shortcuts = [
    { key: "P / Space / K", action: "Play / pause" },
    { key: "← / →", action: "Seek 10 seconds" },
    { key: "↑ / ↓", action: "Volume up / down" },
    { key: "M", action: "Mute" },
    { key: "F / T", action: "Theater + fullscreen" },
    { key: "C", action: "Cinematic bars" },
    { key: "[ / ]", action: "Previous / next server" },
    { key: "N", action: "Next server" },
    { key: "R", action: "Reload stream" },
    { key: "S", action: "Server menu" },
    { key: "Esc", action: "Exit fullscreen / close" },
    { key: "?", action: "Shortcuts" },
  ];

  return (
    <div
      ref={containerRef}
      className={`player-shell fixed inset-0 z-[9999] bg-black flex flex-col ${isTheaterMode ? "player-theater" : ""}`}
      onMouseMove={bumpControls}
      onTouchStart={bumpControls}
    >
      <div className="player-ambient" aria-hidden />

      <header className={`player-chrome top-0 ${controlsVisible || showServerSelector ? "player-chrome-visible" : ""}`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <button type="button" onClick={handleClose} className="player-btn group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline text-sm font-medium">Back</span>
            </button>
            <div className="min-w-0 hidden sm:block">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shrink-0">
                  {mediaType === "tv" ? <Tv className="w-4 h-4" /> : <Film className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm lg:text-base font-bold truncate">{title}</h1>
                  <p className="text-xs text-gray-400 truncate">
                    {isTrailer ? "Trailer" : mediaType === "tv" && season && episode ? `S${season} · E${episode}` : "Now streaming"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={`hidden md:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${
                embedState === "error"
                  ? "text-red-300 bg-red-500/10 border-red-500/30"
                  : embedState === "loading"
                    ? "text-amber-300 bg-amber-500/10 border-amber-500/30"
                    : "text-gray-400 bg-white/5 border-white/10"
              }`}
            >
              <Signal className={`w-3.5 h-3.5 ${embedState === "ready" ? "text-green-500" : embedState === "error" ? "text-red-400" : "text-amber-400"}`} />
              {statusLabel}
            </span>
            <button type="button" onClick={() => setShowShortcuts(true)} className="player-icon-btn" title="Shortcuts (?)">
              <Keyboard className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={togglePlayPause}
              disabled={embedState !== "ready"}
              className="player-icon-btn disabled:opacity-40"
              title="Play / Pause (P)"
            >
              {playState === "paused" ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button type="button" onClick={() => setShowServerSelector(true)} className="player-btn">
              <Server className="w-4 h-4 text-red-400" />
              <span className="hidden md:inline text-xs font-medium">{currentSource.name}</span>
              <span className="text-sm">{currentSource.icon}</span>
            </button>
            <button type="button" onClick={() => void toggleTheaterMode()} className="player-icon-btn" title="Theater + fullscreen (T)">
              {isTheaterMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button type="button" onClick={handleClose} className="player-icon-btn hover:bg-red-500/80" title="Close (Esc)">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className={`flex-1 min-h-0 flex items-center justify-center relative transition-all duration-500 ease-out ${
        isTheaterMode ? "p-0" : isCinematic ? "py-16 sm:py-24" : "p-3 sm:p-6"
      }`}>
        <div className={`relative w-full h-full transition-all duration-500 ease-out ${
          isTheaterMode ? "max-w-none flex-1 flex flex-col" : "max-w-6xl"
        }`}>
          <div
            ref={frameRef}
            className={`player-frame relative w-full overflow-hidden transition-all duration-500 ease-out ${
              isTheaterMode
                ? "rounded-none border-0 shadow-none flex-1 min-h-0"
                : "rounded-xl sm:rounded-2xl border border-white/10 shadow-[0_0_80px_rgba(239,68,68,0.15)]"
            }`}
            style={isTheaterMode ? undefined : { aspectRatio: "16/9" }}
          >
            {embedState === "loading" && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950">
                <div className="player-loader mb-4" />
                <p className="text-white font-semibold text-sm sm:text-base">Connecting to {currentSource.name}</p>
                <p className="text-gray-500 text-xs mt-1">Server {currentServer + 1} of {streamingSources.length}</p>
              </div>
            )}

            {embedState === "error" && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-7 h-7 text-red-500" />
                </div>
                <p className="text-white font-semibold mb-1">This server couldn&apos;t load the stream</p>
                <p className="text-gray-500 text-sm mb-5 max-w-sm">
                  The embed may be blocked, offline, or missing this episode. Try the next server — sources rotate often.
                </p>
                <button type="button" onClick={handleRetry} className="btn-primary px-6 py-2.5 gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Try next server
                </button>
              </div>
            )}

            {embedState === "ready" && showHelpPrompt && (
              <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between gap-3 p-3 sm:p-4 rounded-xl bg-black/85 border border-white/15 backdrop-blur-md animate-fade-in-up">
                <div className="flex items-start gap-2 min-w-0">
                  <HelpCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-200">
                    Video blank or broken? The player can&apos;t detect playback inside embeds — switch servers if nothing plays.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
                  >
                    Next server
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHelpPrompt(false)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400"
                    aria-label="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {embedState === "ready" && flashIcon && (
              <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                <div className="player-flash-icon">
                  {flashIcon === "pause" ? (
                    <Pause className="w-12 h-12 text-white" />
                  ) : (
                    <Play className="w-12 h-12 text-white fill-white" />
                  )}
                </div>
              </div>
            )}

            <iframe
              ref={iframeRef}
              key={currentServer}
              src={currentSource.url}
              title={`Watch ${title}`}
              className={`absolute inset-0 w-full h-full border-0 ${embedState === "error" ? "pointer-events-none opacity-0" : ""}`}
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={onIframeLoad}
              onError={onIframeError}
            />
          </div>

          <div className={`player-chrome bottom-0 mt-3 ${controlsVisible && !isTheaterMode ? "player-chrome-visible" : controlsVisible && isTheaterMode ? "player-chrome-visible player-chrome-theater" : ""}`}>
            <div className="flex items-center justify-center gap-1 sm:gap-2 mb-3 flex-wrap">
              <button type="button" onClick={prevServer} className="player-icon-btn" title="Previous server ([)">
                <SkipBack className="w-4 h-4" />
              </button>
              <button type="button" onClick={togglePlayPause} disabled={embedState !== "ready"} className="player-icon-btn !w-11 !h-11 disabled:opacity-40" title="Play / Pause (P)">
                {playState === "paused" ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5" />}
              </button>
              <button type="button" onClick={() => seek("back")} disabled={embedState !== "ready"} className="player-icon-btn disabled:opacity-40" title="Seek back 10s (←)">
                <Rewind className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => seek("forward")} disabled={embedState !== "ready"} className="player-icon-btn disabled:opacity-40" title="Seek forward 10s (→)">
                <FastForward className="w-4 h-4" />
              </button>
              <button type="button" onClick={toggleMute} disabled={embedState !== "ready"} className="player-icon-btn disabled:opacity-40" title="Mute (M)">
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button type="button" onClick={reloadStream} disabled={embedState !== "ready"} className="player-icon-btn disabled:opacity-40" title="Reload stream (R)">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button type="button" onClick={handleRetry} className="player-icon-btn" title="Next server (])">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <Signal className={`w-3.5 h-3.5 ${embedState === "ready" ? "text-green-500" : embedState === "error" ? "text-red-400" : "text-amber-400"}`} />
                {currentSource.quality} · {currentSource.reliability === "high" ? "Recommended" : "Backup"} · Server {currentServer + 1}/{streamingSources.length}
              </span>
              <button type="button" onClick={() => setIsCinematic((p) => !p)} className="hover:text-white transition-colors">
                {isCinematic ? "Exit cinematic" : "Cinematic mode (C)"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showServerSelector && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowServerSelector(false)} />
          <div className="relative w-full sm:max-w-lg bg-zinc-950 border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl animate-fade-in-up max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-red-500" />
                <h2 className="font-bold text-white">Streaming servers</h2>
              </div>
              <button type="button" onClick={() => setShowServerSelector(false)} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="px-4 pt-2 text-xs text-gray-500">
              If you see a blank or broken player, pick another server — playback runs inside third-party embeds.
            </p>
            <div className="overflow-y-auto p-2 custom-scrollbar">
              {streamingSources.map((source, index) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => switchServer(index)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl mb-1 transition-all ${
                    currentServer === index
                      ? "bg-gradient-to-r from-red-600/30 to-orange-600/20 border border-red-500/30"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <span className="text-2xl">{source.icon}</span>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-white text-sm">{source.name}</p>
                    <p className="text-xs text-gray-500">{source.quality} · {source.reliability === "high" ? "Recommended" : "Alternative"}</p>
                  </div>
                  {currentServer === index ? (
                    <span className="text-xs text-red-400 font-medium">Active</span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showShortcuts && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowShortcuts(false)} />
          <div className="relative bg-zinc-950 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-red-500" />
              Player shortcuts
            </h2>
            <ul className="space-y-2">
              {shortcuts.map((s) => (
                <li key={s.key} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{s.action}</span>
                  <kbd className="px-2 py-0.5 rounded bg-white/10 border border-white/10 text-white font-mono text-xs">{s.key}</kbd>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setShowShortcuts(false)} className="btn-primary w-full mt-5 py-2.5">
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
