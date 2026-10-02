# FlixVerse Python workers (Firebase Spark / free tier)

No Cloud Functions or Blaze plan required. These scripts use the **Firebase Admin SDK** locally or on any free cron host.

## Setup

```bash
cd scripts/python
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

Set credentials (pick one):

```bash
# Option A: service account JSON file
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\streaming-web-2272d-service-account.json

# Option B: inline JSON (CI)
set FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# Option C: gcloud ADC
gcloud auth application-default login
```

Project defaults to `streaming-web-2272d`. Override with `FIREBASE_PROJECT_ID`.

## Scripts

| Script | Purpose |
|--------|---------|
| `process_jobs.py` | Drains `pending_jobs` → `notifications` + `activity_feed` (poll every 10s) |
| `process_reports.py` | Copies new `reports` → `moderation_queue` |

### Run once

```bash
python process_jobs.py --once
python process_reports.py
```

### Run as background worker (follow/review notifications)

```bash
python process_jobs.py --interval 10
```

Use Windows Task Scheduler, cron, or a free host (Railway/Render) to keep this running.  
For **instant** notifications on Vercel, set `FIREBASE_SERVICE_ACCOUNT_JSON` in Vercel env — the app will use `/api/notifications/dispatch` (Admin SDK) first and only fall back to `pending_jobs` if the API is unavailable.

## How the app enqueues work

The Next.js app:

- **Friend / party notifications** → `POST /api/notifications/dispatch` (verified token + Admin SDK), or `pending_jobs` type `social_notify` as fallback
- **Follow** someone → `follow_notify` job (or API when configured)
- **Post a review** → `activity_review` job

Reports still go to `reports`; Python syncs them to `moderation_queue`.

## Deploy Firestore rules

After changing rules (includes `pending_jobs`):

```bash
firebase deploy --only firestore:rules
```
