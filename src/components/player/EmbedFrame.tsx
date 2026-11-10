"use client";

import { RefObject, useCallback, useEffect, useState, type MutableRefObject } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { isAllowedEmbedUrl, StreamingSource } from "@/lib/streamingSources";
import { recordSecurityAudit } from "@/lib/securityAuditLog";
import { parseChaptersFromEvent, type Chapter } from "@/lib/player/chapterParser";

function stripSandbox(iframe: HTMLIFrameElement | null) {
  if (!iframe) return;
  if (iframe.hasAttribute("sandbox")) {
    const sandboxValue = iframe.getAttribute("sandbox") || "";
    recordSecurityAudit("embed-sandbox-attribute-stripped", `host: ${getEmbedHost(iframe.src)}, originalSandbox: ${sandboxValue}`);
  }
  iframe.removeAttribute("sandbox");
}

function getEmbedHost(src: string): string {
  try {
    return new URL(src, window.location.origin).hostname;
  } catch {
    return "invalid";
  }
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
  // Chapter state managed by parent
  chapters?: Chapter[];
  introChapter?: Chapter | null;
  recapChapter?: Chapter | null;
}

const MINIMAL_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-presentation";

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
  chapters,
  introChapter,
  recapChapter,
}: EmbedFrameProps) {
  const bindIframeRef = useCallback(
    (node: HTMLIFrameElement | null) => {
      if (iframeRef && "current" in iframeRef) {
        (iframeRef as MutableRefObject<HTMLIFrameElement | null>).current = node;
      }
      if (node) {
        node.setAttribute("sandbox", MINIMAL_SANDBOX);
        stripSandbox(node);
      }
    },
    [iframeRef]
  );

  // Handle postMessage from iframe for chapters and other events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: only accept messages from the iframe
      const iframe = iframeRef.current;
      if (!iframe || event.source !== iframe.contentWindow) return;

      // Parse chapters from provider events
      const chaptersData = parseChaptersFromEvent(event);
      if (chaptersData) {
        // Chapters are managed by parent; just notify via custom event
        window.dispatchEvent(new CustomEvent("flixverse:chapters", { detail: { chapters: chaptersData } }));
      }

      // Handle other provider events
      const data = event.data;
      if (data?.type === "PLAYER_EVENT") {
        switch (data.event) {
          case "skip_intro":
            if (data.startTime) {
              window.dispatchEvent(new CustomEvent("flixverse:skip-intro", { detail: { startTime: data.startTime } }));
            }
            break;
          case "skip_recap":
            if (data.startTime) {
              window.dispatchEvent(new CustomEvent("flixverse:skip-recap", { detail: { startTime: data.startTime } }));
            }
            break;
          case "chapter_change":
            // Chapter changed notification
            break;
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Ensure minimal sandbox is set
    iframe.setAttribute("sandbox", MINIMAL_SANDBOX);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes") {
          const attrName = mutation.attributeName;
          const target = mutation.target as HTMLIFrameElement;

          if (attrName === "sandbox") {
            if (target.hasAttribute("sandbox")) {
              const sandboxValue = target.getAttribute("sandbox") || "";
              if (sandboxValue !== MINIMAL_SANDBOX) {
                recordSecurityAudit("embed-sandbox-mutation", `host: ${getEmbedHost(target.src)}, originalSandbox: ${sandboxValue}, expectedSandbox: ${MINIMAL_SANDBOX}`);
                stripSandbox(target);
              }
            }
          }

          if (attrName === "src") {
            const src = target.getAttribute("src");
            if (src && !isAllowedEmbedUrl(src)) {
              recordSecurityAudit("embed-src-outside-allowlist", getEmbedHost(src));
            }
          }
        }
      });
    });

    observer.observe(iframe, { attributes: true, attributeFilter: ["sandbox", "src"] });
    return () => observer.disconnect();
  }, [iframeRef, currentSource.url, currentServer]);

  const handleLoad = () => {
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.setAttribute("sandbox", MINIMAL_SANDBOX);
      stripSandbox(iframe);
    }
    onIframeLoad();
  };

  return (
    <div
      className="player-frame"
      style={{
        contain: "strict",
        willChange: "transform",
      } as React.CSSProperties}
    >
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
        sandbox={MINIMAL_SANDBOX}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        referrerPolicy="origin"
        onLoad={handleLoad}
        onError={onIframeError}
      />
    </div>
  );
}