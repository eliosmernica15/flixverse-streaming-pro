"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  X, Server, ArrowLeft, Maximize2, Minimize2, Tv, Film,
  RefreshCw, AlertTriangle, Keyboard, Clock, Signal, ChevronRight,
} from "lucide-react";
import { useWatchHistoryContext } from "@/contexts/WatchHistoryContext";
import { useToast } from "@/hooks/use-toast";
import { buildStreamingSources } from "@/lib/streamingSources";

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

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const VideoPlayer = ({
  movieId, title, onClose, isTrailer = false, mediaType = "movie",
  season, episode, posterPath, resumePosition, totalDuration,
}: VideoPlayerProps) => {
  const [currentServer, setCurrentServer] = useState(0);
  const [showServerSelector, setShowServerSelector] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isCinematic, setIsCinematic] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  const startTimeRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { updateProgress } = useWatchHistoryContext();
  const { toast } = useToast();

  const streamingSources = useMemo(
    () => buildStreamingSources(movieId, mediaType, season, episode),
    [movieId, mediaType, season, episode]
  );
  const currentSource = streamingSources[currentServer];

  const progressPercent = totalDuration && !isTrailer
    ? Math.min(100, (((resumePosition || 0) + elapsed) / totalDuration) * 100)
    : 0;

  const bumpControls = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => setControlsVisible(false), 4000);
  }, []);

  const handleClose = useCallback(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    onClose();

    if (startTimeRef.current && totalDuration && !isTrailer) {
      const finalProgress = (resumePosition || 0) + elapsed;
      if (finalProgress < totalDuration) {
        updateProgress(movieId, mediaType, title, posterPath || null, finalProgress, totalDuration, season, episode).catch(() => undefined);
      }
    }
  }, [movieId, mediaType, title, posterPath, season, episode, totalDuration, resumePosition, isTrailer, updateProgress, onClose, elapsed]);

  const switchServer = useCallback((index: number) => {
    setCurrentServer(index);
    setShowServerSelector(false);
    setIsLoading(true);
    setHasError(false);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    startTimeRef.current = null;
    setElapsed(0);
  }, []);

  const handleRetry = () => switchServer((currentServer + 1) % streamingSources.length);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { handleClose(); return; }
      if (e.key === "t" || e.key === "T") { setIsTheaterMode((p) => !p); bumpControls(); return; }
      if (e.key === "c" || e.key === "C") { setIsCinematic((p) => !p); bumpControls(); return; }
      if (e.key === "n" || e.key === "N") { handleRetry(); bumpControls(); return; }
      if (e.key === "s" || e.key === "S") { setShowServerSelector((p) => !p); bumpControls(); return; }
      if (e.key === "?") { setShowShortcuts((p) => !p); return; }
      bumpControls();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose, handleRetry, bumpControls]);

  useEffect(() => {
    bumpControls();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [bumpControls]);

  useEffect(() => {
    const tick = setInterval(() => {
      if (startTimeRef.current && !isLoading) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [isLoading]);

  useEffect(() => () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
  }, []);

  const onIframeLoad = () => {
    setIsLoading(false);
    if (!isTrailer && totalDuration) {
      startTimeRef.current = Date.now();
      if (resumePosition && resumePosition > 60) {
        toast({ title: "Resuming playback", description: `Continuing from ${formatTime(resumePosition)}` });
      }
      progressIntervalRef.current = setInterval(() => {
        if (!startTimeRef.current) return;
        const current = (resumePosition || 0) + Math.floor((Date.now() - startTimeRef.current) / 1000);
        if (current < totalDuration) {
          updateProgress(movieId, mediaType, title, posterPath || null, current, totalDuration, season, episode).catch(() => undefined);
        }
      }, 30000);
    }
  };

  const shortcuts = [
    { key: "Esc", action: "Close player" },
    { key: "T", action: "Theater mode" },
    { key: "C", action: "Cinematic bars" },
    { key: "N", action: "Next server" },
    { key: "S", action: "Server menu" },
    { key: "?", action: "Shortcuts" },
  ];

  return (
    <div
      ref={containerRef}
      className="player-shell fixed inset-0 z-[9999] bg-black flex flex-col"
      onMouseMove={bumpControls}
      onTouchStart={bumpControls}
    >
      <div className="player-ambient" aria-hidden />

      {/* Top bar */}
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
            {!isTrailer && totalDuration && (
              <span className="hidden md:flex items-center gap-1.5 text-xs text-gray-400 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <Clock className="w-3.5 h-3.5" />
                {formatTime((resumePosition || 0) + elapsed)} / {formatTime(totalDuration)}
              </span>
            )}
            <button type="button" onClick={() => setShowShortcuts(true)} className="player-icon-btn" title="Shortcuts (?)">
              <Keyboard className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setShowServerSelector(true)} className="player-btn">
              <Server className="w-4 h-4 text-red-400" />
              <span className="hidden md:inline text-xs font-medium">{currentSource.name}</span>
              <span className="text-sm">{currentSource.icon}</span>
            </button>
            <button type="button" onClick={() => setIsTheaterMode((p) => !p)} className="player-icon-btn" title="Theater (T)">
              {isTheaterMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button type="button" onClick={handleClose} className="player-icon-btn hover:bg-red-500/80" title="Close (Esc)">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Video area */}
      <div className={`flex-1 min-h-0 flex items-center justify-center relative ${isCinematic ? "py-16 sm:py-24" : "p-3 sm:p-6"}`}>
        <div className={`relative w-full transition-all duration-500 ${isTheaterMode ? "max-w-[100vw]" : "max-w-6xl"}`}>
          <div className="player-frame relative w-full overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 shadow-[0_0_80px_rgba(239,68,68,0.15)]" style={{ aspectRatio: "16/9" }}>
            {isLoading && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950">
                <div className="player-loader mb-4" />
                <p className="text-white font-semibold text-sm sm:text-base">Connecting to {currentSource.name}</p>
                <p className="text-gray-500 text-xs mt-1">Server {currentServer + 1} of {streamingSources.length}</p>
              </div>
            )}

            {hasError && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-7 h-7 text-red-500" />
                </div>
                <p className="text-white font-semibold mb-1">Stream unavailable</p>
                <p className="text-gray-500 text-sm mb-5">Try the next server — some sources rotate daily.</p>
                <button type="button" onClick={handleRetry} className="btn-primary px-6 py-2.5 gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Next server
                </button>
              </div>
            )}

            <iframe
              key={currentServer}
              src={currentSource.url}
              title={`Watch ${title}`}
              className="absolute inset-0 w-full h-full border-0"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={onIframeLoad}
              onError={() => setHasError(true)}
            />
          </div>

          {/* Bottom progress + info */}
          <div className={`player-chrome bottom-0 mt-3 ${controlsVisible ? "player-chrome-visible" : ""}`}>
            {!isTrailer && totalDuration && (
              <div className="mb-3">
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-600 to-orange-500 transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <Signal className="w-3.5 h-3.5 text-green-500" />
                {currentSource.quality} · {currentSource.reliability === "high" ? "Stable" : "Backup"}
              </span>
              <button type="button" onClick={() => setIsCinematic((p) => !p)} className="hover:text-white transition-colors">
                {isCinematic ? "Exit cinematic" : "Cinematic mode (C)"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Server selector modal */}
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

      {/* Shortcuts modal */}
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
