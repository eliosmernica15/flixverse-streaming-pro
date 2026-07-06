"use client";

import { RefObject } from "react";
import { RefreshCw, X, Loader2, AlertCircle } from "lucide-react";
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
  title,
  iframeRef,
  onIframeLoad,
  onIframeError,
  handleRetry,
  setShowHelpPrompt,
  isTheaterMode,
  isCinematic,
}: EmbedFrameProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
      <div className="relative w-full h-full">
        {/* Loading state */}
        {embedState === "loading" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-zinc-950/95 backdrop-blur-sm">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl animate-pulse" />
              <Loader2 className="w-12 h-12 text-red-500 animate-spin relative" />
            </div>
            <p className="text-white font-semibold text-sm animate-pulse">{currentSource.name}</p>
            <p className="text-gray-500 text-xs mt-2">
              Server {currentServer + 1} of {streamingSourcesCount}
            </p>
            <p className="text-gray-600 text-[10px] mt-4 max-w-xs text-center px-6">
              Loading stream from {currentSource.name}. If it stays blank, switch servers.
            </p>
          </div>
        )}

        {/* Error state */}
        {embedState === "error" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-full bg-red-500/20 blur-lg animate-pulse" />
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center relative border border-red-500/20">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
            </div>
            <p className="text-white font-bold mb-1 text-base">Stream unavailable</p>
            <p className="text-gray-500 text-xs mb-6 max-w-xs">
              This server couldn&apos;t load the stream. Try the next server or check your connection.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRetry}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-all active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                Try next server
              </button>
            </div>
          </div>
        )}

        {/* Help prompt */}
        {embedState === "ready" && showHelpPrompt && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 p-3 rounded-xl bg-black/85 border border-white/15 backdrop-blur-md animate-fade-in-up max-w-md shadow-2xl">
            <p className="text-xs text-gray-300">
              Video blank? Try switching servers with the button above.
            </p>
            <button
              type="button"
              onClick={() => setShowHelpPrompt(false)}
              className="shrink-0 p-1 rounded-lg hover:bg-white/10 text-gray-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Play/pause flash overlay */}
        {embedState === "ready" && flashIcon && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20 animate-scale-in">
              {flashIcon === "pause" ? (
                <div className="flex gap-2">
                  <div className="w-2.5 h-7 bg-white rounded-sm" />
                  <div className="w-2.5 h-7 bg-white rounded-sm" />
                </div>
              ) : (
                <div className="w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[18px] border-l-white ml-1" />
              )}
            </div>
          </div>
        )}

        {/* The actual iframe */}
        <iframe
          ref={iframeRef}
          src={currentSource.url}
          title={`Watch ${title}`}
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
