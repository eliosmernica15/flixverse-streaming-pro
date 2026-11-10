# FlixVerse — Full-Site Audit & Master Upgrade Plan

**Date:** 2026-11-02
**Scope:** Every page, every feature, UI/UX, security, architecture, performance, accessibility, SEO, and quality.
**Method:** Fresh code review of the actual repository (not just prior docs), against the existing plans
(`MASTER_PLAN_2026.md`, `UX_OVERHAUL_2026.md`, `FLIXVERSE_ELEVATION_PLAN.md`).

> **How to use this file.** Section 1 is the verified-as-of-today baseline. Section 2 is the
> must-fix list (bugs + security). Sections 3–9 are the roadmap, grouped by area. Section 10 is the
> ordered execution checklist. Work top-down; every wave is independently shippable.

---

## 1. Verified current state (2026-11-02)

The app is already substantially advanced. Confirmed live and working:

| Layer | Status |
| --- | --- |
| Frontend | Next.js 16 (App Router) · React 19 · Tailwind 3 + shadcn/ui · 6 CSS layers (globals 1.8k L, video-player 2.1k L, advanced-ui, cinema-stage, depth-parallax, ui-polish) |
| Data | TanStack Query v5, React Query staleTime 10min · Firestore (realtime party/chat/invites) · Python FastAPI + Postgres/SQLite for social data |
| Player | 5 providers (VidSrc `vidsrcme.ru`, VidSrc.to, Videasy, VidLink, VidFast) + 4 YapGrid lanes; network-aware quality pick; auto-failover; skip intro/recap; up-next |
| Watch party | `usePlayerPartySync` (1.2k L) NTP-corrected sync, `usePartyRealtime` append-only event log + WebRTC data channel redundancy, room encryption, host/guest authority, collaborative controls, spatial reactions, timeline comments |
| Payments | Stripe Checkout + webhook → Postgres, portal, invoices |
| i18n | next-intl (en / sq / es messages exist; README says en/sq only — minor doc gap) |
| PWA | SW, offline library, install prompt, offline sync outbox |
| Ops | Sentry + PostHog/GA4, CI (lint · tsc · rules test · vitest · build · Playwright), Vercel deploy |

The prior plans' "Wave 1–4" checklist is **mostly done**, but several items drifted or regressed and a
handful of real issues were never caught. Those are Section 2.

---

## 2. Priority 0 — Real bugs & security gaps found in this review (do first)

### 2.1 Stripe webhook idempotency bug (data integrity — HIGH)
The original webhook path marked events before applying subscription changes. In the current
repository, `markWebhookEventProcessed` had become a no-op while the subscription-sync helper
swallowed backend failures, so the endpoint could acknowledge a Stripe delivery without persisting
the subscription.

**Fixed:** the webhook now checks the Python database for an already-processed event, applies changes
through server-to-server authenticated endpoints, and records the event only after the handler
succeeds. Backend failures return 500 so Stripe retries. Set the same `PYTHON_API_INTERNAL_TOKEN`
in the Next.js and Python server environments.

### 2.2 Dead Ably config still shipping
`.env.example` shipped `NEXT_PUBLIC_ABLY_API_KEY` even though Ably was removed from `package.json`,
hooks, and CSP. **Fixed:** removed the dead key and documented that party sync uses self-hosted
Firestore + WebRTC.

### 2.3 Dead feature flag `card-preview`
`src/lib/featureFlags.ts` and the experiment list kept a `card-preview` toggle after
`CardPreviewPanel.tsx` was deleted. **Fixed:** removed both dead flag definitions without restoring
the rejected preview panel.

### 2.4 CSP allows `'unsafe-eval'` and `'unsafe-inline'`
`security-headers.mjs` `script-src` included both. `'unsafe-inline'` remains for the current Next.js
runtime; **fixed:** removed `'unsafe-eval'` and confirmed the production build succeeds. Nonce-based
inline scripts remain a possible follow-up.

### 2.5 Permissions-Policy is too permissive/imprecise
The previous value only listed `camera`, `microphone`, `geolocation=()`, `interest-cohort=()`. The
player iframes request `autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media`.
**Fixed:** aligned the policy with those capabilities and explicitly denied unused
`display-capture` and `payment`:
```
camera=(self), microphone=(self), geolocation=(), interest-cohort=(),
autoplay=(self), fullscreen=(self), picture-in-picture=(self),
clipboard-write=(self), encrypted-media=(self), display-capture=(), payment=()
```

### 2.6 Embed iframe is fully unsandboxed
`EmbedFrame.tsx` deliberately `stripSandbox()`s the provider iframe (the streaming providers' scripts
require same-origin + full JS). This is a documented tradeoff, but it is the single highest-risk
surface: third-party code runs with our page's privileges inside the frame.

**Mitigations (keep playback working, reduce risk):**
- Keep direct provider iframes unsandboxed: the tested providers require their own origin and full
  JavaScript, and sandboxing or proxying them breaks playback. The unused `/api/embed` proxy was
  removed rather than retaining a caller-controlled fetch surface.
- Keep `referrerPolicy="origin"` and only grant required iframe capabilities.
- Add the `securityAuditLog` MutationObserver (already sketched in the elevation plan): watch for
  `sandbox`/`src` mutations and unexpected postMessage origins; log at most N entries.
- Document the tradeoff in `STREAMING_SOURCES_PLAN.md` so it is never "fixed" by accident back into a
  white player.

### 2.7 Backend CORS credential/wildcard combo
`backend/main.py` previously fell back to `["*"]` with `allow_credentials=True` when the configured
origins were empty. **Fixed:** defaults are now explicit origins, empty configuration allows no
cross-origin origins, and credentials are disabled whenever `*` is configured.

### 2.8 Client-side rate limiting is cosmetic
`src/lib/rateLimit.ts` runs in the browser and is trivially bypassed. It is fine as UX feedback, but
every mutating route must have a **server-side** limiter. Audit coverage:
- `src/app/api/billing/*`, `/account/*`, `/notifications/*`, `/party/room`, `/profile/*`,
  `/captions`, `/tmdb/[...path]`, `/cron/*`.
**Fixed:** verified the existing server-side limits on caller-facing mutating routes and the TMDB
proxy, and added per-IP budgets to billing invoice retrieval and the authenticated SEO cron endpoint.
The Stripe webhook is intentionally not IP-limited; Stripe signature verification and persisted event
idempotency protect that endpoint without risking valid delivery retries.

### 2.9 Firebase token verification `check_revoked=False`
`backend/auth.py` verifies ID tokens without a revocation check. For a consumer app this is acceptable
latency-wise, but **account deletion / password change** should force re-auth. **Fixed:** sensitive
account and billing endpoints use `check_revoked=True`; if Firebase cannot check revocation, those
requests fail closed rather than using the non-revocation-aware REST fallback.

---

## 3. Security hardening program (beyond Priority 0)

1. **Secret hygiene.** Add a lint/CI check that `NEXT_PUBLIC_*` never contains a live key; move TMDB
   fully server-side and delete `NEXT_PUBLIC_TMDB_*`. **Fixed:** removed client-side TMDB credentials
   and added `check:public-env` to CI.
2. **Firestore rules.** `firestore.rules` is 541 lines and validated in CI. Add a scheduled CI job that
   fails if `firestore.rules` changes without `firestore.indexes.json`/CSP being consistent.
3. **Provider allow-list single source of truth.** `ALLOWED_EMBED_HOSTS` in `streamingSources.ts` and
   `frame-src` in `security-headers.mjs` used to be duplicated. **Fixed:** both consume
   `src/lib/embedHosts.json` as their canonical source.
4. **Remove `/api/embed` proxy or harden it.** The unused proxy fetched caller-supplied URLs and
   created an SSRF surface. **Fixed:** the route was deleted; URL parsing remains only for legacy
   links and does not make server-side requests.
5. **Room encryption.** `roomEncryption.ts` AES-GCM exists. **Fixed:** the host now refreshes
   ciphertext with hourly epoch-derived keys; clients reject stale ciphertext, and legacy room
   ciphertext remains decryptable during migration.
6. **CSRF for cookie-based flows.** Confirm state-changing API routes rely on Firebase bearer tokens
   (not cookies) and add `SameSite` checks where cookies are used.
7. **Dependency + image scanning.** Add `npm audit` (or Snyk/Renovate) to CI; pin Next/React minors;
   scan Docker/`requirements.txt` (pip-audit) for the Python workers.
8. **Error non-disclosure.** Audit API error bodies (already careful — e.g. auth distinguishes
   401 vs 503); ensure no stack traces/keys leak via `500` handlers.

---

## 4. Architecture & performance

1. **Postgres connection pooling.** **Fixed:** non-Vercel deployments use a bounded `psycopg_pool`
   (1–8 connections, 10s acquisition/connect timeout); Vercel keeps per-request connections.
2. **Cold-start cost of `init_db()`.** **Fixed:** full schema/index sync is run locally or explicitly
   with `python backend/migrate.py`; normal PostgreSQL startup checks connectivity, performs the
   missing-column migration, and verifies the schema version. An unversioned/outdated DB must be
   migrated before API use; health reports initialization failures as degraded.
3. **Bundle/route weight.** **Fixed:** memoized player controls, sidebar, and camera grid; party media
   collections are now stable across unrelated player renders. Removed unused per-second playback props
   from the sidebar and made Python party timestamps stable so polling deduplication can work.
4. **Image delivery.** **Fixed:** poster cards use quality 60 with AVIF/WebP enabled, eager priority
   remains limited by the existing caller-controlled first-card policy, and non-priority cards stay
   lazy-loaded.
5. **Route prefetch budget.** **Fixed:** footer navigation links opt out of automatic prefetch to
   avoid fetching low-intent routes while scrolling the page.
6. **Observability depth.** Sentry is wired for client/edge/server. Add: custom breadcrumbs on party
   guard rails (already partially done), a `web-vitals` capture, and a PostHog funnel for
   browse→detail→play→party.

---

## 5. UI/UX roadmap — per page (every route)

> Design tokens are strong (brand/gold/cinema-red/neon, `--ease-premium`, badge system). Build on them;
> do not redesign. Priority = visual-impact ÷ effort.

### 5.1 Home `/` (`src/views/Index.tsx`)
- **Genre/topic chip rail. Fixed:** added localized, horizontally scrollable genre links above the
  personalized and editorial rows; each chip maps to an existing browse category.
- **Personalized "Because you watched X" rail. Verified:** the existing `PersonalizedHomeRows` and
  `PickedForYou` components use watch history/favorite genres while the trending/editorial rows remain
  available as fallbacks.
- **Hero auto-rotation. Fixed:** an 8s advance pauses on hover or hidden tabs and remains disabled for
  reduced-motion and performance mode.
- **Skeleton parity. Fixed:** added a Top 10 layout skeleton matching the rank/poster cards.

### 5.2 Browse `/browse/[category]` (`src/views/Browse.tsx`)
- **Done:** URL-backed sorting and decade, minimum-rating, and language facets; unrelated query
  parameters are preserved. Current browse categories return bounded result lists, so virtualization
  remains unnecessary until measured datasets approach ~200 items.

### 5.3 Movies `/movies` & TV `/tv-shows`
- **Done:** shared year-range and genre filters plus a deduplicated **"New This Week"** pinned row
  on both catalog pages.

### 5.4 New & Popular `/new-and-popular`
- **Done:** added Most Anticipated and Critically Acclaimed carousel rows, with countdown badges for
  valid future-dated upcoming titles.

### 5.5 My List `/my-list` (`src/views/MyList.tsx`)
- Already has tabs/search/sort. Add: **drag-to-reorder** (or long-press reorder on mobile), **multi-select
  → bulk remove**, and **"Sort by recently added"** default already present.
- Empty-state → add a **"Import from watch history"** one-click.

### 5.6 Search `/search` (`src/views/SearchResults.tsx` + `SearchBar.tsx`)
- **People tab** with role badges already exists; add **"Collections"** tab (TMDB collections).
- **Query params sync** (`?q=` + `?tab=`) for shareable/deep-linkable results.
- **Search-as-you-type debounce** already exists; add a keyboard hint (↑↓ to navigate) in the dropdown.

### 5.7 Movie/Show details `/movie/[id]` (`MovieDetails.tsx`)
- Trailer card, metadata sidebar, episode selector with hover previews already shipped. Add:
  - **"More like this"** (uses `useRelatedContent`) — verify it's wired on both movie and TV paths.
  - **"Add to list / rate / share"** consolidated action bar (share sheet via Web Share API).
  - **Cast photo grid** with `CastCrewGrid` (exists) — add expand/collapse for large casts.
  - **Watch party CTA** always visible ("Start a party" / "Join"), not just inside the player.

### 5.8 Person `/person/[id]` (`PersonDetails.tsx`)
- Solid (blurred hero, ring avatar). Add **filmography grouped by decade** and a **"Known for"**
  horizontal carousel.

### 5.9 Profile `/profile` (`src/views/Profile.tsx`)
- **Customizable banner** — currently a static Unsplash image. Let users upload a cover (Cloudinary path
  already exists for avatars).
- **Achievements/badges** — derive from activity (`getStats()`): "Binge Watcher", "Critic", "Party Host".
- **Stats row** → make it a real chart sparkline (recharts is installed) for watch-time.
- **Account settings** are split across tabs; consider a settings sidebar for 6+ tabs.

### 5.10 Public profile `/u/[username]` (`PublicProfile.tsx`)
- Add **follow/unfollow** already present; add **"Mutual titles"** (shared watchlist) and
  **"Watched together"** social proof. Add a **report/block** action (GDPR + safety).

### 5.11 Plans `/plans` (`PlansPricing.tsx`)
- Add **feature comparison table** (Standard vs Premium) and **annual/monthly toggle** if not present.
- **Localized currency** via Stripe price metadata.

### 5.12 Offline Library `/offline-library` (`OfflineLibrary.tsx`)
- **Inconsistent header** — still uses old `PageHero` while other pages use cinematic headers. Unify.
- **Tabbed Downloads / Cached** view (already noted as follow-up; still open).
- **Batch actions** (select all → delete), **per-item progress ring**, and **"storage" settings**
  (clear cache, manage quota).

### 5.13 Help `/help` & Contact `/contact`
- Consolidate under one **Help Center** with sidebar nav + search (HelpExplorer exists; still split).
- Add **contact form → email/notification** with server-side rate limit + spam honeypot.

### 5.14 Auth `/auth` (`Auth.tsx`)
- Strong split layout. Add **social sign-in** (Google already; add GitHub if desired), **magic link**,
  and **password strength meter** on signup. Ensure `aria-live` on form errors.

### 5.15 Legal `/privacy`, `/terms`
- Static; fine. Add **last-updated date** and **versioned consent** (tie to `CookieConsent`).

### 5.16 404 / error / offline
- 404 quick-links exist. Add a **"Back to what you were watching"** smart CTA (read last history).
- `error.tsx` / `global-error.tsx` → add a retry button and preserve theme; verify they don't flash.

---

## 6. Player & Watch-Party feature roadmap

1. **Binge sync (auto next-episode in party).** `PlayerShell` already advances solo. Extend host-driven
   `NEXT_EPISODE` broadcast so guests auto-advance together (elevation plan §2.3; still open).
2. **Collaborative queue.** Allow guests to **vote on what's next** in a party (add `pending_queue`
   to the room doc; host confirms).
3. **Push-to-talk** is implemented (`usePushToTalk`). Add a **hands-free voice-activity indicator**
   already present via `media.anyoneSpeaking`; expose a "mute all except host" quick action.
4. **Spatial audio** (`spatialAudio.ts` exists) — finish HRTF panning to participant tile positions.
5. **Live reaction stamps** (`SpatialReactionsLayer`) — add a **tap-to-react** mobile bar and persist
   recent reactions to the room for late joiners.
6. **Chapter/skip-intro from postMessage.** Skip-intro is a heuristic now; parse provider `PLAYER_EVENT`
   chapters when a provider sends them.
7. **Subtitles**: `useCaptions` covers non-English. Add **subtitle size/background/offset** preferences
   (synced via `useSyncedCaptionPreferences` — exists, finish wiring).
8. **Recording/clipping.** Optional: "clip the last 30s" to a shareable GIF/video URL (WebRTC + canvas).
9. **Quality/ABR.** `pickServerByQuality` works; add **bandwidth re-probing** (`useNetworkQuality`) so a
   mid-session network drop auto-downgrades the server.

---

## 7. Social, billing & notifications

1. **Notifications** — Python `notifications` + Firestore delivery exist. Add **in-app toast on
   receive**, **mark-all-read**, **channel prefs** (email/push/in-app) in `NotificationSettings`.
2. **Friends** — `FriendsList` exists. Add **presence** (online dot via Firestore presence) and
   **"Invite to party"** directly from the friends list.
3. **Reviews/comments** — `ReviewSection`, `CommentSection`, `TrendingDiscussions` exist. Add
   **rich-text/emoji** in reviews, **report/flag** (ReportDialog exists), and **pinned reviews**.
4. **Billing** — webhook bug (§2.1) first. Then **proration display**, **failed-payment dunning email**
   (worker), and **cancellation reason** capture.
5. **GDPR** — `account/export` + `account/delete` exist. Add a **self-serve download** of exported data
   with an expiry link, and confirm deletion cascades to Firestore + Postgres + Stripe + Cloudinary.

---

## 8. Accessibility & polish (invisible but essential)

1. **Focus visibility** — `focus-ring` utility exists; audit all icon-only buttons for `aria-label`
   (server selector, party FAB, resize handles).
2. **Reduced motion** — extend guards to *every* animation: tilt, parallax, ken-burns, floats,
   reactions, route transitions.
3. **Keyboard traps** — verify Radix dialogs/drawers trap focus; ensure Esc closes each overlay in the
   right order (player already handles a complex Esc ladder — keep it documented).
4. **Color contrast** — badge pills (gold-on-dark) already fixed once; re-audit rating-red/green pills
   and muted text on dark.
5. **Screen-reader** — party sync badge already `aria-live`; add live regions for chat, reactions, and
   "back in sync" toasts.
6. **Touch targets** — mobile nav buttons are `min-h-[40px]`; ensure card hover actions have
   non-hover (focus) equivalents on touch.

---

## 9. SEO, analytics & testing

1. **SEO** — `sitemap.ts`, `robots.ts`, `llms.txt`, per-title `opengraph-image`, JSON-LD exist. Add:
   - **Dynamic OG images** for person/collection pages.
   - **Structured data** for TV `Episode`/`TVSeries` (schema.org) on details.
   - **`hreflang`** already in layout; verify `alternates` for every page, not just root.
2. **Analytics** — `AnalyticsProvider` + `lib/analytics.ts` exist. Instrument: `playback_start`,
   `provider_failover`, `party_join`, `drift_snap`, `checkout_started`, `install_prompt`.
3. **Testing gaps:**
   - The two-browser party e2e is credential-gated (`PLAYWRIGHT_PARTY_E2E=1`). Add a **Firestore
     emulator + Firebase Auth emulator** CI path so the §8 protocol runs unattended.
   - Add **visual regression** (Playwright snapshots or Percy) for the 6 core routes at 390/1440.
   - Add unit tests for `webhook` idempotency (§2.1) and `pickServerByQuality`.
4. **CI** — add `npm audit`, `pip-audit`, and a `--strict` typecheck gate; keep the existing matrix.

---

## 10. Execution order (checklist)

**Wave 0 — Fixes (bugs + security), ~1 session**
- [x] 2.1 Stripe webhook idempotency
- [x] 2.2 Remove Ably from `.env.example`
- [x] 2.3 Remove/repurpose `card-preview` flag
- [x] 2.4 Drop `'unsafe-eval'` from CSP (verify build)
- [x] 2.5 Expand `Permissions-Policy`
- [x] 2.7 Backend CORS credential fix
- [x] 2.8 Server-side rate-limit audit on all mutating routes
- [x] Gate: `npm run lint && npx tsc --noEmit && npm run test:rules && npm test && npm run build`

**Wave 1 — Security hardening, ~1 session**
- [x] 3.3 single-source provider allow-list for CSP `frame-src`
- [x] 3.4 delete or SSRF-harden `/api/embed`
- [x] 2.6 embed sandbox mitigations + audit log (direct provider iframes stay unsandboxed)
- [x] 3.1 secret-hygiene CI check; finish TMDB server-side migration
- [x] 3.5 room-encryption key rotation and stale-ciphertext expiry
- [x] 2.9 `check_revoked` on sensitive endpoints

**Wave 2 — Architecture/perf, ~1 session**
- [x] 4.1/4.2 DB pooling + schema-bootstrap versioning
- [x] 4.3 player render isolation (memoize overlay/sidebar/camera grid)
- [x] 4.5 prefetch budget + 4.4 image tuning

**Wave 3 — UI/UX per page (5.1–5.16), ~2–3 sessions**
- [x] 5.1 home genre rail + personalized rail + hero auto-advance
- [x] 5.2/5.3/5.4 browse & catalog filters + URL persistence
- [ ] 5.5 My List bulk actions + import
- [ ] 5.6 search query-param sync + collections tab
- [ ] 5.7 details action bar + share sheet + related content parity
- [ ] 5.9/5.10 profile banner + badges + mutual titles + report/block
- [ ] 5.12 OfflineLibrary header unification + tabs + batch actions
- [ ] 5.13 Help/Contact consolidation

**Wave 4 — Features (player/social/billing), ~2–3 sessions**
- [ ] 6.1 binge sync, 6.2 collaborative queue, 6.3 mute-all-except-host
- [ ] 7.1 notification toasts + channels, 7.2 presence + invite-from-friends
- [ ] 7.4 proration + dunning emails, 7.5 GDPR export link + full cascade delete
- [ ] 6.9 mid-session ABR downgrade

**Wave 5 — A11y + SEO + observability, ~1 session**
- [ ] 8.1–8.6 accessibility audit
- [ ] 9.1 dynamic OG + episode structured data, 9.2 event instrumentation
- [ ] 9.3 emulator-based party e2e + webhook unit tests + visual regression
- [ ] 9.4 CI audit + strict gate

**Definition of done (each wave):** the Wave-0 gate green, plus a manual visual pass of every changed
route at 390px (mobile) and 1440px (desktop), with reduced-motion enabled.

---

## 11. Explicit "do NOT do" list (protects prior wins)

- Do **not** re-add the floating `CardPreviewPanel` (regression the users already rejected).
- Do **not** re-add Ably or any third-party pubsub — the self-hosted Firestore + WebRTC transport wins.
- Do **not** re-add `sandbox` to provider iframes blindly — it white-screens the players; apply §2.6
  mitigations instead.
- Do **not** redesign the design tokens / CSS layers — extend them.
- Do **not** change provider ordering (YapGrid last) without updating `STREAMING_SOURCES_PLAN.md` and
  the e2e assertion in lockstep.
