"""FlixVerse Python API — SQLite + WebSockets, no Firestore quota limits."""

from __future__ import annotations

import os

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from auth import verify_bearer, uid_from_auth
from database import init_db
from routers import notifications, parties
from ws.hub import notifications_ws, party_ws

init_db()

app = FastAPI(title="FlixVerse API", version="1.0.0")

origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000,https://flixverse-streaming-pro.vercel.app").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(notifications.router)
app.include_router(parties.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "storage": "sqlite"}


@app.websocket("/ws/notifications")
async def ws_notifications(websocket: WebSocket, token: str) -> None:
    from auth import _init_firebase
    from firebase_admin import auth as firebase_auth

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
    from auth import _init_firebase
    from firebase_admin import auth as firebase_auth

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
