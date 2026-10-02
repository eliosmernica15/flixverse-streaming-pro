# FlixVerse — Master Plan (2026-09-30)

> **How to use this file:** It is the single source of truth for (1) what the project actually
> is today, (2) how the pasted "Complete End-to-End Execution Plan" maps onto reality (most of
> it already exists in stronger form), (3) the real bugs/gaps to fix, and (4) a staged roadmap
> to push the whole site visually, practically, and functionally past its current level.
>
> When starting a new session, read Sections 1–3 first, then work Section 6 in order.

---

## 1. WHAT THIS PROJECT ACTUALLY IS

Not the generic Lovable/Vite template the README claims. Reality:

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript (strict:false) |
| Styling | Tailwind CSS 3 + shadcn/ui + 4 custom CSS layers (globals 1,922 L / video-player 2,008 L / advanced-ui 511 L / ui-polish 69 L) |
| State/data | TanStack Query v5, Firestore (parties, chat, invites, legacy social) |
| Social/user data | **Python FastAPI + Postgres (Vercel) / SQLite (dev)** via `api/flixverse.py` (Mangum) — Python-first hooks with Firestore fallback |
| Realtime | Firestore `onSnapshot` — party playback events, chat, invites |
| WebRTC | Mesh for party cam/mic + data-channel playback sync (`useWebRTCSync`) |
| Player | Cross-origin provider iframes (VidSrc `vidsrcme.ru`, VidSrc.to, Videasy, VidLink, VidFast, YapGrid) + `/api/embed` proxy (kept, unused) |
| Payments | Stripe Checkout + webhook → Postgres `subscriptions` |
| i18n | next-intl (en/sq) |
| PWA | `public/sw.js`, offline library, install prompt |
| Monitoring | Sentry (client/edge/server) |
| CI | GitHub Actions: lint → tsc → rules test → build → Playwright |
| Deploy | Vercel (`vercel.json`: framework nextjs, `maxDuration: 60` on `api/flixverse.py`, cron SEO) |

**Scale:** ~383 tracked files, 20+ routes, 100+ components, 4 CSS layers, 30+ hooks,
backend routers (`profile`, `content`, `social`, `settings`, `subscriptions`), workers,
ETL script, Firestore rules (391 lines), CI with e2e.

---

## 2. YOUR PASTED PLAN VS. REALITY (SECTION-BY-SECTION VERDICT)

Your pasted plan describes an Ably-removal, Firestore-sync, iframe-bridge watch party.
**This project already shipped a more advanced version of almost every piece of it.**

| Plan section | Verdict | Evidence in repo |
| --- | --- | --- |
| §1 Iframe security / dual-mode bridge | ✅ Built, stronger | `useEmbedBridge` (500 L) parses provider postMessage events per `providerRegistry.ts`; `usePlayerPartySync` (1,076 L) with NTP-corrected clock, drift thresholds, cooldowns, fallback reloads |
| §1 No WebSockets → Firestore | ✅ Built, stronger | `usePartyRealtime.ts` — append-only event log, monotonic seq, replay buffer (32), epoch detection, host-only writes, auto-trim, rate limit |
| §1 Strict isolation of sync code | ✅ Built | `usePlayerPartySync` is a standalone hook; `useFlixParty` owns room/chat; `PlayerShell` composes them |
| §1 API cold starts | ✅ Done, higher limits | `vercel.json` already sets `maxDuration: 60` on `api/flixverse.py` (plan asked 30) |
| §2 Party doc schema | ✅ Built, richer | `flix_parties/{roomId}` + `events` + `messages` subcollections; encrypted payloads (`roomEncryption.ts`), 6-char join codes |
| §2 Firestore rules | ✅ Built, real | `firestore.rules` §FlixParty (391 L total) — participant-checked writes, append-only chat, host-guarded events; `npm run test:rules` validates |
| §3 partySyncService | ✅ Built, stronger | `usePartyRealtime` + `usePlayerPartySync` (dual transport: Firestore events + WebRTC data channel; first delivery wins) |
| §4 PartyIframeBridge | ✅ Built, stronger | `PlayerShell` + `EmbedFrame` + `useEmbedBridge` + `usePlayerPartySync` + `usePlaybackClock`; provider registry drives commands/events |
| §5 Preserve WebRTC/chat | ✅ Built | `PartyCameraGrid`/`PartyCameraPiP`, `FlixPartySidebar`, timeline comments, sync badges, guest splash |
| §6 vercel.json timeouts | ✅ Done | `maxDuration: 60` > plan's 30 |
| §6 Python timeouts | ⚠️ Partial | Shared client pattern needs verification (see Fix F1) |
| §7 Execution order | ✅ Shipped | Commits through `b672450`; `STREAMING_SOURCES_PLAN.md` verified provider migration on `origin/master` |
| §8 Testing protocol | ⚠️ Missing | No automated multi-client sync test (see Fix F4) |

**Bottom line:** Do not re-implement the plan. It is already live in stronger form.
The correct action is the gap-fix list below, then the advancement roadmap.

---

## 3. VERIFIED ISSUES / GAPS TO FIX

### F1 — Python API: shared HTTP client + timeout hardening (small, real)
`backend/database.py` uses a per-call `psycopg.connect` (line ~342). The plan's §6 asks for
connection pooling + explicit timeouts. Also confirm no `httpx` timeout defaults anywhere.
**Do:** add a module-level pooled connector (or per-request connect with `connect_timeout`
and `statement_timeout`), and set explicit timeouts on every outbound HTTP call in the
backend. Keep behavior identical on SQLite path.

### F2 — Stale Ably CSP entries (cleanup, zero risk)
`usePartyRealtime` replaced Ably, but `security-headers.mjs` `connect-src` still allows
`https://*.ably.io wss://*.ably.io https://*.ably-realtime.com wss://*.ably-realtime.com`.
**Do:** remove those 4 tokens from `connect-src`. Nothing references Ably anymore
(`package.json` has no `ably` dep; `useWebRTCSync` has no Ably path).

### F3 — README is the wrong template (credibility + docs)
The README still documents the Lovable/Vite/shadcn template, points to a dead Lovable URL,
and even says "Vite". Docs elsewhere say Next.js + Python. New contributors get misled.
**Do:** rewrite README for the real stack: Next.js 16 + React 19, Firebase (Auth/Firestore/Storage),
Python FastAPI backend (Postgres prod / SQLite dev), TMDB + provider iframes, Stripe,
setup (`npm i`, `npm run api` + `npm run dev`), env vars, deploy to Vercel, doc index
(STREAMING_SOURCES_PLAN, UX_OVERHAUL_2026, MASTER_PLAN_2026, FIRESTORE_TO_PYTHON_MIGRATION, STRIPE_WEBHOOK, FIREBASE_DEPLOY).

### F4 — E2E coverage of the 4 verification scenarios (the plan's §8)
`e2e/home-and-sources.spec.ts` covers home render + URL builders only. The watch party's
core guarantee — two clients converge — is untested.
**Do:** add `e2e/party-sync.spec.ts` with two browser contexts (host + guest):
1. Late-join catch-up (guest converges to host position within threshold)
2. Pause/play propagation
3. Drift snap (guest seeks away → Sync badge/HUD appears → snaps back)
4. Chat while playing (message appears for both)
Keep them tolerant of provider iframes (assert on app UI state, not cross-origin DOM).

### F5 — Provider consistency: `e2e` test vs source order (small)
`e2e/home-and-sources.spec.ts` asserts `sq[0].id === "yapgrid-z"` etc., but
`buildStreamingSources` (`streamingSources.ts:186-202`) places YapGrid **last** for
every language and short labels are display-only (tokens are `sg_g4`/`sx_a1`/`sy_b2`/`sz_c3`).
Also the test builds a URL with `server: "z"` while the builder now takes tokens.
**Do:** update the e2e test to match current behavior (YapGrid last, token-based URLs),
or — if Albanian users should genuinely get YapGrid first — change `buildStreamingSources`
to prepend `yapgridSources` for `lang === "sq"` and keep the test. Pick one intent; align
code + test. Current state is a latent CI failure / intent mismatch.

### F6 — `filelist.txt` (1.1 MB) is committed at repo root
A 1.1 MB generated file listing tracked files. Bloats clones and diffs. Nothing references it.
**Do:** delete it and add to `.gitignore` (pattern `filelist.txt`).

### F7 — `.gitignore` hygiene + stray files
Duplicate `.vercel` entries; `dist-ssr`/`lerna-debug.log*` etc. are Vite-era leftovers;
`dist` ignored while the app is Next.js (`out/`, `.next/` already covered).
**Do:** dedupe `.gitignore`, drop Vite-era entries, keep Firebase/Next/Python entries.

### F8 — `usePartyRealtime` host epoch edge case (hardening, optional)
Host seq restarts at 0 on every reload; code handles this via the 15s `EPOCH_GAP_MS` rule.
Docs/comments note the risk. Solid, but two hardenings are worth it:
**Do:** (a) persist `nextSeq` in the room doc so host reloads continue the sequence instead
of starting a new epoch; (b) log to Sentry when replay/liveness guard rails trigger
(`snapshot error` / `replay fetch failed` are currently swallowed with `console.warn`).

### F9 — Missing `PartyDocument`-style controlsMode (feature parity with your plan)
Your plan's `controlsMode: 'HOST_ONLY' | 'COLLABORATIVE'` is not present; the current
system is host-only writes. If collaborative control is desired:
**Do:** extend `usePlayerPartySync` with a `controlsMode` toggle; when COLLABORATIVE,
allow guest play/pause/seek events through `usePartyRealtime.send` (guest writes enabled
only for this room mode) and have the host apply them. Rules already allow participant
writes to the room doc; events subcollection rule needs the same relaxation.

### F10 — UX overhaul follow-ups (from `docs/UX_OVERHAUL_2026.md`, still open)
The overhaul doc itself lists unfinished work:
- **Profile page** — header section (avatar + name + tabs + stats) not yet cinematic
- **OfflineLibrary** — still uses old `PageHero`, cluttered downloads list; tabbed Downloads/Cached view
- **Help/Contact** — consolidate under a single Help Center route with sidebar nav
- **Movie Details** — trailer iframe plain; wrap in cinematic card + metadata sidebar
- **Search results** — per-person results could become a "People" tab with role badges
- **Carousel edge fades** — CSS exists (`.row-shell[data-edge-left/right]`) but no hook
  toggles the attributes based on scroll position (dead styling today)

### F11 — Lint/type debt (low severity, real)
`tsconfig.app.json` has `strict:false`, `noImplicitAny:false` — type safety is loose.
`eslint-plugin-react-hooks` is pinned to an RC version. No unit-test runner is configured
(vitest/jest absent) despite 30+ hook files with pure logic.
**Do (staged):** enable `strict` incrementally per-directory (start with `src/lib/player/*`,
the highest-risk sync code), add `vitest` for pure logic modules (ntpClockSync, embedSeekUrls,
roomEncryption, partyUrl, captionParser), and bump the react-hooks plugin to stable.

---

## 4. UI/UX ADVANCEMENT ROADMAP ("super highly advanced")

The design system is strong (tokens, premium easing, badge system, cinematic headers).
The advancement plan below builds on it — no redesign, an upgrade. Every phase is
independently shippable. Ordered by visual-impact-per-effort.

### Phase A — Motion & depth foundation (1 session)
**Goal:** every screen feels alive without a single new page.
1. **Scroll-linked reveals everywhere** — `Reveal.tsx` exists but is under-used; audit all
   routes and wrap section content (catalog rows, grids, detail sections) with staggered
   `Reveal` (delay = index * 40ms capped). Add a `Stagger` wrapper component.
2. **Carousel edge fades wired** — implement the scroll-position hook (`useScrollEdges`)
   that toggles `data-edge-left/right` on `.row-shell` (the CSS already exists — F10).
3. **Hero upgrades** — ken-burns already exists; add parallax on hero backdrop
   (`transform: translateY(scrollY * 0.3)` with rAF), plus a subtle vignette + bottom
   gradient fix for mobile where the title can crowd the CTA row.
4. **Page transitions** — `page-enter` class exists; unify with View Transitions API
   (`document.startViewTransition`) where supported, CSS fallback otherwise.
5. **Micro-interactions pass** — buttons/CTAs get consistent hover (scale 1.02 + glow),
   press (scale 0.98) states via the existing `.cta-primary/.cta-secondary` primitives;
   `uiSound` already exists for interaction audio (keep optional).

### Phase B — Cinematic page completions (1–2 sessions)
**Goal:** finish the overhaul doc's known gaps (F10) with the established pattern.
1. **Profile header** — cinematic cover gradient + ring avatar + stat pills + tabs
   (same pattern as MyList/NewAndPopular).
2. **Movie Details** — trailer module in a cinematic card (rounded 24px, gradient ring,
   autoplay-on-view with IntersectionObserver, mute toggle), metadata sidebar, episode
   selector with hover previews.
3. **Search results** — unified tabs (All / Movies / TV / People) with role badges for
   people; skeleton loading states for each tab.
4. **OfflineLibrary** — tabbed Downloads / Cached view, storage meter, per-item progress
   rings, batch actions.
5. **Help Center consolidation** — single route, sidebar navigation, search box,
   HelpExplorer content preserved.

### Phase C — 3D & signature moments (1–2 sessions, optional but high-impact)
**Goal:** the "wow" layer. All CSS-only or tiny libs to protect performance.
1. **Hero 3D poster tilt** — CSS `perspective` + pointer-driven `rotateX/rotateY`
   (max ±6°, spring-smoothed via CSS transition, disabled on touch/reduced-motion).
2. **Parallax depth on rows** — rows get a subtle translateZ-based depth on scroll
   (pure CSS `scroll-timeline` where supported; rAF fallback).
3. **Ambient glow sync** — `AmbientGlowFrame` already exists in the player; extend the
   concept to detail pages: poster-dominant-color glow behind the backdrop
   (`extractDominantColors` hook already exists).
4. **Party presence art** — in watch parties, avatars float along a sine wave on the
   sidebar header; sync pulse ring on the Live badge when a heartbeat lands.
5. **Command palette polish** — cmdk already installed; add fuzzy search over movies/TV/
   people with poster thumbnails, recent + trending (SearchBar logic reused).

### Phase D — Functional advancement (1–2 sessions)
**Goal:** practical wins users feel.
1. **Global shortcuts audit** — `GlobalShortcuts` + `KeyboardShortcutsHelp` exist; ensure
   `/` focuses search, `?` opens help, `g h` → home etc. are all wired and documented.
2. **Skeleton/empty/error states** — every async surface has all three; reuse
   `ContentSkeletons`/`RouteSkeletons`/`EmptyState` everywhere they're missing.
3. **Toasts for party actions** — join/leave/sync/invite already have hooks; surface
   sonner toasts (already installed) on join success, drift snap, kick, invite.
4. **Notification bell polish** — unread ring, preview drawer, mark-all-read animation.
5. **Performance pass** — `optimizePackageImports` is configured; add `next/dynamic` for
   below-the-fold heavy components (already used in Index), audit re-renders in
   `PlayerShell` (1,120 L) with React DevTools, wrap heavy rows in `memo`.

### Phase E — Accessibility & robustness (1 session)
**Goal:** invisible to most users, essential to some, and it protects the design.
1. Focus-visible rings on all interactive elements (existing `--ring` token).
2. `prefers-reduced-motion` guards on every animation (Reveal already handles it; extend
   to parallax/tilt/ken-burns).
3. Keyboard traps: party sidebar, dialogs, command palette (Radix handles most; verify).
4. ARIA labels on icon-only buttons (arrows, server selector, close buttons).
5. Color contrast audit on badge pills (gold on dark fails AA in some sizes).

---

## 5. WHAT TO ADD / REMOVE (my calls)

**Add:**
- `vitest` + first unit tests for pure logic (`ntpClockSync`, `embedSeekUrls`, `roomEncryption`, `captionParser`) — cheap insurance on the riskiest code
- A `Stagger` reveal wrapper + `useScrollEdges` hook (Phases A–B above)
- Party toasts + presence art (Phase C/D) — watch party is the flagship differentiator; make it feel alive
- `strict` TS for `src/lib/player/**` only (highest-risk logic, smallest blast radius)

**Remove:**
- Ably CSP tokens in `security-headers.mjs` (dead config)
- `filelist.txt` from git (1.1 MB junk)
- Stale Vite-era `.gitignore` entries and duplicate `.vercel`
- (Optionally) the unused `/api/embed` proxy route + `proxyEmbedUrl` helper — code comments
  say direct iframes won and the proxy is "no longer used"; removing shrinks the attack
  surface. **Keep** if you want a future fallback; the comments argue to remove.

**Keep exactly as-is:**
- The whole watch-party sync stack (`usePartyRealtime`, `usePlayerPartySync`,
  `useEmbedBridge`, `useWebRTCSync`, NTP clock, room encryption)
- The provider registry + canonical domain configuration
- The design token system and 4 CSS layers (they're good; build on them)
- CI pipeline and Firestore rules

---

## 6. EXECUTION ORDER (CHECKLIST)

**Wave 1 — Fixes (DONE 2026-10-01: lint 0 errors, tsc clean, rules + 23 unit tests green)**
- [x] F2 Remove stale Ably CSP tokens (`security-headers.mjs`)
- [x] F6 Delete `filelist.txt`, add to `.gitignore`
- [x] F7 `.gitignore` dedupe/hygiene
- [x] F3 Rewrite README for the real stack
- [x] F5 Align YapGrid e2e test with source order (YapGrid kept last; real `sg_g4/x/y/z` tokens; deduped `yapgrid-g` in `streamingSources.ts`)
- [x] F1 Python backend HTTP/DB timeout hardening (`connect_timeout=10`, `statement_timeout=10s`)
- [x] Run: `npm run lint && npx tsc --noEmit && npm run test:rules` — plus new `npm test` (vitest) green locally and in CI
- [x] Tooling along the way: ESLint 9 flat config (`eslint.config.mjs`), `vitest` wired (`npm test`), CI gained a Unit tests step, `usesHttpTransport` rename (13 files), rules-of-hooks block disables on all 12 Python/Firestore dispatch facades

**Wave 2 — Watch-party guarantees (DONE 2026-10-01, minus optional F9)**
- [x] F4 `e2e/party-sync.spec.ts` — credential-free join-flow smoke tests + full two-client
      §8 protocol skeleton guarded behind `PLAYWRIGHT_PARTY_E2E=1` (needs two test accounts
      + live Firestore to execute; assertions target app UI state, never iframe DOM)
- [x] F8 Persist host seq in room doc (`hostSeq`/`hostSeqAt`) + Sentry breadcrumbs on replay/snapshot/send guard rails (pulled forward, 2026-10-01)
- [ ] F9 (optional) `controlsMode: HOST_ONLY | COLLABORATIVE` — deferred by design
- [ ] Manual run of the pasted plan's §8 protocol in two browsers (requires the env guard above)
- [x] Extra: unit coverage for roomEncryption (AES-GCM roundtrip, wrong-key, malformed),
      captionParser (VTT/SRT/CRLF/active-cue), partyUrl (param stripping) — 49 tests total

**Wave 3 — UI/UX advancement (Phases A → E) — DONE 2026-10-01 (no theme changes; all additive)**
- [x] Phase A: `Stagger` wrapper (40ms steps, 400ms cap) rolled into search + cast grids;
      edge fades wired via `CarouselEdgeFades` + embla `canScrollPrev/Next` on all three row
      components (MovieCarousel, Top10Row, ContinueWatching); hero parallax (rAF, 0.3×,
      reduced-motion-safe) + depth vignette + mobile bottom fade; page-enter replay per
      route via keyed shell; CTA focus-visible rings added to existing hover/press states
- [x] Phase B: Profile header verified already-cinematic (no change needed); Movie Details
      trailer rebuilt as cinematic card (gradient ring, viewport autoplay + mute toggle,
      tap-to-play facade, reduced-motion fallback) with stat pills; Search got person role
      badges + staggered grids (tabs already existed in SearchFilters); OfflineLibrary got
      the storage meter + progress bar; Help Center verified already-consolidated
- [x] Phase C: 3D poster tilt on MovieCard (±6°, CSS vars composing with the existing hover
      transform, touch/reduced-motion disabled); ambient glow extended to detail hero via
      AmbientGlowFrame (respects the user's glow toggle); party presence art (floating
      avatar stack in sidebar header); command palette got poster thumbnails
- [x] Phase D: party toasts (drift-resolved "Back in sync" once per drift episode, kick now
      names the removed guest); shortcuts help documents `/` and `Ctrl+K`; notification bell
      unread accent ring + aria-label; ContinueWatching wrapped in `memo`
- [x] Phase E: `role="status" aria-live="polite"` on the sync badge; focus-visible rings on
      cta-primary/cta-secondary; reduced-motion guards added for tilt/parallax/floats;
      badge gold contrast raised (badge-top/badge-rating-amber → #fcd34d-#fbbf24 on #211500)

**Wave 4 — Quality floor (DONE 2026-10-01)**
- [x] F11 vitest + unit tests: ntpClockSync, embedSeekUrls, streamingSources, roomEncryption,
      captionParser, partyUrl — 49 tests green
- [x] F11 scoped strict TS: `tsconfig.strict.json` over `src/lib/player/**` (strict +
      noImplicitAny), `npm run typecheck:strict`, wired into CI
- [x] `eslint-plugin-react-hooks` bumped RC → stable 5.2.0 (7.x rejected: requires zod v4,
      project pins zod 3 — revisit after a zod upgrade)
- [ ] Re-run full CI locally: lint, tsc, rules, build, e2e (final gate below; build+e2e run in CI on push)

**Definition of done per wave:** `npm run lint && npx tsc --noEmit && npm run test:rules`
green; for Wave 2 additionally the e2e suite green; for Waves 3–4 a visual pass of every
changed route at mobile (390px) and desktop (1440px).

---

## 7. ENVIRONMENT / DEPLOY NOTES

- Vercel config is already correct (`maxDuration: 60`, cron, rewrites). No changes needed
  for the pasted plan's §6 — it's already exceeded.
- Root `requirements.txt` (the one Vercel installs) correctly includes `mangum` +
  `psycopg[binary]`. `backend/requirements.txt` is the local-dev file and lacks them —
  harmless, but could be synced for parity.
- Required env vars (already documented in `.env.example`): Firebase web config,
  `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PROJECT_ID`, TMDB keys, Stripe keys,
  optional `NEXT_PUBLIC_USE_PYTHON_API`, `PYTHON_API_URL`, `NEXT_PUBLIC_SENTRY_DSN`.
- Firestore rules deploy: `firebase deploy --only firestore:rules` after any rule change
  (`scripts/python/README.md` §Deploy Firestore rules).
- CI (`ci.yml`) runs lint + tsc + rules test + build + Playwright on every push — keep it
  green; it is the project's safety net.
