"""FlixVerse Python API — Vercel serverless + Postgres/SQLite."""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, storage_label
from routers import (
    account,
    content,
    notifications,
    parties,
    profile,
    settings,
    social,
    subscriptions,
)

init_db()

app = FastAPI(title="FlixVerse API", version="1.2.0")

API_PREFIX = "/api/flixverse" if os.environ.get("VERCEL") == "1" else ""

app.include_router(account.router, prefix=API_PREFIX)
app.include_router(notifications.router, prefix=API_PREFIX)
app.include_router(parties.router, prefix=API_PREFIX)
app.include_router(profile.router, prefix=API_PREFIX)
app.include_router(content.router, prefix=API_PREFIX)
app.include_router(social.router, prefix=API_PREFIX)
app.include_router(settings.router, prefix=API_PREFIX)
app.include_router(subscriptions.router, prefix=API_PREFIX)


@app.get(f"{API_PREFIX}/health" if API_PREFIX else "/health")
def health() -> dict[str, str]:
    storage = storage_label()
    if os.environ.get("VERCEL") == "1" and storage == "none":
        return {
            "status": "degraded",
            "storage": storage,
            "platform": "vercel",
            "error": "POSTGRES_URL required on Vercel",
        }
    return {"status": "ok", "storage": storage, "platform": "vercel" if os.environ.get("VERCEL") else "local"}


origins = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:3000,https://flixverse-streaming-pro.vercel.app,https://*.vercel.app",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()] or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# WebSocket routes only for local uvicorn (not supported on Vercel serverless)
if os.environ.get("VERCEL") != "1":
    from fastapi import WebSocket
    from auth import verify_bearer, uid_from_auth
    from ws.hub import notifications_ws, party_ws

    @app.websocket("/ws/notifications")
    async def ws_notifications(websocket: WebSocket, token: str) -> None:
        from firebase_admin import auth as firebase_auth
        from auth import _init_firebase

        _init_firebase()
        try:
            decoded = firebase_auth.verify_id_token(token)
            user_id = decoded["uid"]
        except Exception:
            await websocket.close(code=4401)
            return
        await notifications_ws(websocket, user_id)

    @app.websocket("/ws/party/{room_id}")
    async def ws_party(websocket: WebSocket, room_id: str, token: str) -> None:
        from firebase_admin import auth as firebase_auth
        from auth import _init_firebase

        _init_firebase()
        try:
            decoded = firebase_auth.verify_id_token(token)
            user_id = decoded["uid"]
        except Exception:
            await websocket.close(code=4401)
            return
        await party_ws(websocket, room_id, user_id)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
