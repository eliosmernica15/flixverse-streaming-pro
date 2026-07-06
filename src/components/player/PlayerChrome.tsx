"use client";

import {
  ArrowLeft, Signal, Keyboard, Play, Pause, Server, Minimize2, Maximize2, X,
  SkipBack, Rewind, FastForward, Volume2, VolumeX, RefreshCw, ChevronRight, HelpCircle
} from "lucide-react";
import { StreamingSource } from "@/lib/streamingSources";

interface PlayerChromeProps {
  title: string;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  isTrailer: boolean;
  controlsVisible: boolean;
  embedState: "loading" | "ready" | "error";
  statusLabel: string;
  currentSource: StreamingSource;
  currentServer: number;
  streamingSources: StreamingSource[];
  isTheaterMode: boolean;
  isCinematic: boolean;
  playState: "playing" | "paused";
  isMuted: boolean;
  showServerSelector: boolean;
  showShortcuts: boolean;
  
  handleClose: () => void;
  setShowShortcuts: (show: boolean) => void;
  togglePlayPause: () => void;
  setShowServerSelector: (show: boolean) => void;
  toggleTheaterMode: () => void;
  prevServer: () => void;
  seek: (direction: "back" | "forward") => void;
  toggleMute: () => void;
  reloadStream: () => void;
  handleRetry: () => void;
  switchServer: (index: number) => void;
  setIsCinematic: (fn: (c: boolean) => boolean) => void;
}

export function PlayerChrome({
  title,
  mediaType,
  season,
  episode,
  isTrailer,
  controlsVisible,
  embedState,
  statusLabel,
  currentSource,
  currentServer,
  streamingSources,
  isTheaterMode,
  isCinematic,
  playState,
  isMuted,
  showServerSelector,
  showShortcuts,

  handleClose,
  setShowShortcuts,
  togglePlayPause,
  setShowServerSelector,
  toggleTheaterMode,
  prevServer,
  seek,
  toggleMute,
  reloadStream,
  handleRetry,
  switchServer,
  setIsCinematic,
}: PlayerChromeProps) {
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
    { key: "G", action: "FlixParty sidebar" },
    { key: "L", action: "Timeline comments" },
    { key: "Esc", action: "Exit fullscreen / close" },
    { key: "?", action: "Shortcuts" },
  ];

  return (
    <>
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
                  {mediaType === "tv" ? <TvIcon /> : <FilmIcon />}
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
            <button type="button" onClick={toggleTheaterMode} className="player-icon-btn" title="Theater + fullscreen (T)">
              {isTheaterMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button type="button" onClick={handleClose} className="player-icon-btn hover:bg-red-500/80" title="Close (Esc)">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

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
    </>
  );
}

function TvIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-tv">
      <rect width="20" height="15" x="2" y="7" rx="2" ry="2"/>
      <path d="m17 2-5 5-5-5"/>
    </svg>
  );
}

function FilmIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-film">
      <rect width="18" height="18" x="3" y="3" rx="2"/>
      <path d="M7 3v18"/>
      <path d="M17 3v18"/>
      <path d="M3 7h4"/>
      <path d="M3 12h18"/>
      <path d="M3 17h4"/>
      <path d="M17 17h4"/>
      <path d="M17 12h4"/>
      <path d="M17 7h4"/>
    </svg>
  );
}
