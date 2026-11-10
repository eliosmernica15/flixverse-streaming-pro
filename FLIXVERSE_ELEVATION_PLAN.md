# FLIXVERSE ELEVATION PLAN + CRASH FIX DIRECTIVE

> Master reference: integrates the user's original "Executive Directive: Complete System Elevation & Watch Party Overhaul", the new CRITICAL DIRECTIVE for crash/lag resolution, and the verified project state from `MASTER_PLAN_2026.md` and `docs/UX_OVERHAUL_2026.md`.

---

## EMERGENCY PHASE 0: FIX WATCH PARTY CRASH & EXTREME UI LAG (DO FIRST)

The website breaks (not responsive, pop-up to exit or wait) when a watch party starts. Apply these four root-cause fixes immediately:

### 0.1 Eliminate High-Frequency Database & State Thrashing
**Files:** `src/lib/player/usePlayerPartySync.ts`, `src/hooks/player/useFlixParty.ts`, `src/lib/player/useEmbedBridge.ts`, `FlixPartySidebar.tsx`, `PartyMediaPanel.tsx`

- **NEVER** write to Firestore from native `timeupdate` event. In `usePlayerPartySync.ts`: locate any `onSnapshot` or `addDoc` triggered by `currentTime` updates; wrap them in a guard: `if (isLocalUpdate) return;` and only allow host heartbeat writes.
- Throttle host heartbeats: change any interval firing faster than 4 seconds to `setInterval(heartbeat, 4500)` (strict timer). Ensure `heartbeat` sends `{ playing, lastKnownTime, staged, stageTime, currentTime }` only when `isHost` and timer fires — not on every `timeupdate`.
- Debounce user seek events: in `usePlayerPartySync`, wrap `broadcastPartySeek()` and any Firestore event write triggered by user seek in a `useCallback` with `setTimeout(clearTimeout, 400)` — only dispatch after 400ms of no new seek input (`seekDebounceRef`).
- Wrap high-frequency UI elements (`chat feed`, `camera grid`, `player HUD`, `SyncStatusBadge`) in `React.memo`. Add `useCallback` to event handlers (`sendPartyMessage`, `broadcastPartyState`, `setPlaybackRate`, etc.) so parent re-renders don't cascade down to the video iframe and WebRTC tiles.
- Verify no `useEffect` with `[]` dependency is subscribing to rapid Firestore changes without cleanup; every `onSnapshot` must have a matching unsubscribe returned from cleanup.

### 0.2 Fix WebRTC MediaStream & Hardware Memory Leaks
**Files:** `src/lib/player/webrtcPartySync.ts`, `src/lib/player/usePartyMedia.ts`, `src/components/player/PlayerShell.tsx`

- Add explicit lifecycle cleanup hook inside `WebRTCPartySync` class (line 70 area) and `usePartyMedia` hook. On unmount / component destroy:
  ```typescript
  localStream?.getTracks().forEach((track) => {
    track.stop();
    track.enabled = false;
  });
  localStream = null;
  peers.forEach((pc) => {
    pc.getSenders().forEach((sender) => {
      if (sender.track) sender.track.stop();
    });
    pc.close();
  });
  peers.clear();
  ```
- When muting camera/mic or switching sources in `usePartyMedia.ts`: set `track.enabled = false` (or `true` to unmute) instead of calling `getUserMedia()` again. Only call `getUserMedia` once at initialization; reuse the same `MediaStream` object and modify tracks in place (`replaceTrack`, `addTrack` with new track, remove old). This prevents GPU memory leaks from repeated `getUserMedia` allocations.
- In `PlayerShell.tsx`, ensure `localStreamRef.current` is set to `null` after stopping tracks and that `useEffect` cleanup runs before component unmounts (especially when navigating away from `party/join` or closing sidebar).

### 0.3 Enforce a Global AudioContext Singleton
**Files:** `src/lib/player/usePartyMedia.ts`, `src/lib/player/useVolumeDucking.ts`, `PlayerShell.tsx`

- Check `usePartyMedia` and `useVolumeDucking` (line 43: `DUCK_RATIO = 0.42`): they may create separate `AudioContext` instances. Convert to a singleton module (`src/lib/player/audioSingleton.ts` — new):
  ```typescript
  let globalAudioCtx: AudioContext | null = null;
  export function getAudioContext(): AudioContext {
    if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
      globalAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (globalAudioCtx.state === 'suspended') globalAudioCtx.resume();
    return globalAudioCtx;
  }
  export function closeAudioContext() {
    if (globalAudioCtx && globalAudioCtx.state !== 'closed') globalAudioCtx.close();
    globalAudioCtx = null;
  }
  ```
- Update `usePartyMedia.ts` to import `getAudioContext()` instead of `new AudioContext()`.
- Update `audioDucker` logic (planned in Phase 1) to use `getAudioContext()` exclusively.
- Call `closeAudioContext()` in cleanup when party unmounts or page navigates away (only after confirming no other audio source needs it — check `document.querySelector('audio, video')` count; if zero, safe to close).

### 0.4 Iframe DOM Isolation & Sandbox Protection
**Files:** `src/components/player/EmbedFrame.tsx`, `src/lib/player/embedControls.ts`, `src/lib/player/providerRegistry.ts`

- In `EmbedFrame.tsx`: apply `contain: strict; will-change: transform;` CSS directly to the iframe container element (not just the iframe). This isolates the provider iframe's layout/repaint from the rest of the page, preventing layout thrashing from propagating and freezing the site.
- Keep the sandbox stripping logic for keyboard/postMessage access but add `sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"` explicitly back in HTML (currently stripped entirely for access — that is a trade-off). Monitor if keyboard/postMessage still works after adding `allow-scripts` + `allow-same-origin`; adjust to the minimum allowed set that keeps `postMessage` and keyboard events functional.
- Add `MutationObserver` in `EmbedFrame` that watches for `sandbox` attribute changes or unexpected `src` mutations and logs them to a `securityAuditLog` array (optional, disabled by default, max 50 entries). This helps detect malicious embed behavior.

---

## PHASE 1: WATCH PARTY ENGINE — CORE PRIORITY (Hardening + Advanced Features)

**Files:** `webrtcPartySync.ts`, `usePlayerPartySync.ts`, `useEmbedBridge.ts`, `providerRegistry.ts`, `embedControls.ts`, `embedSeekUrls.ts`, `FlixPartySidebar.tsx`, `PartyMediaPanel.tsx`, `PlayerShell.tsx`, `useFlixParty.ts`

1. **Cross-Origin Iframe Mastery — Bidirectional `postMessage` Bridge (Enhancement)**
   - `providerRegistry.ts`: Enhance `postMessage` listener normalization in `useEmbedBridge` to handle all `PLAYER_EVENT` shapes (`data.event`: play/pause/time/seeked/ended/complete). Add retry with exponential backoff for failed dispatches.
   - `embedControls.ts`: Add `messageQueue` for unordered delivery, 200ms debounce per action, `commandTrace` debug mode (optional).

2. **High-Precision Virtual Master Clock — Drift Realignment**
   - `usePlayerPartySync.ts` / `ntpClockSync.ts`: Add `driftHistory` (last 10 measurements) for rolling average smoothing. Create floating `"⚡ Snap to Host ([timestamp])"` HUD pill (`SnapToHostPill.tsx`) for macro-drift (>2s).
   - `embedSeekUrls.ts`: Add `vidsrc.me` to regex and origins; verify `injectSeekParam` handles all query-string combos (`?sub=` + `?t=` coexisting).

3. **Anti-Ping-Pong Execution Locks**
   - `usePlayerPartySync.ts`: Add `isRemoteAction` ref-lock (350ms debounce) suppressing outgoing broadcasts when remote event arrives. Log lock events.

4. **Instant Late-Join Catch-Up**
   - `PartyJoinClient.tsx`: Add `immediateStateSnapshot()` — jump directly to `hostCurrentTime` if recent (<30s) without long splash.

5. **Smart Buffering Coordination**
   - `PlayerShell.tsx`: New `BufferingHud.tsx`. Listen for `VIDEO_BUFFERING` / `VIDEO_PLAYING` postMessage; broadcast `PAUSE_ROOM` / `AUTO_RESUME` via `usePartyRealtime`.

6. **Webcam Grid Polish**
   - `FlixPartySidebar.tsx`: Add `.glass-card` CSS (backdrop-blur, border-white/10, rounded-2xl). Active speaker glow (cyan ring), drag-and-drop PIP (`PiPTile.tsx`).

7. **Smart Dynamic Audio Ducking**
   - New `audioDucker.ts`: Use Web Audio API (`AnalyserNode` > -42dB triggers 65% attenuation over 150ms; >1.2s silence ramps back to 100%). Attach to master `AudioContext` gain node.

8. **Noise & Loop Prevention + Push-to-Talk**
   - `usePartyMedia.ts`: Confirm `echoCancellation: true`, `noiseSuppression: true`, `autoGainControl: true`. Add `pushToTalk` (Spacebar toggled) with `PTTIndicator` component.

---

## PHASE 2: ROOM AUTHORITY & SOCIAL FEATURES

**Files:** `WatchParty.tsx`, `FlixPartySidebar.tsx`, `useFlixParty.ts`, `partyUrl.ts`, `usePartyRealtime.ts`, component additions

1. **Controls Mode Toggle (`HOST_ONLY` / `COLLABORATIVE`)**
   - Room doc: add `controls_mode`. Relax Firestore rules conditionally for collaborative mode. Update `usePlayerPartySync` to allow `guestBroadcast` when `controlsMode === "COLLABORATIVE"`.

2. **Pass the Crown (Host Delegation)**
   - `WatchParty.tsx`: `delegateHost()` updates room doc `host_id`, sends notification. Add `PassCrownDialog` confirmation.

3. **Binge Sync (Playlist / Next Episode)**
   - `usePlayerPartySync.ts`: When `mediaType === "tv"` and duration - currentTime < 30s, host triggers `NEXT_EPISODE`. Guests reload embed URL with updated season/episode (start = 0). WebRTC/chat stay live.

4. **Floating Spatial Reactions**
   - New `spatialReactions.ts`: Broadcast `REACTION` via Firestore + WebRTC. Render animated particle (`float-up` CSS animation) over video canvas (max 3 active per type, auto-remove oldest).

5. **Timestamped Chat Anchors**
   - `FlixPartySidebar.tsx`: `"Pin Moment"` button creates message with `timestamp_anchor = hostCurrentTime`. Clickable pill seeks room (host or collaborative guests only). Add `seekToTimestamp()` helper.

---

## PHASE 3: NEXT-GEN VISUAL & INTERACTIVE OVERHAUL

**Files:** `globals.css`, `tailwind.config.ts`, `MovieCard.tsx`, `MovieCarousel.tsx`, `movie/[id]/page.tsx`, `page.tsx`, `PlayerShell.tsx`

1. **Dynamic Ambient Canvas**
   - Add `ambient-canvas` CSS (radial gradient pulse). `extractPosterColors` hook (canvas-based dominant color extraction). Apply to hero banners and player containers.

2. **Glassmorphic Surface Hierarchy**
   - `.glass-card`: `backdrop-blur-md bg-white/5 border-white/10 shadow-[...] inner-shadow`. Apply to party cards, player controls, chat bubbles.

3. **3D Tilt Cards + Expandable Hover**
   - `MovieCard.tsx`: `perspective(800px)`, mouse-driven `rotateX`/`rotateY` (±6° clamped), light sheen overlay, hover delay 500ms, scale 1.05, muted preview, quick-action buttons.

4. **Kinetic Smooth Scrolling**
   - Integrate `lenis` or native smooth scroll with physics. `useScrollPhysics` hook. `prefers-reduced-motion` guards disable tilt + scroll.

5. **Sound Design & Haptic Feedback**
   - `microSounds.ts`: Synthetic Web Audio bursts (`timeline-tick` 880Hz, `cinematic-drop` descending, `reaction-pop` 1200Hz, `hover-click` noise). `globalAudioToggle` in navigation. `navigator.vibrate` on mobile.

---

## PHASE 4: ARCHITECTURE, PERFORMANCE & SECURITY

**Files:** `vercel.json`, `next.config.mjs`, `backend/`, `security-headers.mjs`, `middleware.ts`, `src/lib/player/`, `.env.example`

1. **Zero-Crash Firestore Realtime (Adapter Abstraction)**
   - `realtimeAdapter.ts`: Abstract `TransportAdapter`. Implement `FirestoreTransport` (current) + `WebSocketTransport` (future). Modify `usePartyRealtime` to use adapter factory.

2. **Backend API Optimization**
   - `vercel.json`: Confirm `memory: 1024` for Python routes. `backend/main.py`: Add `httpx.AsyncClient` with `timeout=10.0, connect=5.0`. `security-headers.mjs` / middleware: `stale-while-revalidate` + `s-maxage` for `/api/tmdb/*`. `database.py`: Switch to `psycopg_pool` (or SQLAlchemy engine with pooling) instead of per-request `connect()`.

3. **Chunk Load Error Resilience**
   - `ChunkReloadBoundary.tsx`: Monitor deployment hash mismatch in `sessionStorage`. Trigger invisible reload only when safe (no active playback/chat interaction). Log to `localStorage`.

4. **Security Hardening**
   - `EmbedFrame.tsx`: Restrictive `sandbox` (`allow-scripts allow-same-origin allow-forms allow-presentation`), `contain: strict`, `will-change: transform`. `securityAuditLog` (optional). CSP updates verified (Ably removed, canonical domains included).

5. **Privacy — Provider Sandbox + Encryption**
   - `roomEncryption.ts`: Optional key rotation (>60 min session). `secureStorage` wrapper (AES-GCM + PBKDF2 for `localStorage` room keys).

---

## WHAT TO ADD / TWEAK / REMOVE (Verified from Exploration)

**Add:**
- `audioSingleton.ts` (global AudioContext singleton)
- `audioDucker.ts` (audio ducking logic using singleton)
- `spatialReactions.ts` (animated particle reactions)
- `realtimeAdapter.ts` (transport adapter abstraction)
- `ChunkReloadBoundary.tsx` (deployment hash reload guard)
- `SnapToHostPill.tsx` (drift correction HUD)
- `BufferingHud.tsx` (smart buffering coordination UI)
- `PiPTile.tsx` (drag-and-drop floating PIP)
- `microSounds.ts` (synthetic sound library)
- `extractPosterColors.ts` (dominant color extraction for ambient glow)
- `useScrollPhysics.ts` (kinetic scroll hook)
- `PTTIndicator.tsx` (push-to-talk visual)

**Fix / Harden (Critical — Phase 0):**
- `usePlayerPartySync.ts`: Throttle heartbeat (4-5s), debounce seek (400ms), `isRemoteAction` lock (350ms), `React.memo` + `useCallback` for high-frequency UI.
- `usePartyMedia.ts`: Explicit `getTracks().forEach(track => track.stop())` cleanup; reuse `getUserMedia` instead of re-requesting.
- `webrtcPartySync.ts`: Add cleanup on destroy; ensure `forwardStreamToOthers` doesn't accumulate unclosed peers; consider TURN fallback hardcoding if `NEXT_PUBLIC_TURN_URL` is missing.
- `PlayerShell.tsx`: `contain: strict` + `will-change: transform` on iframe container.

**Keep:**
- Watch-party sync stack (`usePartyRealtime`, `usePlayerPartySync`, `useEmbedBridge`, `useWebRTCSync`, `NTPClient`, `roomEncryption`)
- Design token system (`tailwind.config.ts`, brand colors, easing curves)
- Provider registry (`providerRegistry.ts`) with canonical domains (`streamingSources.ts` verified in `MASTER_PLAN_2026.md`)
- Firestore rules (`firestore.rules` — validated, 391 lines)
- PWA / offline (`public/sw.js`, `offline-library/`)
- CI pipeline (`.github/workflows/`)

---

## ROOT REFERENCE FILE
Saved to: `C:\Users\Admin\Desktop\flixverse-streaming-pro-master\FLIXVERSE_ELEVATION_PLAN.md`
(Save the file there; include both the original user's Executive Directive and this enhanced plan for future reference.)
