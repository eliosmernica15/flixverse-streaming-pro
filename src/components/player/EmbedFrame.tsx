"use client";

import { RefObject, useCallback, useEffect, type MutableRefObject } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { StreamingSource } from "@/lib/streamingSources";

function stripSandbox(iframe: HTMLIFrameElement | null) {
  if (!iframe) return;
  iframe.removeAttribute("sandbox");
}

interface EmbedFrameProps {
  currentSource: StreamingSource;
  currentServer: number;
  streamingSourcesCount: number;
  embedState: "loading" | "ready" | "error";
  title: string;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  onIframeLoad: () => void;
  onIframeError: () => void;
  onRetry: () => void;
}

export function EmbedFrame({
  currentSource,
  currentServer,
  streamingSourcesCount,
  embedState,
  title,
  iframeRef,
  onIframeLoad,
  onIframeError,
  onRetry,
}: EmbedFrameProps) {
  const bindIframeRef = useCallback(
    (node: HTMLIFrameElement | null) => {
      if (iframeRef && "current" in iframeRef) {
        (iframeRef as MutableRefObject<HTMLIFrameElement | null>).current = node;
      }
      stripSandbox(node);
    },
    [iframeRef]
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    stripSandbox(iframe);
    const observer = new MutationObserver(() => {
      if (iframe.hasAttribute("sandbox")) stripSandbox(iframe);
    });
    observer.observe(iframe, { attributes: true, attributeFilter: ["sandbox"] });
    return () => observer.disconnect();
  }, [iframeRef, currentSource.url, currentServer]);

  const handleLoad = () => {
    stripSandbox(iframeRef.current);
    onIframeLoad();
  };

  return (
    <div className="player-frame">
      {embedState === "loading" && (
        <div className="player-overlay player-overlay--loading" role="status">
          <div className="player-spinner" aria-hidden="true" />
          <p className="player-overlay-title">{currentSource.name}</p>
          <p className="player-overlay-sub">
            Server {currentServer + 1} of {streamingSourcesCount}
          </p>
        </div>
      )}

      {embedState === "error" && (
        <div className="player-overlay player-overlay--error" role="alert">
          <AlertCircle className="w-10 h-10 text-red-400" aria-hidden="true" />
          <p className="player-overlay-title">Stream unavailable</p>
          <p className="player-overlay-sub">
            Press <kbd>N</kbd> for the next server, or try again below.
          </p>
          <button type="button" onClick={onRetry} className="player-retry-btn">
            <RefreshCw className="w-4 h-4" />
            Next server
          </button>
        </div>
      )}

      <iframe
        key={`${currentSource.id}-${currentServer}`}
        ref={bindIframeRef}
        src={currentSource.url}
        title={`Watch ${title} on ${currentSource.name}`}
        className={`player-iframe ${embedState === "error" ? "player-iframe--hidden" : ""}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        referrerPolicy="origin"
        onLoad={handleLoad}
        onError={onIframeError}
      />
    </div>
  );
}
