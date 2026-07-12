"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Maximize2, Minimize2, X, Users } from "lucide-react";
import { buildStreamingSources } from "@/lib/streamingSources";
import { usePlaybackClock } from "@/hooks/player/usePlaybackClock";
import { useEmbedBridge } from "@/hooks/player/useEmbedBridge";
import { usePlayerPartySync } from "@/hooks/player/usePlayerPartySync";
import { useVolumeDucking } from "@/hooks/player/useVolumeDucking";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { EmbedFrame } from "./EmbedFrame";
import { PlayerShortcutsDropdown } from "./PlayerShortcutsDropdown";
import { FlixPartySidebar } from "./FlixPartySidebar";
import { FlixPartyInviteDialog } from "./FlixPartyInviteDialog";
import { PartyCameraGrid } from "./PartyMediaPanel";
import { trackPlaybackStart } from "@/lib/analytics";
import "@/app/video-player.css";

interface PlayerShellProps {
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
  episodeCount?: number;
  onAdvanceEpisode?: (nextSeason: number, nextEpisode: number) => void;
}

const LOAD_TIMEOUT_MS = 15_000;

export function PlayerShell({
  movieId,
  title,
  onClose,
  mediaType = "movie",
  season,
  episode,
  posterPath,
  resumePosition = 0,
  totalDuration,
}: PlayerShellProps) {
  const [currentServer, setCurrentServer] = useState(0);
  const [embedState, setEmbedState] = useState<"loading" | "ready" | "error">("loading");
  const [isExpanded, setIsExpanded] = useState(false);
  const [showShortcutsMenu, setShowShortcutsMenu] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [liveDuration, setLiveDuration] = useState(0);

  const autoFailoverRef = useRef(0);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const streamingSources = useMemo(
    () => buildStreamingSources(movieId, mediaType, season, episode),
    [movieId, mediaType, season, episode]
  );
  const currentSource = streamingSources[currentServer];
  const effectiveDuration = liveDuration || totalDuration || 120 * 60;

  const { currentTime, seekTo, syncTo } = usePlaybackClock({
    movieId,
    mediaType,
    title,
    posterPath: posterPath || null,
    season,
    episode,
    initialPosition: resumePosition,
    totalDuration: effectiveDuration,
    isPlaying: embedState === "ready",
  });

  const {
    isPlaying,
    volume,
    togglePlay,
    toggleMute,
    adjustVolume,
    setVolume,
    seek,
    seekRelative,
    setReady,
    setPlaying,
  } = useEmbedBridge({
    iframeRef,
    enabled: embedState === "ready",
    totalDuration: effectiveDuration,
    onTimeUpdate: (time) => syncTo(time),
    onDurationChange: (duration) => setLiveDuration(duration),
  });

  const party = usePlayerPartySync({
    movieId,
    mediaType,
    season,
    episode,
    currentServer,
    currentSourceUrl: currentSource.id,
    currentSourceProviderUrl: currentSource.providerUrl,
    currentTime,
    isPlaying,
    iframeRef,
    setPlaying,
    seekTo,
    seekRelative,
  });

  const { media } = party;

  useVolumeDucking({
    enabled: !!party.partyRoomId && (media.micOn || media.anyoneSpeaking),
    anyoneSpeaking: media.anyoneSpeaking,
    baseVolume: volume,
    setVolume,
  });

  const cameraLayout = media.cameraMode && party.partyRoomId;

  const switchServer = useCallback((index: number) => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    autoFailoverRef.current = 0;
    setCurrentServer(index);
    setEmbedState("loading");
    setLiveDuration(0);
    setPlaying(true);
    setReady(false);
  }, [setPlaying, setReady]);

  const nextServer = useCallback(() => {
    switchServer((currentServer + 1) % streamingSources.length);
  }, [currentServer, streamingSources.length, switchServer]);

  const prevServer = useCallback(() => {
    switchServer((currentServer - 1 + streamingSources.length) % streamingSources.length);
  }, [currentServer, streamingSources.length, switchServer]);

  const handleClose = useCallback(() => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    }
    onClose();
  }, [onClose]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const toggleBrowserFullscreen = useCallback(async () => {
    const el = windowRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      }
    } catch {
      // ignore
    }
  }, []);

  const seekToPercent = useCallback(
    (percent: number) => {
      if (embedState !== "ready" || effectiveDuration <= 0) return;
      const seconds = (percent / 100) * effectiveDuration;
      seek(seconds);
      syncTo(seconds);
    },
    [embedState, effectiveDuration, seek, syncTo]
  );

  const togglePlayPause = useCallback(() => {
    if (embedState !== "ready") return;
    togglePlay();
    party.broadcastPartyState(!isPlaying ? "playing" : "paused", currentTime);
  }, [embedState, togglePlay, isPlaying, currentTime, party]);

  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const hintTimer = setTimeout(() => setShowHint(false), 10000);

    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      clearTimeout(hintTimer);
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setEmbedState("loading");
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = setTimeout(() => {
      if (autoFailoverRef.current < streamingSources.length - 1) {
        autoFailoverRef.current += 1;
        setLiveDuration(0);
        setReady(false);
        setCurrentServer((prev) => (prev + 1) % streamingSources.length);
        return;
      }
      setEmbedState("error");
    }, LOAD_TIMEOUT_MS);
    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, [currentServer, streamingSources.length, setReady]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (showShortcutsMenu && e.key === "Escape") {
        e.preventDefault();
        setShowShortcutsMenu(false);
        return;
      }

      const handled = [
        " ", "k", "K", "m", "M", "t", "T", "f", "F", "g", "G", "v", "V", "p", "P",
        "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
        "n", "N", "]", "[", "?", "/", "+", "=", "-", "_",
        "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
        "Escape",
      ];
      if (handled.includes(e.key)) e.preventDefault();

      if (e.key === "Escape") {
        if (showShortcutsMenu) {
          setShowShortcutsMenu(false);
          return;
        }
        if (party.showPartyPanel) {
          party.setShowPartyPanel(false);
          return;
        }
        if (document.fullscreenElement) {
          void document.exitFullscreen();
          return;
        }
        if (isExpanded) {
          setIsExpanded(false);
          return;
        }
        handleClose();
        return;
      }
      if (e.key === "?" || e.key === "/") {
        setShowShortcutsMenu((p) => !p);
        return;
      }
      if (e.key === "g" || e.key === "G") {
        if (isFeatureEnabled("flixparty")) {
          party.setShowPartyPanel((p) => !p);
        }
        return;
      }
      if (e.key === "v" || e.key === "V") {
        if (party.partyRoomId && isFeatureEnabled("flixparty")) {
          void media.toggleCamera();
        }
        return;
      }
      if (e.key === "p" || e.key === "P") {
        if (party.partyRoomId && isFeatureEnabled("flixparty")) {
          void media.toggleMic();
        }
        return;
      }
      if (e.key === "t" || e.key === "T") {
        toggleExpanded();
        return;
      }
      if (e.key === "f" || e.key === "F") {
        void toggleBrowserFullscreen();
        return;
      }
      if (embedState !== "ready") {
        if (e.key === "n" || e.key === "N" || e.key === "]") nextServer();
        if (e.key === "[") prevServer();
        return;
      }

      if (e.key === " " || e.key === "k" || e.key === "K") togglePlayPause();
      else if (e.key === "m" || e.key === "M") toggleMute();
      else if (e.key === "ArrowLeft") seekRelative(e.shiftKey ? -30 : -10);
      else if (e.key === "ArrowRight") seekRelative(e.shiftKey ? 30 : 10);
      else if (e.key === "ArrowUp") adjustVolume(e.shiftKey ? 0.2 : 0.1);
      else if (e.key === "ArrowDown") adjustVolume(e.shiftKey ? -0.2 : -0.1);
      else if (e.key === "+" || e.key === "=") adjustVolume(0.1);
      else if (e.key === "-" || e.key === "_") adjustVolume(-0.1);
      else if (e.key === "n" || e.key === "N" || e.key === "]") nextServer();
      else if (e.key === "[") prevServer();
      else if (/^[0-9]$/.test(e.key)) seekToPercent(parseInt(e.key, 10) * 10);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    embedState,
    handleClose,
    togglePlayPause,
    toggleMute,
    adjustVolume,
    seekRelative,
    toggleExpanded,
    toggleBrowserFullscreen,
    nextServer,
    prevServer,
    seekToPercent,
    showShortcutsMenu,
    isExpanded,
    party,
    media,
  ]);

  const onIframeLoad = () => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    autoFailoverRef.current = 0;
    setEmbedState("ready");
    setReady(true);
    trackPlaybackStart(movieId, mediaType, currentSource.id);
  };

  const onIframeError = () => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setEmbedState("error");
    setReady(false);
  };

  const flixPartyEnabled = isFeatureEnabled("flixparty");

  return (
    <div
      className={`player-shell ${party.showPartyPanel ? "player-shell--party-open" : ""} ${cameraLayout ? "player-shell--camera" : ""}`}
      role="dialog"
      aria-label={`Watching ${title}`}
    >
      <div className={`player-layout ${cameraLayout ? "player-layout--camera" : ""}`}>
        <div className="player-layout-main">
          <div
            ref={windowRef}
            className={`player-window ${isExpanded ? "is-maximized" : "is-framed"}`}
          >
          <header className="player-window-bar">
            <div className="player-window-meta">
              <p className="player-window-title">{title}</p>
              <p className="player-window-sub">
                {currentSource.name} · {currentServer + 1}/{streamingSources.length}
                {party.partyRoomId && (
                  <span className="player-party-live"> · Party live</span>
                )}
              </p>
            </div>
            <div className="player-window-actions">
              {flixPartyEnabled && (
                <button
                  type="button"
                  className={`player-window-btn ${party.showPartyPanel ? "is-active" : ""}`}
                  onClick={() => party.setShowPartyPanel((p) => !p)}
                  aria-label="Watch together"
                  aria-pressed={party.showPartyPanel}
                  title="Watch together (G)"
                >
                  <Users className="w-4 h-4" />
                </button>
              )}
              <PlayerShortcutsDropdown
                open={showShortcutsMenu}
                onToggle={() => setShowShortcutsMenu((p) => !p)}
                onClose={() => setShowShortcutsMenu(false)}
              />
              <button
                type="button"
                className="player-window-btn"
                onClick={toggleExpanded}
                aria-label={isExpanded ? "Restore player size" : "Maximize player"}
                title={isExpanded ? "Restore (T)" : "Maximize (T)"}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                className="player-window-btn player-window-btn--close"
                onClick={handleClose}
                aria-label="Close player"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          <div className="player-window-body">
            <EmbedFrame
              currentSource={currentSource}
              currentServer={currentServer}
              streamingSourcesCount={streamingSources.length}
              embedState={embedState}
              title={title}
              iframeRef={iframeRef}
              onIframeLoad={onIframeLoad}
              onIframeError={onIframeError}
              onRetry={nextServer}
            />
          </div>

          {showHint && embedState === "ready" && (
            <p className="player-hint" aria-live="polite">
              T maximize · G watch together · ↑↓ volume · ? shortcuts
            </p>
          )}
        </div>

        {cameraLayout && (
          <PartyCameraGrid participants={media.participants} voiceVolume={media.voiceVolume} />
        )}
        </div>

        {flixPartyEnabled && party.showPartyPanel && (
          <FlixPartySidebar
            embedded
            isOpen={party.showPartyPanel}
            onClose={() => party.setShowPartyPanel(false)}
            roomId={party.partyRoomId}
            syncStatus={party.partySyncStatus}
            driftMs={party.partyDriftMs}
            onLeaveRoom={party.handleLeaveParty}
            onStartParty={party.handleStartParty}
            movieId={movieId}
            mediaType={mediaType}
            season={season}
            episode={episode}
            title={title}
            posterPath={posterPath || null}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onSyncToPosition={seekTo}
            partyJoinUrl={party.partyJoinUrl}
            media={media}
            partyRoom={party.partyRoom}
            partyMessages={party.partyMessages}
            isHost={party.isPartyHost}
            sendPartyMessage={party.sendPartyMessage}
            kickParticipant={party.kickParticipant}
            setParticipantMicMuted={party.setParticipantMicMuted}
            setParticipantCamDisabled={party.setParticipantCamDisabled}
          />
        )}
      </div>

      {party.showInviteDialog && party.partyJoinUrl && (
        <FlixPartyInviteDialog
          isOpen={party.showInviteDialog}
          onClose={() => party.setShowInviteDialog(false)}
          roomCode={party.partyRoomCode}
          roomUrl={party.partyJoinUrl}
        />
      )}
    </div>
  );
}

export default PlayerShell;
