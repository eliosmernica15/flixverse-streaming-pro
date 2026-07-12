# FlixVerse Python API

Postgres + HTTP polling backend for notifications, watch parties, chat, and invites on **Vercel serverless**.  
**No Firestore daily quota** for these features.

## Run locally

```bash
cd backend
pip install -r requirements.txt
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
set FIREBASE_PROJECT_ID=streaming-web-2272d
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

From repo root (with `.env.local`):

```bash
npm run api          # Python API on :8000
npm run dev          # Next.js on :3000
```

Set in `.env.local`:

```
NEXT_PUBLIC_USE_PYTHON_API=true
PYTHON_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_PYTHON_WS_URL=ws://127.0.0.1:8000
```

Local dev uses SQLite (`backend/data/flixverse.db`) and WebSockets for real-time signals.

## Deploy (Vercel)

Python runs as a serverless function at `/api/flixverse` via `api/flixverse.py` (FastAPI + Mangum).

1. Link project: `npx vercel link`
2. Add **Vercel Postgres** storage (provides `POSTGRES_URL`)
3. Set env vars on Vercel:
   - `NEXT_PUBLIC_USE_PYTHON_API=true`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (full JSON, single line)
   - `FIREBASE_PROJECT_ID=streaming-web-2272d`
4. Deploy: `npx vercel --prod`

On Vercel, WebSockets are unavailable — clients use HTTP polling for notifications and WebRTC signals.

## Storage

- **Production (Vercel)**: Postgres via `POSTGRES_URL` / `DATABASE_URL`
- **Local dev**: SQLite at `backend/data/flixverse.db` (override with `FLIXVERSE_DB_PATH`)
