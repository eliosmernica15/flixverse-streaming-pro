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
  currentSource,
  currentServer,
  streamingSources,
  isTheaterMode,
  showServerSelector,
  handleClose,
  setShowServerSelector,
  toggleTheaterMode,
  switchServer,
}: PlayerChromeProps) {
  const subtitle = isTrailer
    ? "Trailer"
    : mediaType === "tv" && season && episode
      ? `Season ${season} · Episode ${episode}`
      : "Now streaming";

  const qualityLabel =
    currentSource.quality === "4K"
      ? "4K"
      : currentSource.quality === "FHD"
        ? "1080p"
        : "720p";

  return (
    <>
      {/* Refined auto-hiding glass top bar */}
      <header
        className={`video-chrome ${controlsVisible ? "" : "video-hidden"}`}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="video-chrome-inner">
          <div className="video-chrome-left">
            <button
              type="button"
              onClick={handleClose}
              className="video-btn video-btn-icon"
              aria-label="Back"
              title="Back (Esc)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <div className="video-title">
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>

            <span className="video-server-chip video-quality-badge" aria-label={`Resolution ${qualityLabel}`}>
              <span className="video-live-dot" aria-hidden="true" />
              <span>{qualityLabel}</span>
            </span>
          </div>

          <div className="video-chrome-right">
            <button
              type="button"
              onClick={() => setShowServerSelector(true)}
              className="video-server-chip"
              aria-label={`Current server: ${currentSource.name}. ${currentServer + 1} of ${streamingSources.length}. Open server list`}
              title="Servers (S)"
            >
              <span aria-hidden="true">{currentSource.icon}</span>
              <span className="hidden md:inline">{currentSource.name}</span>
              <span className="video-server-count">
                {currentServer + 1}/{streamingSources.length}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleTheaterMode}
              className="video-btn video-btn-icon"
              aria-label={isTheaterMode ? "Exit theater / fullscreen" : "Enter theater / fullscreen"}
              title="Theater (F)"
            >
              {isTheaterMode ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18-5h-3m3 0v3m0 12v-3m0 3h-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="video-btn video-btn-icon is-danger"
              aria-label="Close player"
              title="Close (Esc)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Server selector modal */}
      {showServerSelector && (
        <div className="video-server-modal" role="dialog" aria-modal="true" aria-label="Select server">
          <div className="video-server-backdrop" onClick={() => setShowServerSelector(false)} />
          <div className="video-server-sheet">
            <div className="video-server-head">
              <h2>Servers</h2>
              <button
                type="button"
                onClick={() => setShowServerSelector(false)}
                className="video-help-close"
                aria-label="Close server list"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="video-server-list">
              {streamingSources.map((source, index) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => switchServer(index)}
                  className={`video-server-item ${currentServer === index ? "is-active" : ""}`}
                  aria-current={currentServer === index ? "true" : undefined}
                >
                  <span className="video-server-icon" aria-hidden="true">{source.icon}</span>
                  <div className="video-server-meta">
                    <p className="video-server-meta-name">{source.name}</p>
                    <p className="video-server-meta-sub">
                      {source.quality} · {source.reliability === "high" ? "Recommended" : "Alternative"}
                    </p>
                  </div>
                  {currentServer === index && <span className="video-server-active-tag">ACTIVE</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
