"use client";

import { RefObject } from "react";
import { RefreshCw, X } from "lucide-react";
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
      {/* The iframe fills the entire viewport — true fullscreen video */}
      <div className="relative w-full h-full">
        {/* Loading state */}
        {embedState === "loading" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-zinc-950">
            <div className="w-12 h-12 border-3 border-red-500/20 border-t-red-500 rounded-full animate-spin mb-4" />
            <p className="text-white font-semibold text-sm">{currentSource.name}</p>
            <p className="text-gray-500 text-xs mt-1">Server {currentServer + 1} of {streamingSourcesCount}</p>
          </div>
        )}

        {/* Error state */}
        {embedState === "error" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <p className="text-white font-semibold mb-1 text-sm">Stream unavailable</p>
            <p className="text-gray-500 text-xs mb-5 max-w-xs">
              This server couldn&apos;t load the stream. Try the next server.
            </p>
            <button type="button" onClick={handleRetry} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-colors">
              <RefreshCw className="w-4 h-4" />
              Try next server
            </button>
          </div>
        )}

        {/* Help prompt */}
        {embedState === "ready" && showHelpPrompt && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 p-3 rounded-xl bg-black/85 border border-white/15 backdrop-blur-md animate-fade-in-up max-w-md">
            <p className="text-xs text-gray-300">
              Video blank? Try switching servers with the button above.
            </p>
            <button type="button" onClick={() => setShowHelpPrompt(false)} className="shrink-0 p-1 rounded-lg hover:bg-white/10 text-gray-500">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Play/pause flash overlay */}
        {embedState === "ready" && flashIcon && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20 animate-ping">
              {flashIcon === "pause" ? (
                <div className="flex gap-1.5">
                  <div className="w-2 h-5 bg-white rounded-sm" />
                  <div className="w-2 h-5 bg-white rounded-sm" />
                </div>
              ) : (
                <div className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[14px] border-l-white ml-1" />
              )}
            </div>
          </div>
        )}

        {/* The actual iframe */}
        <iframe
          ref={iframeRef}
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
    </div>
  );
}
