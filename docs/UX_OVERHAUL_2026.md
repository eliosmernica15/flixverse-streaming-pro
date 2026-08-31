# FlixVerse UX Overhaul — Netflix-Grade Redesign

**Date:** 2026-08-31
**Scope:** Whole-website UI/UX pass across 20+ pages and 100+ components.
**Goal:** Bring every screen to Netflix-tier (and beyond) — cinematic headers, single-action controls, perfectly centered side arrows, zero floating overlays, and a self-hosted real-time transport for watch parties.

---

## TL;DR

| Area | Before | After |
| --- | --- | --- |
| Movie card hover | Two Play buttons, floating action row that pushed the title down | One center Play on hover; small icon stack overlays the card |
| Carousel side arrows | Misaligned, appeared at the bottom of the row | Full-row-height strip, flex-centered icon, hover-reveal, gradient sweep on hover |
| Card preview panel | Floating portal that overlapped the row and covered the next carousel | Removed entirely (`CardPreviewPanel.tsx` deleted) |
| Watch party transport | Used Ably pubsub (3rd-party) | Replaced with a self-hosted Firestore pubsub (`usePartyRealtime`) — replay buffer, sequence numbers, anti-loop |
| Page headers | Plain text, weak hierarchy | Cinematic headers (icon chip + eyebrow + tracked title + radial gradient) on every page |
| Search dropdown | Results only | Recent searches + trending suggestions + "See all results" CTA |
| 404 page | Generic glass panel | Cinematic 404 with quick-link grid for top destinations |
| Auth page | Centered card on dark background | Split layout: brand panel + value props on the left, form on the right (desktop) |
| Plans page | Plain pricing | Cinematic hero with trust badges (Cancel anytime, Secure billing, 30-day money back) |

---

## What was wrong

User-reported pain points from screenshots:

1. **"The dropdown is still appearing"** — A floating `CardPreviewPanel` portal was rendered over the carousels. It was triggered on hover-after-360ms.
2. **"Two play buttons"** — `MovieCard` had a center Play overlay *and* a Play button inside the bottom action row.
3. **"The arrows in every single slider are down"** — The side arrows used `top-1/2 -translate-y-1/2` and were getting vertically misaligned because their parent didn't have a deterministic height to center against.
4. **"Make it super more highly advanced"** — General request to elevate every page beyond the existing dark-glass aesthetic.

---

## What was built

### 1. MovieCard (`src/components/MovieCard.tsx`)

- Removed the floating `CardPreviewPanel` portal and all the dead state around it (previewOpen, previewEnabled, schedulePreviewOpen/Close, fineHover media-query, keepPreviewOpen).
- Single center Play button (12×12 white circle, scales 1.10× on hover) — fades in only on hover/focus.
- Right-side vertical icon stack on the card: List (Plus/Check/Loader) + Chevron (More) — both overlay on the card image, not below it.
- Title row below the card shows only metadata: rating · year · maturity · runtime — no action buttons.
- New pill system: `badge-pill`, `badge-hd`, `badge-rating-green/amber/red`, `badge-top`, `badge-new`, `badge-match`.
- `netflix-card-wrap` utility gives a Netflix-precise hover: `translateY(-6px) scale(1.085)` with `z-30` so neighbors don't bleed.

### 2. Side arrows on every row (`src/components/ui/carousel.tsx` + `src/app/globals.css`)

- New `.carousel-side-arrow` CSS class:
  - `position: absolute; top: 0; bottom: 0; width: 64px` — full row height, vertically centered icon via `flex items-center justify-center`.
  - `data-dir="prev|next"` for direction-aware hover gradient.
  - Icon scales 1.18× on hover, 0.94× on press.
  - `pointer-events: none` until row is hovered, then fade in over 220ms.
  - `[disabled]` hides the button (when at scroll bounds).
- `CarouselPrevious`/`CarouselNext` in `ui/carousel.tsx` were simplified — no more `top-1/2 -translate-y-1/2` plumbing.
- `MovieCarousel`, `Top10Row`, and `ContinueWatching` all just use `className="hidden md:inline-flex"` — the CSS does the rest.

### 3. Watch party transport (`src/hooks/player/usePartyRealtime.ts` — new)

- Drop-in replacement for Ably. Append-only `events` subcollection under `flix_parties/{roomId}/events`.
- Monotonic `seq` numbers on every event — guests discard anything older than their local cursor (no out-of-order replays).
- Replay buffer: on subscribe, the last 32 events stream in via a single `limit(32) desc by seq` query.
- Author stamping: every event carries `senderId`; recipients ignore their own messages.
- Auto-trim: the host keeps the subcollection bounded at ~64 events via batched deletes.
- Rate-limited at 30 events/sec/user.
- `useWebRTCSync` was simplified — no more Ably code path.
- The `party` hook in `usePlayerPartySync` now sends every play/pause/seek/heartbeat through **both** the realtime transport and the WebRTC data channel — whichever delivers first wins, the other is free redundancy.

### 4. Watch party UI polish

- `WatchParty.tsx` — Netflix-style "Live" pill with pulsing dot, watch count badge, copy-link CTA, collapsible invite list with refined avatar list, dedicated "End party for everyone" red CTA.
- `FlixPartyJoinDialog` — 6-character code entry with per-character slot highlighting, animated brand mark.
- `FlixPartySidebar` — passes `realtimeProcessed` + `peerCount` telemetry to `SyncStatusBadge`.
- `SyncStatusBadge` — new `resyncing` state, animated live dot, hover tooltip shows events processed + peer count.
- `PartyJoinClient` — 4-stage animated join flow (Verifying → Joining → Resolving → Syncing) with checkmark transitions.
- `playerStatusLabel` extended: `Live · synced`, `Hard resync`, `Offline`.

### 5. Page-by-page cinematic headers

Every page now uses the same pattern (icon chip + eyebrow + tracked title + radial gradient bg):

- **Auth** — split layout with brand panel + value props
- **MyList** — tabbed All/Movies/Series, search filter, sort (Recent/A-Z), discover-more CTA, grid
- **NewAndPopular** — tabbed All/Movies/TV, single combined grid
- **Movies, TVShows, Browse** — replaced `PageHero` with new cinematic headers
- **Plans** — cinematic pricing hero with trust badges
- **PersonDetails** — blurred-backdrop hero, ring-frame avatar, refined metadata pills
- **PublicProfile** — cinematic profile header with follow + activity
- **SearchResults** — cleaner results grid + people grid
- **Profile** — cinematic cover gradient (replaced ugly red/blue stock background)
- **404 NotFound** — animated 404 with quick-link grid

### 6. Search dropdown (`src/components/SearchBar.tsx`)

- Added recent searches persisted in `localStorage` (`flixverse:recent-searches`).
- Added "Trending" suggestions block (Trending Now, Action, Sci-Fi, Series).
- Added "See all results for `{query}` →" link at the bottom of the results list.
- Loader state now shows an animated spinner with text.
- Result rows use compact metadata (year · ★ rating) and the type badge in a corner.

### 7. Auth (`src/views/Auth.tsx`)

- Split layout: on `lg+` screens, the left half is a brand panel with logo, big tagline, 4 value bullets with checkmarks, and copyright.
- Mobile keeps the centered card layout.

### 8. Browse (`src/views/Browse.tsx`)

- Cinematic header with category icon + eyebrow + title.
- Compact sort bar with chip-style sort buttons (Featured, Top Rated, Newest, A–Z).
- Empty state with friendly message and reset filters CTA.

### 9. 404 (`src/views/NotFound.tsx`)

- Big animated `404` with gradient text fill.
- Quick-link grid for the 6 most common destinations (Home, Movies, TV, New & Popular, My List, Trending).
- Home + Search CTAs.

---

## What was removed

- **`src/components/CardPreviewPanel.tsx`** — full file deleted. Was the source of 2 user complaints about a floating panel over the carousels.
- **`src/lib/player/ablyPartySync.ts`** — Ably pubsub layer. Replaced by the self-hosted realtime transport.
- **`src/hooks/player/useAblyPartySync.ts`** — Ably sync hook. Deleted.
- **`ably`** dependency in `package.json`.
- **Ably CSP entries** in `src/lib/security-headers.ts` (the `*.ably.io` and `*.ably-realtime.com` connect-src allowances).
- The **stale `useFlixPartyPython`** Python backend references in hooks (kept them as runtime opt-in only — not used unless `isPythonBackendEnabled()` is true).
- **Stale `PageHero` references** on Movies/TVShows/Browse/MyList/NewAndPopular — replaced with inline cinematic headers.
- **Floating `card-action-row`** below the movie card title — replaced with overlay icons on the card itself.

---

## What was added

### New files
- `src/hooks/player/usePartyRealtime.ts` — self-hosted Firestore pubsub transport for watch parties.
- `docs/UX_OVERHAUL_2026.md` — this file.

### New CSS utilities (in `src/app/globals.css`)
- `.carousel-side-arrow` — full-row-height Netflix-style side arrow strip.
- `.netflix-card-wrap` — card hover scale + lift + z-index.
- `.netflix-card-wrap:hover, :focus-within` — the actual hover state.
- `.row-shell[data-edge-left|right]` — edge-fade gradients on rows.
- `.row-title` / `.row-eyebrow` — Netflix-precise typography.
- `.cta-primary` / `.cta-secondary` / `.cta-icon` — Netflix-style CTA primitives.
- `.badge-pill` + variants (badge-hd, badge-new, badge-top, badge-match, badge-rating-green/amber/red).
- `.meta-pill` / `.meta-dot` — compact metadata primitives.
- `.section-divider-glow`.
- `.section-marker` — animated underline on row hover.

### New tailwind keyframes (`tailwind.config.ts`)
- `slide-in-left`, `slide-in-right-soft`, `letter-fade`, `netflix-card-in`, `badge-pulse`, `shimmer-fast`.

### New rate limit (`src/lib/rateLimit.ts`)
- `PARTY_REALTIME: 30 events/sec/user`.

---

## Files changed (with commit hashes)

| Commit | Files |
| --- | --- |
| `8943ed6` | `MovieCard.tsx` (drop duplicate Play buttons) |
| `3fbb44b` | `package.json`, `security-headers.ts`, `useWebRTCSync.ts`, `usePlayerPartySync.ts`, `usePartyRealtime.ts` (new), `ablyPartySync.ts` (deleted), `useAblyPartySync.ts` (deleted), `rateLimit.ts` |
| `0a22f73` | `WatchParty.tsx`, `PartyJoinClient.tsx`, `FlixPartyJoinDialog.tsx` (via shared hooks) |
| `0a15cc1` | `MovieCard.tsx`, `MovieCarousel.tsx`, `Top10Row.tsx`, `ContinueWatching.tsx`, `ui/carousel.tsx`, `CardPreviewPanel.tsx` (deleted) |
| `54a27ec` | `Auth.tsx`, `Browse.tsx`, `Movies.tsx`, `MyList.tsx`, `NewAndPopular.tsx`, `SearchResults.tsx`, `TVShows.tsx` |
| `4acd514` | `SearchBar.tsx`, `NotFound.tsx` |
| `27ce0dd` | `PersonDetails.tsx`, `PublicProfile.tsx` |
| `94b1d66` | `Profile.tsx` (cover background only) |
| `ed5ee18` | `app/plans/page.tsx` |
| `f393d46` | (build verification) |

---

## How to verify the new side arrow positioning

1. Open the home page.
2. Hover any row (Trending Now, New Releases, etc.).
3. Two large side arrows fade in flush against the left and right edges.
4. The arrow icons are vertically centered in the **row** (not the viewport), regardless of card height.
5. The arrow's vertical position tracks the **poster image**, not the row container — so it's always at the visual center of the card.

If the arrows still look low, check that no parent has `display: contents` or any `min-height: 0` override collapsing the row's bounding box.

---

## Known follow-ups (not done in this pass)

- **Profile page** — only the cover background was upgraded. The whole header section (avatar + name + tabs + stats) still uses the old layout. A future pass should pull it into the same cinematic-header pattern as `MyList` and `NewAndPopular`.
- **OfflineLibrary** — still uses the old `PageHero` and a slightly cluttered downloads list. Future pass: move to a tabbed Downloads / Cached view.
- **Help / Contact** — these static pages are OK but could be consolidated under a single Help Center route with sidebar navigation.
- **Movie Details** — the hero is good but the trailer iframe is plain. Could be wrapped in a Netflix-style cinematic card with metadata sidebar.
- **Search results** — the per-person results could become a dedicated "People" tab with role badges.
- **Carousel edge-fade gradients** — currently in CSS but tied to a `data-edge-left/right` attribute that isn't set anywhere yet. Needs a real edge-detection hook to toggle them based on scroll position.

---

## Build verification

```
✓ Compiled successfully
✓ Generating static pages (72/72) in ~1.3s
○ (Static) prerendered as static content
ƒ (Dynamic) server-rendered on demand
```

No TypeScript errors, no ESLint errors, no missing dependencies.
