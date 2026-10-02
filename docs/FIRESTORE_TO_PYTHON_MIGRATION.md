# Firestore → Python Postgres migration

This document tracks the migration of FlixVerse's user data (watch history,
ratings, reviews, follows, friends, etc.) off Firestore onto the project's
own Postgres (Vercel Postgres) / SQLite (local) backend served by the FastAPI
app under `api/flixverse.py`.

## Why

- The free Firestore tier has a daily read quota that the app's social activity
  was exceeding, producing `FirebaseError: [code=resource-exhausted]` in the
  browser console.
- Hosting the data in our own Postgres keeps the bills flat, lets us own
  the schema, and removes a hard external dependency for the most-frequently
  read collections.

## What changed

### New Postgres tables (`backend/database.py`)

| Table | Replaces Firestore |
| --- | --- |
| `profiles` | `/profiles/{userId}` |
| `usernames` | `/usernames/{handle}` |
| `watch_history` | `/watch_history/{historyId}` |
| `user_movie_lists` | `/user_movie_lists/{itemId}` |
| `reviews` | `/reviews/{reviewId}` |
| `comments` | `/comments/{commentId}` |
| `follows` | `/follows/{followId}` |
| `friendships` | `/friendships/{friendshipId}` |
| `friend_requests` | `/friend_requests/{requestId}` |
| `content_ratings` | `/content_ratings/{ratingId}` |
| `activity_feed` | `/activity_feed/{activityId}` |
| `user_settings` | `/user_settings/{userId}` |
| `member_profiles` | `/member_profiles/{profileId}` |
| `subscriptions` | `/subscriptions/{userId}` |
| `stripe_webhook_events` | `/stripe_webhook_events/{eventId}` |

### New Python routers (`backend/routers/*.py`)

- `profile.py` — get/update profile, reserve/resolve username
- `content.py` — watch history, user movie list, content rating
- `social.py` — reviews, comments, follow/unfollow, friends, activity feed
- `settings.py` — get/save user settings
- `subscriptions.py` — read-only subscription view

### New client hooks

Each public hook now routes through the Python API on Vercel and falls
back to Firestore for local dev (`isPythonBackendEnabled()` flips
based on hostname / env var). The Python implementations live in
`*Python.ts` next to the Firestore ones.

| Hook | Status |
| --- | --- |
| `useWatchHistory` | ✅ Python-first |
| `useUserMovieList` | ✅ Python-first |
| `useContentRating` | ✅ Python-first |
| `useUserActivity` | ✅ Python-first |
| `useReviews` | ✅ Python-first |
| `useComments` | ✅ Python-first |
| `useFollow` | ✅ Python-first |
| `useFriends` | ✅ Python-first |
| `useUserProfile` | ✅ Python-first |
| `useSubscription` | ✅ Python-first |
| `useUserPreferences` | localStorage only — no migration needed |
| `useNotifications` | already Python-first (Phase 0) |

### ETL script (`scripts/python/etl_firestore_to_postgres.py`)

```bash
# Dry run — read Firestore, print counts
python scripts/python/etl_firestore_to_postgres.py --dry-run

# Local SQLite (for testing the schema)
python scripts/python/etl_firestore_to_postgres.py --local

# Production
POSTGRES_URL=postgres://... \
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' \
python scripts/python/etl_firestore_to_postgres.py
```

Re-runnable: every collection insert uses `ON CONFLICT DO UPDATE` /
`DO NOTHING`, so re-running won't duplicate rows.

## What is NOT migrated

- **Realtime updates** — Vercel serverless functions don't support
  long-lived WebSockets. The Python `useXPython.ts` hooks fall back to
  HTTP polling (8–25s depending on collection).
- **Firestore Security Rules** — replaced by `verify_bearer()` on every
  Python route, which checks the Firebase ID token.
- **`/likes` collection** — small and low-write; not in the
  Python schema yet. UI keeps using Firestore for likes.

## How the proxy works

`vercel.json` rewrites `/api/flixverse/:path*` to `api/flixverse.py`,
which is a Mangum handler wrapping the FastAPI `app` in `backend/main.py`.
So `pythonFetch("/profile/me")` → `/api/flixverse/profile/me` → Python
app. No Next.js proxy route is required.

## After deploy

1. Run ETL against the production Postgres (`POSTGRES_URL` from Vercel
   project env).
2. Verify the migration by reading a known watch_history entry from
   the Vercel app.
3. (Optional) Set `NEXT_PUBLIC_USE_PYTHON_API=true` for local dev
   if you want to validate the new stack before deleting Firestore.
