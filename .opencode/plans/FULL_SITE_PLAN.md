🚀 FLIXVERSE WATCH PARTY: STACK-SPECIFIC MASTER PLAN
code
Code
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           FLIXVERSE PRODUCTION STACK                             │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Frontend:     Next.js (Vercel Serverless)                                        │
│ Backend:      Python FastAPI (Mangum on Vercel)                                  │
│ Video Source: Direct Provider Embeds (Cross-Origin <iframe>)                     │
│ Real-Time:    Firestore onSnapshot (Native in stack; replaces removed Ably)       │
│ Preserved:    WebRTC Video/Audio Call Grid + Real-time Chat + Firebase Auth       │
└──────────────────────────────────────────────────────────────────────────────────┘
1. THE ARCHITECTURAL STRATEGY
A. Real-Time Layer (No external servers needed)
Because Ably was removed and Mangum cannot hold WebSockets on Vercel, use Firestore onSnapshot real-time listeners (already active in your project).
When the host updates state, it writes to parties/{partyId}.
All party members receive the snapshot within 100–250ms via Firebase's built-in real-time socket.
Zero serverless timeouts, zero extra cost, and no need to deploy a separate server.
B. Controlling Provider Embeds (<iframe>)
Because browser security blocks direct JavaScript access to third-party iframes, synchronization uses a Dual-Layer Controller:
The PostMessage Bridge (Primary): Many streaming embed providers listen for standard window.postMessage commands ({ event: "command", func: "pauseVideo" } or { action: "seek", time: seconds }).
The Synced Time Overlay & URL Param Fallback (Secondary):
When the host seeks or starts the movie, the room syncs an overarching Virtual Timeline.
If a viewer falls out of sync by > 2 seconds, the player displays a 1-click "⚡ Snap to Host ([timestamp])" overlay button, or automatically reloads the iframe with the timestamp parameter (e.g., ?t={seconds} or #t={seconds}).
2. STEP-BY-STEP IMPLEMENTATION PLAN
code
Code
┌──────────────────────────────────────────────┐
                │          Firestore: parties/{partyId}        │
                │  - hostId                                    │
                │  - isPlaying: bool                           │
                │  - currentTime: float                        │
                │  - lastUpdated: serverTimestamp              │
                └──────────────┬───────────────────────────────┘
                               │
               Real-time Listeners (onSnapshot)
                               │
         ┌─────────────────────┴─────────────────────┐
         ▼                                           ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│           HOST CLIENT           │   │          VIEWER CLIENT          │
│ - Floating Synced Control Bar   │   │ - Follower Sync Engine          │
│ - PostMessage / Iframe emitter  │   │ - Auto-pacing & "Snap" HUD      │
│ - Writes state to Firestore     │   │ - Receives Firestore updates    │
├─────────────────────────────────┤   ├─────────────────────────────────┤
│    [PRESERVED] WebRTC Cam/Mic   │   │    [PRESERVED] WebRTC Cam/Mic   │
│    [PRESERVED] Live Chat        │   │    [PRESERVED] Live Chat        │
└─────────────────────────────────┘   └─────────────────────────────────┘
Phase 1: Real-Time State Service (services/partySync.ts)
Replace the broken/removed Ably socket with a Firestore real-time party session:
Document path: parties/{partyId}
State schema:
code
TypeScript
interface PartySyncState {
  hostId: string;
  isPlaying: boolean;
  currentTime: number;
  updatedAt: number; // Date.now()
  mediaId: string; // Movie/Show ID being watched
  sourceUrl: string; // Current embed URL
}
Host Heartbeat: While playing, the Host writes their current time every 4 seconds.
Viewer Listener: Viewers subscribe via onSnapshot to receive instant updates on isPlaying, currentTime, and mediaId.
Phase 2: Iframe Controller Bridge (components/PartyIframePlayer.tsx)
Create a wrapper around the provider embed that handles both postMessage communication and fallback timestamp reloading:
code
Tsx
import React, { useEffect, useRef, useState } from 'react';

export function PartyIframePlayer({ embedUrl, syncState, isHost, onHostAction }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [localTime, setLocalTime] = useState(syncState.currentTime || 0);
  const [showSnapButton, setShowSnapButton] = useState(false);

  // 1. PostMessage communication to embed (VidSrc / SuperEmbed standards)
  const sendIframeCommand = (command: string, value?: any) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: command, value: value }),
      "*"
    );
  };

  // 2. React to remote changes from Host
  useEffect(() => {
    if (isHost) return;

    // Calculate latency-adjusted target time
    const elapsedSinceUpdate = (Date.now() - syncState.updatedAt) / 1000;
    const targetTime = syncState.currentTime + (syncState.isPlaying ? elapsedSinceUpdate : 0);

    const drift = Math.abs(localTime - targetTime);

    // If drift is significant (> 3s), show one-click snap or trigger reload
    if (drift > 3) {
      setShowSnapButton(true);
    } else {
      setShowSnapButton(false);
    }

    // Attempt postMessage play/pause
    sendIframeCommand(syncState.isPlaying ? "play" : "pause");
  }, [syncState, isHost]);

  const snapToHost = () => {
    const elapsed = (Date.now() - syncState.updatedAt) / 1000;
    const targetTime = Math.floor(syncState.currentTime + (syncState.isPlaying ? elapsed : 0));

    // Reload iframe at exact timestamp
    const separator = embedUrl.includes('?') ? '&' : '?';
    const syncedUrl = `${embedUrl}${separator}t=${targetTime}&start=${targetTime}#t=${targetTime}`;
    
    if (iframeRef.current) {
      iframeRef.current.src = syncedUrl;
    }
    setLocalTime(targetTime);
    setShowSnapButton(false);
  };

  return (
    <div className="relative w-full h-full bg-black">
      <iframe
        ref={iframeRef}
        src={embedUrl}
        className="w-full h-full border-0"
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
      />

      {/* Snap to Host HUD Alert (Appears when viewer drifts) */}
      {showSnapButton && !isHost && (
        <div className="absolute top-4 right-4 z-50 bg-neutral-900/90 border border-red-500/50 p-3 rounded-lg shadow-xl flex items-center gap-3 animate-fade-in">
          <span className="text-xs text-neutral-300">You are out of sync with the Host</span>
          <button
            onClick={snapToHost}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded transition"
          >
            ⚡ Sync Video
          </button>
        </div>
      )}

      {/* Host Overlaid Synchronized Control Bar (Ensures host has precise time scrub controls) */}
      {isHost && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-black/80 backdrop-blur border border-white/10 px-4 py-2 rounded-full flex items-center gap-4">
          <button
            onClick={() => onHostAction(syncState.isPlaying ? 'PAUSE' : 'PLAY', localTime)}
            className="text-white hover:text-red-500 font-bold text-sm"
          >
            {syncState.isPlaying ? '⏸ Pause Room' : '▶ Play Room'}
          </button>
          <button
            onClick={() => onHostAction('SEEK_BACK', Math.max(0, localTime - 10))}
            className="text-xs text-neutral-300 hover:text-white"
          >
            -10s
          </button>
          <button
            onClick={() => onHostAction('SEEK_FORWARD', localTime + 10)}
            className="text-xs text-neutral-300 hover:text-white"
          >
            +10s
          </button>
        </div>
      )}
    </div>
  );
}
Phase 3: Preserve Microphone, Camera, & Chat
Leave all existing files managing the WebRTC peer grid (SimplePeer / RTCPeerConnection) completely untouched.
Leave the Chat component and Firebase Firestore chat collection listeners intact.
Mount PartyIframePlayer in the main video container without altering the layout grid where the camera tiles and chat sidebar live.
Phase 4: Fix the Python Route Timeouts (/api/tmdb/* and /api/flixverse/*)
To stop the Failed to fetch errors mentioned by your AI:
Open vercel.json and configure explicit timeouts for the Python Mangum backend:
code
JSON
{
  "functions": {
    "api/**/*.py": {
      "maxDuration": 30
    }
  }
}
Verify that TMDB_API_KEY is added to Vercel Project Settings → Environment Variables for Production, Preview, and Development.
