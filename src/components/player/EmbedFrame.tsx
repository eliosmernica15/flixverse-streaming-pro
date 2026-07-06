"use client";

import { RefObject } from "react";
import { AlertTriangle, RefreshCw, HelpCircle, X, Play, Pause } from "lucide-react";
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
  playState,
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
    <div
      className={`flex-1 min-h-0 flex items-center justify-center relative transition-all duration-500 ease-out ${
        isTheaterMode ? "p-0" : isCinematic ? "py-16 sm:py-24" : "p-3 sm:p-6"
      }`}
    >
      <div
        className={`relative w-full h-full transition-all duration-500 ease-out ${
          isTheaterMode ? "max-w-none flex-1 flex flex-col" : "max-w-6xl"
        }`}
      >
        <div
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
              <p className="text-gray-500 text-xs mt-1">Server {currentServer + 1} of {streamingSourcesCount}</p>
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
              <div className="player-flash-icon animate-ping">
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
    </div>
  );
}
