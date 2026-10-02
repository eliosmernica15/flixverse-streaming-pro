# FlixVerse

A cinematic streaming experience: browse movies & TV via TMDB, play through
resilient multi-provider embeds, and host real-time watch parties with synced
playback, WebRTC camera/mic, and live chat.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS · shadcn/ui |
| Auth & realtime | Firebase Auth · Firestore (`onSnapshot`) · Firebase Storage |
| Social/user data | Python FastAPI backend — Postgres (production) / SQLite (local dev) |
| Player | Multi-provider embeds (VidSrc, Videasy, VidLink, VidFast, YapGrid) with a provider-aware postMessage bridge |
| Payments | Stripe Checkout + webhook → Postgres |
| i18n | next-intl (English / Albanian) |
| PWA | Service worker, offline library, install prompt |
| Monitoring | Sentry · PostHog |
| Deploy | Vercel (Next.js + Python serverless via Mangum) |

## Getting started

```bash
npm install

# Terminal 1 — Python API (optional; the app falls back to Firestore)
cd backend && pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Next.js
npm run dev
```

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_FIREBASE_*` — Firebase web app config
- `NEXT_PUBLIC_TMDB_API_KEY` / `TMDB_ACCESS_TOKEN` — TMDB API
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — billing (optional locally)
- `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PROJECT_ID` — Python backend
- `POSTGRES_URL` — production database (local dev uses SQLite automatically)
- `NEXT_PUBLIC_USE_PYTHON_API`, `PYTHON_API_URL` — Python-first data routing
- `NEXT_PUBLIC_SENTRY_DSN` — error monitoring (optional)

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run api` | Python API on `:8000` |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npm run test:rules` | Firestore rules validation |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run worker:jobs` / `npm run worker:reports` | Python background workers |

## Architecture overview

- **Watch party sync** — the host writes playback events (play/pause/seek/heartbeat)
  to an append-only Firestore log (`flix_parties/{roomId}/events`) with monotonic
  sequence numbers; guests replay and subscribe with NTP-corrected clock math. A
  WebRTC data channel mirrors the stream as redundancy — first delivery wins.
  Guests that drift beyond the soft threshold get postMessage seeks; beyond the
  hard threshold, a positioned iframe reload.
- **Provider embeds** — canonical provider domains are pinned in
  `src/lib/streamingSources.ts` and mirrored in the CSP (`security-headers.mjs`
  + `middleware.ts`). Keep those in sync when adding a provider.
- **Data ownership** — social data (profiles, history, reviews, follows,
  subscriptions) lives in the Python/Postgres backend; realtime surfaces
  (parties, chat, invites, notifications delivery) live in Firestore.

## Documentation

| Doc | Contents |
| --- | --- |
| [`docs/MASTER_PLAN_2026.md`](docs/MASTER_PLAN_2026.md) | Current state, active fix list, and the UX advancement roadmap |
| [`STREAMING_SOURCES_PLAN.md`](STREAMING_SOURCES_PLAN.md) | Provider registry history, canonical domains, verification checklist |
| [`docs/UX_OVERHAUL_2026.md`](docs/UX_OVERHAUL_2026.md) | Netflix-grade redesign decisions and follow-ups |
| [`docs/FIRESTORE_TO_PYTHON_MIGRATION.md`](docs/FIRESTORE_TO_PYTHON_MIGRATION.md) | Postgres schema, routers, ETL |
| [`docs/STRIPE_WEBHOOK.md`](docs/STRIPE_WEBHOOK.md) | Billing setup and webhook sync |
| [`docs/FIREBASE_DEPLOY.md`](docs/FIREBASE_DEPLOY.md) | Firebase project deployment |
| [`scripts/python/README.md`](scripts/python/README.md) | Workers, service accounts, rules deploy |

## Deployment (Vercel)

1. `npx vercel link` and add Vercel Postgres (provides `POSTGRES_URL`).
2. Set env vars on Vercel (see `.env.example`; secrets via the dashboard).
3. Deploy — `vercel.json` pins `nextjs` framework defaults, a 60s limit for
   `api/flixverse.py`, the `/api/flixverse/*` rewrite, and a daily SEO cron.
4. After any `firestore.rules` change: `firebase deploy --only firestore:rules`.
5. First production boot: run the ETL once if migrating from Firestore
   (`scripts/python/etl_firestore_to_postgres.py`).

## CI

GitHub Actions runs lint, type check, Firestore rules tests, production build,
and Playwright e2e on every push and PR (`.github/workflows/ci.yml`).
