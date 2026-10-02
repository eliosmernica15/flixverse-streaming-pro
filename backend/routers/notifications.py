"""Notification routes — SQLite, no Firestore quota."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import uid_from_auth, verify_bearer
from database import get_conn, iso_now, new_id, row_to_notification, db_fetchall, db_fetchone, db_execute, row_get
from notify_hub import notification_hub

router = APIRouter(prefix="/notifications", tags=["notifications"])

ALLOWED_TYPES = {
    "friend_request",
    "friend_accepted",
    "watch_party_invite",
    "watch_party_invite_declined",
    "follow",
}


class DispatchBody(BaseModel):
    recipientId: str
    type: str
    title: str
    message: str
    senderName: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)


@router.get("")
def list_notifications(auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        rows = db_fetchall(
            conn,
            """
            SELECT * FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 50
            """,
            (uid,),
        )
    items = [row_to_notification(r) for r in rows]
    unread = sum(1 for n in items if not n["read"])
    return {"notifications": items, "unreadCount": unread}


@router.post("/dispatch")
async def dispatch_notification(body: DispatchBody, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    sender_id = uid_from_auth(auth)
    if body.recipientId == sender_id:
        raise HTTPException(status_code=400, detail="Cannot notify yourself")
    if body.type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Invalid type")

    data = dict(body.data)
    data.setdefault("from_user_id", sender_id)
    if body.senderName:
        data.setdefault("from_user_name", body.senderName)

    notif_id = new_id()
    created = iso_now()
    doc = {
        "id": notif_id,
        "user_id": body.recipientId,
        "from_user_id": sender_id,
        "type": body.type,
        "title": body.title.strip(),
        "message": body.message.strip(),
        "data": data,
        "read": False,
        "created_at": created,
    }

    with get_conn() as conn:
        db_execute(
            conn,
            """
            INSERT INTO notifications (id, user_id, from_user_id, type, title, message, data_json, read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
            """,
            (
                notif_id,
                body.recipientId,
                sender_id,
                body.type,
                doc["title"],
                doc["message"],
                json.dumps(data),
                created,
            ),
        )

    await notification_hub.push(body.recipientId, doc)
    return {"ok": True}


@router.patch("/{notif_id}/read")
def mark_read(notif_id: str, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        cur = db_execute(
            conn,
            "UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?",
            (notif_id, uid),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        db_execute(conn, "UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0", (uid,))
    return {"ok": True}


@router.delete("/{notif_id}")
def delete_notification(notif_id: str, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        cur = db_execute(
            conn,
            "DELETE FROM notifications WHERE id = ? AND user_id = ?",
            (notif_id, uid),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@router.delete("")
def clear_all(auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        db_execute(conn, "DELETE FROM notifications WHERE user_id = ?", (uid,))
    return {"ok": True}


class InviteActionBody(BaseModel):
    notificationId: str


def _guest_player_url(data: dict[str, Any]) -> str | None:
    """Direct player URL so guests skip /party/join (hash key not needed when content_id is present)."""
    room_id = data.get("room_id")
    content_id = data.get("content_id")
    if not room_id or not content_id:
        return data.get("party_join_url")

    media_type = data.get("content_type") or "movie"
    parts = [f"type={media_type}", f"party={room_id}", "autoplay=true", "guest=1"]
    if media_type == "tv":
        if data.get("season") is not None:
            parts.append(f"season={data['season']}")
        if data.get("episode") is not None:
            parts.append(f"episode={data['episode']}")
    server = data.get("server_index")
    if server is not None and int(server) > 0:
        parts.append(f"server={server}")
    return f"/movie/{content_id}?{'&'.join(parts)}"


@router.post("/party-invite/accept")
def accept_party_invite(body: InviteActionBody, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        row = db_fetchone(
            conn,
            "SELECT * FROM notifications WHERE id = ? AND user_id = ?",
            (body.notificationId, uid),
        )
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        data = json.loads(row_get(row, "data_json") or "{}")
        data["invite_status"] = "accepted"
        db_execute(
            conn,
            "UPDATE notifications SET read = 1, data_json = ? WHERE id = ?",
            (json.dumps(data), body.notificationId),
        )
        invite_id = data.get("invite_id")
        if invite_id:
            db_execute(
                conn,
                "UPDATE watch_party_invites SET status = 'accepted', responded_at = ? WHERE id = ? AND to_user_id = ?",
                (iso_now(), invite_id, uid),
            )
    return {"ok": True, "joinUrl": _guest_player_url(data)}


@router.post("/party-invite/decline")
async def decline_party_invite(body: InviteActionBody, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    sender_name = auth.get("name") or auth.get("email", "Someone").split("@")[0]

    with get_conn() as conn:
        row = db_fetchone(
            conn,
            "SELECT * FROM notifications WHERE id = ? AND user_id = ?",
            (body.notificationId, uid),
        )
        if not row:
            raise HTTPException(status_code=404, detail="Not found")

        data = json.loads(row_get(row, "data_json") or "{}")
        data["invite_status"] = "declined"
        db_execute(
            conn,
            "UPDATE notifications SET read = 1, data_json = ? WHERE id = ?",
            (json.dumps(data), body.notificationId),
        )

        invite_id = data.get("invite_id")
        if invite_id:
            db_execute(
                conn,
                "UPDATE watch_party_invites SET status = 'declined', responded_at = ? WHERE id = ? AND to_user_id = ?",
                (iso_now(), invite_id, uid),
            )

        host_id = row_get(row, "from_user_id")
        movie_title = data.get("movie_title") or "your watch party"
        if host_id and host_id != uid:
            notif_id = new_id()
            created = iso_now()
            decline_data = {
                "room_id": data.get("room_id"),
                "movie_title": movie_title,
                "from_user_id": uid,
                "from_user_name": sender_name,
            }
            db_execute(
                conn,
                """
                INSERT INTO notifications (id, user_id, from_user_id, type, title, message, data_json, read, created_at)
                VALUES (?, ?, ?, 'watch_party_invite_declined', ?, ?, ?, 0, ?)
                """,
                (
                    notif_id,
                    host_id,
                    uid,
                    "Invite declined",
                    f'{sender_name} declined your invite to watch "{movie_title}"',
                    json.dumps(decline_data),
                    created,
                ),
            )
            decline_doc = {
                "id": notif_id,
                "user_id": host_id,
                "from_user_id": uid,
                "type": "watch_party_invite_declined",
                "title": "Invite declined",
                "message": f"{sender_name} declined your invite to watch \"{movie_title}\"",
                "data": decline_data,
                "read": False,
                "created_at": created,
            }
            await notification_hub.push(host_id, decline_doc)

    return {"ok": True}
