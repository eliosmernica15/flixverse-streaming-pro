"""Notification routes — SQLite, no Firestore quota."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import uid_from_auth, verify_bearer
from database import get_conn, iso_now, new_id, row_to_notification
from ws.hub import notification_hub

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
        rows = conn.execute(
            """
            SELECT * FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 50
            """,
            (uid,),
        ).fetchall()
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
        conn.execute(
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
        cur = conn.execute(
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
        conn.execute("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0", (uid,))
    return {"ok": True}


@router.delete("/{notif_id}")
def delete_notification(notif_id: str, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM notifications WHERE id = ? AND user_id = ?", (notif_id, uid))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@router.delete("")
def clear_all(auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        conn.execute("DELETE FROM notifications WHERE user_id = ?", (uid,))
    return {"ok": True}


class InviteActionBody(BaseModel):
    notificationId: str


@router.post("/party-invite/accept")
def accept_party_invite(body: InviteActionBody, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM notifications WHERE id = ? AND user_id = ?",
            (body.notificationId, uid),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        data = json.loads(row["data_json"] or "{}")
        data["invite_status"] = "accepted"
        conn.execute(
            "UPDATE notifications SET read = 1, data_json = ? WHERE id = ?",
            (json.dumps(data), body.notificationId),
        )
        invite_id = data.get("invite_id")
        if invite_id:
            conn.execute(
                "UPDATE watch_party_invites SET status = 'accepted', responded_at = ? WHERE id = ? AND to_user_id = ?",
                (iso_now(), invite_id, uid),
            )
    return {"ok": True, "joinUrl": data.get("party_join_url")}


@router.post("/party-invite/decline")
async def decline_party_invite(body: InviteActionBody, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    sender_name = auth.get("name") or auth.get("email", "Someone").split("@")[0]

    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM notifications WHERE id = ? AND user_id = ?",
            (body.notificationId, uid),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Not found")

        data = json.loads(row["data_json"] or "{}")
        data["invite_status"] = "declined"
        conn.execute(
            "UPDATE notifications SET read = 1, data_json = ? WHERE id = ?",
            (json.dumps(data), body.notificationId),
        )

        invite_id = data.get("invite_id")
        if invite_id:
            conn.execute(
                "UPDATE watch_party_invites SET status = 'declined', responded_at = ? WHERE id = ? AND to_user_id = ?",
                (iso_now(), invite_id, uid),
            )

        host_id = row["from_user_id"]
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
            conn.execute(
                """
                INSERT INTO notifications (id, user_id, from_user_id, type, title, message, data_json, read, created_at)
                VALUES (?, ?, ?, 'watch_party_invite_declined', ?, ?, ?, 0, ?)
                """,
                (
                    notif_id,
                    host_id,
                    uid,
                    "Invite declined",
                    f"{sender_name} declined your invite to watch \"{movie_title}\"",
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
