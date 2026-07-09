# Firebase deployment (Spark / free tier)

Project: **`streaming-web-2272d`**

## What runs on Firebase free (Spark)

| Service | Status |
|---------|--------|
| Firestore | Yes — rules + indexes deployed |
| Auth | Yes |
| Storage | Yes (within quotas) |
| **Cloud Functions** | **No** — requires Blaze for production use |

## Background work → Python (not Cloud Functions)

Server-side triggers are handled by **Python workers** in `scripts/python/`:

- `process_jobs.py` — follow notifications, review activity feed
- `process_reports.py` — moderation queue from user reports

See [scripts/python/README.md](../scripts/python/README.md).

## Deploy Firestore only

```bash
firebase use streaming-web-2272d
firebase deploy --only firestore:rules,firestore:indexes
```

## Python worker (local or free cron)

```bash
cd scripts/python
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
python process_jobs.py --once
python process_reports.py
```

Run `process_jobs.py` (without `--once`) in the background or schedule both scripts.

## Next.js hosting

Deploy the app on Vercel, Netlify, or similar — API routes use Admin SDK when env vars are set; no Firebase Functions billing.
