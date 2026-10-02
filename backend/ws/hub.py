"""WebSocket hubs — real-time notifications + party signaling (no Firestore)."""

from __future__ import annotations

import json
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect


class NotificationHub:
    def __init__(self) -> None:
        self._user_sockets: dict[str, set[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._user_sockets.setdefault(user_id, set()).add(ws)

    def disconnect(self, user_id: str, ws: WebSocket) -> None:
        sockets = self._user_sockets.get(user_id)
        if sockets:
            sockets.discard(ws)
            if not sockets:
                del self._user_sockets[user_id]

    async def push(self, user_id: str, payload: dict[str, Any]) -> None:
        for ws in list(self._user_sockets.get(user_id, set())):
            try:
                await ws.send_json({"type": "notification", "notification": payload})
            except Exception:
                self.disconnect(user_id, ws)


class PartyHub:
    def __init__(self) -> None:
        self._rooms: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, room_id: str, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._rooms.setdefault(room_id, {})[user_id] = ws

    def disconnect(self, room_id: str, user_id: str) -> None:
        room = self._rooms.get(room_id)
        if room:
            room.pop(user_id, None)
            if not room:
                del self._rooms[room_id]

    async def relay(self, room_id: str, sender_id: str, message: dict[str, Any]) -> None:
        room = self._rooms.get(room_id, {})
        target_id = message.get("targetId")
        payload = json.dumps(message)

        if target_id:
            ws = room.get(target_id)
            if ws:
                try:
                    await ws.send_text(payload)
                except Exception:
                    self.disconnect(room_id, target_id)
            return

        for uid, ws in list(room.items()):
            if uid == sender_id:
                continue
            try:
                await ws.send_text(payload)
            except Exception:
                self.disconnect(room_id, uid)


notification_hub = NotificationHub()
party_hub = PartyHub()


async def notifications_ws(ws: WebSocket, user_id: str) -> None:
    await notification_hub.connect(user_id, ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        notification_hub.disconnect(user_id, ws)


async def party_ws(ws: WebSocket, room_id: str, user_id: str) -> None:
    await party_hub.connect(room_id, user_id, ws)
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if isinstance(msg, dict):
                msg.setdefault("senderId", user_id)
                await party_hub.relay(room_id, user_id, msg)
    except WebSocketDisconnect:
        party_hub.disconnect(room_id, user_id)
