"use client";

import { StreamingSource } from "@/lib/streamingSources";

interface PlayerChromeProps {
  title: string;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  isTrailer: boolean;
  controlsVisible: boolean;
  embedState: "loading" | "ready" | "error";
  currentSource: StreamingSource;
  currentServer: number;
  streamingSources: StreamingSource[];
  isTheaterMode: boolean;
  isCinematic: boolean;
  playState: "playing" | "paused";
  showServerSelector: boolean;

  handleClose: () => void;
  togglePlayPause: () => void;
  setShowServerSelector: (show: boolean) => void;
  toggleTheaterMode: () => void;
  prevServer: () => void;
  seek: (direction: "back" | "forward") => void;
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
  currentSource,
  currentServer,
  streamingSources,
  isTheaterMode,
  showServerSelector,
  handleClose,
  setShowServerSelector,
  toggleTheaterMode,
  prevServer,
  seek,
  reloadStream,
  handleRetry,
  switchServer,
}: PlayerChromeProps) {
  return (
    <>
      {/* Top bar — only shows on hover */}
      <header
        className={`absolute top-0 left-0 right-0 z-40 transition-all duration-300 ${
          controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full pointer-events-none"
        }`}
      >
        <div className="bg-gradient-to-b from-black/90 via-black/60 to-transparent">
          <div className="max-w-7xl mx-auto px-3 sm:px-5 py-3 flex items-center justify-between gap-3">
            {/* Left: back + title */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={handleClose}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md text-white text-sm transition-all shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                <span className="hidden sm:inline">Back</span>
              </button>
              <div className="min-w-0 hidden sm:block">
                <h1 className="text-sm font-bold text-white truncate">{title}</h1>
                <p className="text-[11px] text-gray-400">
                  {isTrailer ? "Trailer" : mediaType === "tv" && season && episode ? `Season ${season} · Episode ${episode}` : "Now streaming"}
                </p>
              </div>
            </div>

            {/* Right: server indicator + fullscreen + close */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowServerSelector(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md text-white text-xs transition-all"
              >
                <span className="text-sm">{currentSource.icon}</span>
                <span className="hidden md:inline">{currentSource.name}</span>
                <span className="text-[10px] text-gray-400">{currentServer + 1}/{streamingSources.length}</span>
              </button>
              <button
                type="button"
                onClick={toggleTheaterMode}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md text-white transition-all"
                title="Fullscreen"
              >
                {isTheaterMode ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18-5h-3m3 0v3m0 12v-3m0 3h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                )}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-red-500/30 border border-white/10 backdrop-blur-md text-white transition-all"
                title="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Server selector modal */}
      {showServerSelector && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowServerSelector(false)} />
          <div className="relative w-full sm:max-w-md bg-zinc-950 border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="font-bold text-white text-sm">Servers</h2>
              <button type="button" onClick={() => setShowServerSelector(false)} className="p-1.5 hover:bg-white/10 rounded-lg">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-2 max-h-[60vh]">
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
                  <span className="text-xl">{source.icon}</span>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-white text-sm">{source.name}</p>
                    <p className="text-[11px] text-gray-500">{source.quality} · {source.reliability === "high" ? "Recommended" : "Alternative"}</p>
                  </div>
                  {currentServer === index && <span className="text-[10px] text-red-400 font-bold">ACTIVE</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
