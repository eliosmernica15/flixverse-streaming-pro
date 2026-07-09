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
| `process_jobs.py` | Drains `pending_jobs` → `notifications` + `activity_feed` |
| `process_reports.py` | Copies new `reports` → `moderation_queue` |

### Run once

```bash
python process_jobs.py --once
python process_reports.py
```

### Run as background worker (follow/review notifications)

```bash
python process_jobs.py --interval 30
```

Use Windows Task Scheduler or cron to run `process_reports.py` every few minutes.

## How the app enqueues work

The Next.js app writes to `pending_jobs` (allowed by Firestore rules) when users:

- **Follow** someone → `follow_notify`
- **Post a review** → `activity_review`

Reports still go to `reports`; Python syncs them to `moderation_queue`.

## Deploy Firestore rules

After changing rules (includes `pending_jobs`):

```bash
firebase deploy --only firestore:rules
```
