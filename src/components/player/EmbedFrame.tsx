"use client";

import { RefObject } from "react";
import { RefreshCw, X, AlertCircle } from "lucide-react";
import { StreamingSource } from "@/lib/streamingSources";

interface EmbedFrameProps {
  currentSource: StreamingSource;
  currentServer: number;
  streamingSourcesCount: number;
  embedState: "loading" | "ready" | "error";
  showHelpPrompt: boolean;
  flashIcon: "play" | "pause" | null;
  playState: "playing" | "paused";
  title: string;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  onIframeLoad: () => void;
  onIframeError: () => void;
  handleRetry: () => void;
  setShowHelpPrompt: (show: boolean) => void;
  isTheaterMode: boolean;
  isCinematic: boolean;
}

export function EmbedFrame({
  currentSource,
  currentServer,
  streamingSourcesCount,
  embedState,
  showHelpPrompt,
  flashIcon,
  iframeRef,
  onIframeLoad,
  onIframeError,
  handleRetry,
  setShowHelpPrompt,
  isCinematic,
}: EmbedFrameProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
      <div className="relative w-full h-full">
        {/* Loading state */}
        {embedState === "loading" && (
          <div className="video-overlay video-overlay-loading">
            <div className="video-spinner" role="status" aria-label={`Loading ${currentSource.name}`} />
            <p className="video-loading-name">{currentSource.name}</p>
            <p className="video-loading-sub">
              Server {currentServer + 1} of {streamingSourcesCount}
            </p>
            <p className="video-loading-tip">
              Loading stream from {currentSource.name}. If it stays blank, switch servers.
            </p>
          </div>
        )}

        {/* Error state */}
        {embedState === "error" && (
          <div className="video-overlay video-overlay-error">
            <div className="video-error-icon" aria-hidden="true">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <p className="video-error-title">Stream unavailable</p>
            <p className="video-error-sub">
              This server couldn&apos;t load the stream. Try the next server or check your connection.
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="video-retry-btn"
              aria-label="Try next server"
            >
              <RefreshCw className="w-4 h-4" />
              Try next server
            </button>
          </div>
        )}

        {/* Help prompt */}
        {embedState === "ready" && showHelpPrompt && (
          <div className="video-help-prompt" role="status">
            <p>Video blank? Try switching servers with the button above.</p>
            <button
              type="button"
              onClick={() => setShowHelpPrompt(false)}
              className="video-help-close"
              aria-label="Dismiss hint"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Play/pause flash overlay — big crisp glass circle */}
        {embedState === "ready" && flashIcon && (
          <div className="video-flash">
            <div className="video-flash-circle">
              {flashIcon === "pause" ? (
                <div className="flex gap-2">
                  <div className="w-2.5 h-7 bg-white rounded-sm" />
                  <div className="w-2.5 h-7 bg-white rounded-sm" />
                </div>
              ) : (
                <div className="w-0 h-0 border-t-[11px] border-t-transparent border-b-[11px] border-b-transparent border-l-[20px] border-l-white ml-1.5" />
              )}
            </div>
          </div>
        )}

        {/* The actual iframe */}
        <iframe
          ref={iframeRef}
          src={currentSource.url}
          title={`Watch ${currentSource.name}`}
          className={`absolute inset-0 w-full h-full border-0 ${
            embedState === "error" ? "pointer-events-none opacity-0" : ""
          } ${isCinematic ? "cinema-overlay" : ""}`}
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={onIframeLoad}
          onError={onIframeError}
        />
      </div>
    </div>
  );
}
