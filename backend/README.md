# FlixVerse Python API

SQLite + WebSockets backend for notifications, watch parties, chat, and invites.  
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

## Deploy (Render.com free)

1. New **Web Service** → connect GitHub repo
2. Root directory: `backend`
3. Build: `pip install -r requirements.txt`
4. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Env vars: `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PROJECT_ID`, `CORS_ORIGINS`

On **Vercel**, set:

```
NEXT_PUBLIC_USE_PYTHON_API=true
PYTHON_API_URL=https://your-api.onrender.com
NEXT_PUBLIC_PYTHON_WS_URL=wss://your-api.onrender.com
```

## Storage

SQLite file: `backend/data/flixverse.db` (override with `FLIXVERSE_DB_PATH`).
