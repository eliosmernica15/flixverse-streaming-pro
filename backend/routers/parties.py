"""Party room + invite routes."""

from __future__ import annotations

import json
import random
import string
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import uid_from_auth, verify_bearer
from database import get_conn, iso_now, new_id
from ws.hub import notification_hub

router = APIRouter(tags=["parties"])


def _gen_code() -> str:
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choice(chars) for _ in range(6))


class CreatePartyBody(BaseModel):
    encryptedPayload: str
    hostName: str = "Host"
    hostAvatar: str | None = None


class JoinPartyBody(BaseModel):
    displayName: str = "Guest"
    avatarUrl: str | None = None


class SendMessageBody(BaseModel):
    text: str
    emoji: str | None = None


class PlaybackBody(BaseModel):
    state: str
    currentTime: float = 0


class InviteBody(BaseModel):
    roomId: str
    toUserId: str
    toUserName: str
    partyJoinUrl: str
    roomTitle: str
    movieId: int | None = None
    mediaType: str = "movie"
    season: int | None = None
    episode: int | None = None
    posterPath: str | None = None


def _room_participants(conn, room_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM party_participants WHERE room_id = ? ORDER BY last_seen_at",
        (room_id,),
    ).fetchall()
    return [
        {
            "userId": r["user_id"],
            "displayName": r["display_name"],
            "avatarUrl": r["avatar_url"],
            "lastSeenAt": r["last_seen_at"],
            "role": r["role"],
            "micMutedByHost": bool(r["mic_muted_by_host"]),
            "camDisabledByHost": bool(r["cam_disabled_by_host"]),
        }
        for r in rows
    ]


def _room_doc(conn, room_id: str) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM party_rooms WHERE id = ?", (room_id,)).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "code": row["code"],
        "hostId": row["host_id"],
        "encryptedPayload": row["encrypted_payload"],
        "playbackState": row["playback_state"],
        "lastKnownTime": row["last_known_time"],
        "serverIndex": row["server_index"],
        "updatedAt": int(time.time() * 1000),
        "createdAt": int(time.time() * 1000),
        "participants": _room_participants(conn, room_id),
    }


@router.post("/parties")
def create_party(body: CreatePartyBody, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    room_id = new_id()
    code = _gen_code()
    now = iso_now()
    ts = int(time.time() * 1000)

    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO party_rooms (id, code, host_id, encrypted_payload, playback_state, last_known_time, server_index, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'playing', 0, 0, ?, ?)
            """,
            (room_id, code, uid, body.encryptedPayload, now, now),
        )
        conn.execute(
            """
            INSERT INTO party_participants (room_id, user_id, display_name, avatar_url, role, last_seen_at)
            VALUES (?, ?, ?, ?, 'host', ?)
            """,
            (room_id, uid, body.hostName, body.hostAvatar, ts),
        )
        room = _room_doc(conn, room_id)

    return {"roomId": room_id, "room": room}


@router.get("/parties/{room_id}")
def get_party(room_id: str, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid_from_auth(auth)
    with get_conn() as conn:
        room = _room_doc(conn, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"room": room}


@router.post("/parties/{room_id}/join")
def join_party(room_id: str, body: JoinPartyBody, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    ts = int(time.time() * 1000)

    with get_conn() as conn:
        room = _room_doc(conn, room_id)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")

        existing = conn.execute(
            "SELECT 1 FROM party_participants WHERE room_id = ? AND user_id = ?",
            (room_id, uid),
        ).fetchone()

        if existing:
            conn.execute(
                "UPDATE party_participants SET last_seen_at = ?, display_name = ? WHERE room_id = ? AND user_id = ?",
                (ts, body.displayName, room_id, uid),
            )
        else:
            count = conn.execute(
                "SELECT COUNT(*) AS c FROM party_participants WHERE room_id = ?",
                (room_id,),
            ).fetchone()["c"]
            if count >= 20:
                raise HTTPException(status_code=400, detail="Room is full")
            conn.execute(
                """
                INSERT INTO party_participants (room_id, user_id, display_name, avatar_url, role, last_seen_at)
                VALUES (?, ?, ?, ?, 'guest', ?)
                """,
                (room_id, uid, body.displayName, body.avatarUrl, ts),
            )
            conn.execute("UPDATE party_rooms SET updated_at = ? WHERE id = ?", (iso_now(), room_id))

        room = _room_doc(conn, room_id)

    return {"ok": True, "room": room}


@router.post("/parties/{room_id}/leave")
def leave_party(room_id: str, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        row = conn.execute("SELECT host_id FROM party_rooms WHERE id = ?", (room_id,)).fetchone()
        if not row:
            return {"ok": True}

        conn.execute(
            "DELETE FROM party_participants WHERE room_id = ? AND user_id = ?",
            (room_id, uid),
        )
        remaining = conn.execute(
            "SELECT user_id FROM party_participants WHERE room_id = ?",
            (room_id,),
        ).fetchall()

        if not remaining:
            conn.execute("DELETE FROM party_rooms WHERE id = ?", (room_id,))
        elif row["host_id"] == uid:
            new_host = remaining[0]["user_id"]
            conn.execute("UPDATE party_rooms SET host_id = ?, updated_at = ? WHERE id = ?", (new_host, iso_now(), room_id))
            conn.execute(
                "UPDATE party_participants SET role = 'guest' WHERE room_id = ?",
                (room_id,),
            )
            conn.execute(
                "UPDATE party_participants SET role = 'host' WHERE room_id = ? AND user_id = ?",
                (room_id, new_host),
            )

    return {"ok": True}


@router.patch("/parties/{room_id}/playback")
def update_playback(room_id: str, body: PlaybackBody, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        row = conn.execute("SELECT host_id FROM party_rooms WHERE id = ?", (room_id,)).fetchone()
        if not row or row["host_id"] != uid:
            raise HTTPException(status_code=403, detail="Host only")
        conn.execute(
            """
            UPDATE party_rooms
            SET playback_state = ?, last_known_time = ?, updated_at = ?
            WHERE id = ?
            """,
            (body.state, body.currentTime, iso_now(), room_id),
        )
    return {"ok": True}


@router.get("/parties/{room_id}/messages")
def list_messages(room_id: str, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid_from_auth(auth)
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT * FROM party_messages WHERE room_id = ?
            ORDER BY created_at DESC LIMIT 40
            """,
            (room_id,),
        ).fetchall()
    msgs = [
        {
            "id": r["id"],
            "senderId": r["sender_id"],
            "senderName": r["sender_name"],
            "senderAvatar": r["sender_avatar"],
            "text": r["text"],
            "emoji": r["emoji"],
            "createdAt": r["created_at"],
        }
        for r in reversed(rows)
    ]
    return {"messages": msgs}


@router.post("/parties/{room_id}/messages")
def send_message(room_id: str, body: SendMessageBody, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    text = (body.emoji or body.text or "").strip()
    if not text or len(text) > 500:
        raise HTTPException(status_code=400, detail="Invalid message")

    msg_id = new_id()
    ts = int(time.time() * 1000)
    sender_name = auth.get("name") or "Guest"

    with get_conn() as conn:
        member = conn.execute(
            "SELECT 1 FROM party_participants WHERE room_id = ? AND user_id = ?",
            (room_id, uid),
        ).fetchone()
        if not member:
            raise HTTPException(status_code=403, detail="Not in room")

        conn.execute(
            """
            INSERT INTO party_messages (id, room_id, sender_id, sender_name, sender_avatar, text, emoji, created_at)
            VALUES (?, ?, ?, ?, NULL, ?, ?, ?)
            """,
            (msg_id, room_id, uid, sender_name, body.text if not body.emoji else body.emoji, body.emoji, ts),
        )

    msg = {
        "id": msg_id,
        "senderId": uid,
        "senderName": sender_name,
        "senderAvatar": None,
        "text": body.text if not body.emoji else body.emoji,
        "emoji": body.emoji,
        "createdAt": ts,
    }
    return {"message": msg}


@router.post("/invites")
async def send_invite(body: InviteBody, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    if body.toUserId == uid:
        raise HTTPException(status_code=400, detail="Cannot invite yourself")

    sender_name = auth.get("name") or auth.get("email", "Someone").split("@")[0]
    invite_id = f"{body.roomId}_{body.toUserId}"
    created = iso_now()
    data = {
        "invite_id": invite_id,
        "invite_status": "pending",
        "party_join_url": body.partyJoinUrl,
        "room_id": body.roomId,
        "content_id": body.movieId,
        "content_type": body.mediaType,
        "movie_title": body.roomTitle,
        "from_user_id": uid,
        "from_user_name": sender_name,
    }

    with get_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO watch_party_invites
            (id, room_id, from_user_id, from_user_name, to_user_id, to_user_name, party_join_url, movie_title, data_json, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            """,
            (
                invite_id,
                body.roomId,
                uid,
                sender_name,
                body.toUserId,
                body.toUserName,
                body.partyJoinUrl,
                body.roomTitle,
                json.dumps(data),
                created,
            ),
        )

        notif_id = new_id()
        conn.execute(
            """
            INSERT INTO notifications (id, user_id, from_user_id, type, title, message, data_json, read, created_at)
            VALUES (?, ?, ?, 'watch_party_invite', ?, ?, ?, 0, ?)
            """,
            (
                notif_id,
                body.toUserId,
                uid,
                "Watch party invite",
                f'{sender_name} invited you to watch "{body.roomTitle}" together',
                json.dumps(data),
                created,
            ),
        )

    doc = {
        "id": notif_id,
        "user_id": body.toUserId,
        "from_user_id": uid,
        "type": "watch_party_invite",
        "title": "Watch party invite",
        "message": f'{sender_name} invited you to watch "{body.roomTitle}" together',
        "data": data,
        "read": False,
        "created_at": created,
    }
    await notification_hub.push(body.toUserId, doc)
    return {"ok": True}
