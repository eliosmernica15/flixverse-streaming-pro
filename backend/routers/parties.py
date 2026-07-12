"""Party room + invite routes."""

from __future__ import annotations

import json
import random
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from auth import uid_from_auth, verify_bearer
from database import (
    USE_POSTGRES,
    get_conn,
    iso_now,
    new_id,
    db_fetchall,
    db_fetchone,
    db_execute,
    row_get,
)
from notify_hub import notification_hub

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


class SignalBody(BaseModel):
    targetId: str
    type: str
    payload: str


class JoinByCodeBody(BaseModel):
    code: str
    displayName: str = "Guest"
    avatarUrl: str | None = None


def _join_room_user(
    conn,
    room_id: str,
    uid: str,
    display_name: str,
    avatar_url: str | None,
) -> dict[str, Any]:
    ts = int(time.time() * 1000)
    room = _room_doc(conn, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    existing = db_fetchone(
        conn,
        "SELECT 1 FROM party_participants WHERE room_id = ? AND user_id = ?",
        (room_id, uid),
    )

    if existing:
        db_execute(
            conn,
            "UPDATE party_participants SET last_seen_at = ?, display_name = ? WHERE room_id = ? AND user_id = ?",
            (ts, display_name, room_id, uid),
        )
    else:
        count_row = db_fetchone(
            conn,
            "SELECT COUNT(*) AS c FROM party_participants WHERE room_id = ?",
            (room_id,),
        )
        count = row_get(count_row, "c") if count_row else 0
        if count >= 20:
            raise HTTPException(status_code=400, detail="Room is full")
        db_execute(
            conn,
            """
            INSERT INTO party_participants (room_id, user_id, display_name, avatar_url, role, last_seen_at)
            VALUES (?, ?, ?, ?, 'guest', ?)
            """,
            (room_id, uid, display_name, avatar_url, ts),
        )
        db_execute(conn, "UPDATE party_rooms SET updated_at = ? WHERE id = ?", (iso_now(), room_id))

    return _room_doc(conn, room_id) or room


def _room_participants(conn, room_id: str) -> list[dict[str, Any]]:
    rows = db_fetchall(
        conn,
        "SELECT * FROM party_participants WHERE room_id = ? ORDER BY last_seen_at",
        (room_id,),
    )
    return [
        {
            "userId": row_get(r, "user_id"),
            "displayName": row_get(r, "display_name"),
            "avatarUrl": row_get(r, "avatar_url"),
            "lastSeenAt": row_get(r, "last_seen_at"),
            "role": row_get(r, "role"),
            "micMutedByHost": bool(row_get(r, "mic_muted_by_host")),
            "camDisabledByHost": bool(row_get(r, "cam_disabled_by_host")),
        }
        for r in rows
    ]


def _room_doc(conn, room_id: str) -> dict[str, Any] | None:
    row = db_fetchone(conn, "SELECT * FROM party_rooms WHERE id = ?", (room_id,))
    if not row:
        return None
    return {
        "id": row_get(row, "id"),
        "code": row_get(row, "code"),
        "hostId": row_get(row, "host_id"),
        "encryptedPayload": row_get(row, "encrypted_payload"),
        "playbackState": row_get(row, "playback_state"),
        "lastKnownTime": row_get(row, "last_known_time"),
        "serverIndex": row_get(row, "server_index"),
        "updatedAt": int(time.time() * 1000),
        "createdAt": int(time.time() * 1000),
        "participants": _room_participants(conn, room_id),
    }


def _upsert_invite(
    conn,
    invite_id: str,
    room_id: str,
    from_user_id: str,
    from_user_name: str,
    to_user_id: str,
    to_user_name: str,
    party_join_url: str,
    room_title: str,
    data_json: str,
    created: str,
) -> None:
    params = (
        invite_id,
        room_id,
        from_user_id,
        from_user_name,
        to_user_id,
        to_user_name,
        party_join_url,
        room_title,
        data_json,
        created,
    )
    if USE_POSTGRES:
        db_execute(
            conn,
            """
            INSERT INTO watch_party_invites
            (id, room_id, from_user_id, from_user_name, to_user_id, to_user_name, party_join_url, movie_title, data_json, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            ON CONFLICT (id) DO UPDATE SET
              room_id = EXCLUDED.room_id,
              from_user_id = EXCLUDED.from_user_id,
              from_user_name = EXCLUDED.from_user_name,
              to_user_id = EXCLUDED.to_user_id,
              to_user_name = EXCLUDED.to_user_name,
              party_join_url = EXCLUDED.party_join_url,
              movie_title = EXCLUDED.movie_title,
              data_json = EXCLUDED.data_json,
              status = 'pending',
              created_at = EXCLUDED.created_at
            """,
            params,
        )
    else:
        db_execute(
            conn,
            """
            INSERT OR REPLACE INTO watch_party_invites
            (id, room_id, from_user_id, from_user_name, to_user_id, to_user_name, party_join_url, movie_title, data_json, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            """,
            params,
        )


@router.get("/parties/{room_id}/public-meta")
def public_party_meta(room_id: str) -> dict[str, Any]:
    """Encrypted payload only — safe without auth (key stays in URL hash)."""
    with get_conn() as conn:
        row = db_fetchone(
            conn,
            "SELECT encrypted_payload, code FROM party_rooms WHERE id = ?",
            (room_id,),
        )
    if not row:
        raise HTTPException(status_code=404, detail="Room not found")
    return {
        "encryptedPayload": row_get(row, "encrypted_payload"),
        "code": row_get(row, "code"),
    }


@router.post("/parties")
def create_party(body: CreatePartyBody, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    room_id = new_id()
    code = _gen_code()
    now = iso_now()
    ts = int(time.time() * 1000)

    with get_conn() as conn:
        db_execute(
            conn,
            """
            INSERT INTO party_rooms (id, code, host_id, encrypted_payload, playback_state, last_known_time, server_index, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'playing', 0, 0, ?, ?)
            """,
            (room_id, code, uid, body.encryptedPayload, now, now),
        )
        db_execute(
            conn,
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
    with get_conn() as conn:
        room = _join_room_user(conn, room_id, uid, body.displayName, body.avatarUrl)
    return {"ok": True, "room": room}


@router.post("/parties/join-by-code")
def join_party_by_code(body: JoinByCodeBody, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    code = body.code.strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Code required")

    with get_conn() as conn:
        row = db_fetchone(conn, "SELECT id FROM party_rooms WHERE code = ?", (code,))
        if not row:
            raise HTTPException(status_code=404, detail="Party not found")
        room_id = row_get(row, "id")
        room = _join_room_user(conn, room_id, uid, body.displayName, body.avatarUrl)

    return {"ok": True, "roomId": room_id, "room": room}


@router.post("/parties/{room_id}/leave")
def leave_party(room_id: str, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        row = db_fetchone(conn, "SELECT host_id FROM party_rooms WHERE id = ?", (room_id,))
        if not row:
            return {"ok": True}

        db_execute(
            conn,
            "DELETE FROM party_participants WHERE room_id = ? AND user_id = ?",
            (room_id, uid),
        )
        remaining = db_fetchall(
            conn,
            "SELECT user_id FROM party_participants WHERE room_id = ?",
            (room_id,),
        )

        if not remaining:
            db_execute(conn, "DELETE FROM party_rooms WHERE id = ?", (room_id,))
        elif row_get(row, "host_id") == uid:
            new_host = row_get(remaining[0], "user_id")
            db_execute(
                conn,
                "UPDATE party_rooms SET host_id = ?, updated_at = ? WHERE id = ?",
                (new_host, iso_now(), room_id),
            )
            db_execute(
                conn,
                "UPDATE party_participants SET role = 'guest' WHERE room_id = ?",
                (room_id,),
            )
            db_execute(
                conn,
                "UPDATE party_participants SET role = 'host' WHERE room_id = ? AND user_id = ?",
                (room_id, new_host),
            )

    return {"ok": True}


@router.patch("/parties/{room_id}/playback")
def update_playback(room_id: str, body: PlaybackBody, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        row = db_fetchone(conn, "SELECT host_id FROM party_rooms WHERE id = ?", (room_id,))
        if not row or row_get(row, "host_id") != uid:
            raise HTTPException(status_code=403, detail="Host only")
        db_execute(
            conn,
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
        rows = db_fetchall(
            conn,
            """
            SELECT * FROM party_messages WHERE room_id = ?
            ORDER BY created_at DESC LIMIT 40
            """,
            (room_id,),
        )
    msgs = [
        {
            "id": row_get(r, "id"),
            "senderId": row_get(r, "sender_id"),
            "senderName": row_get(r, "sender_name"),
            "senderAvatar": row_get(r, "sender_avatar"),
            "text": row_get(r, "text"),
            "emoji": row_get(r, "emoji"),
            "createdAt": row_get(r, "created_at"),
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
        member = db_fetchone(
            conn,
            "SELECT 1 FROM party_participants WHERE room_id = ? AND user_id = ?",
            (room_id, uid),
        )
        if not member:
            raise HTTPException(status_code=403, detail="Not in room")

        db_execute(
            conn,
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


@router.post("/parties/{room_id}/signals")
def post_signal(room_id: str, body: SignalBody, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    if body.type not in ("offer", "answer", "candidate"):
        raise HTTPException(status_code=400, detail="Invalid signal type")

    sig_id = new_id()
    ts = int(time.time() * 1000)

    with get_conn() as conn:
        member = db_fetchone(
            conn,
            "SELECT 1 FROM party_participants WHERE room_id = ? AND user_id = ?",
            (room_id, uid),
        )
        if not member:
            raise HTTPException(status_code=403, detail="Not in room")

        db_execute(
            conn,
            """
            INSERT INTO party_signals (id, room_id, sender_id, target_id, signal_type, payload, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (sig_id, room_id, uid, body.targetId, body.type, body.payload, ts),
        )

    return {"ok": True, "id": sig_id}


@router.get("/parties/{room_id}/signals")
def poll_signals(
    room_id: str,
    since: int = Query(0, ge=0),
    auth: dict = Depends(verify_bearer),
) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        member = db_fetchone(
            conn,
            "SELECT 1 FROM party_participants WHERE room_id = ? AND user_id = ?",
            (room_id, uid),
        )
        if not member:
            raise HTTPException(status_code=403, detail="Not in room")

        rows = db_fetchall(
            conn,
            """
            SELECT id, sender_id, target_id, signal_type, payload, created_at
            FROM party_signals
            WHERE room_id = ? AND target_id = ? AND created_at > ?
            ORDER BY created_at ASC
            LIMIT 100
            """,
            (room_id, uid, since),
        )

    return {
        "signals": [
            {
                "senderId": row_get(r, "sender_id"),
                "targetId": row_get(r, "target_id"),
                "type": row_get(r, "signal_type"),
                "payload": row_get(r, "payload"),
                "createdAt": row_get(r, "created_at"),
            }
            for r in rows
        ]
    }


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
        _upsert_invite(
            conn,
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
        )

        notif_id = new_id()
        db_execute(
            conn,
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
