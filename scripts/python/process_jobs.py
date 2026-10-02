#!/usr/bin/env python3
"""
Process pending_jobs → notifications + activity_feed.
Run on a schedule (Task Scheduler / cron) — no Firebase Cloud Functions (Spark free).

  python process_jobs.py
  python process_jobs.py --once
  python process_jobs.py --interval 10
"""

from __future__ import annotations

import argparse
import time
from datetime import datetime, timezone

from firebase_client import get_db, PROJECT_ID

SOCIAL_TYPES = {
    "friend_request",
    "friend_accepted",
    "watch_party_invite",
    "watch_party_invite_declined",
    "follow",
}


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_notification(
    db,
    *,
    recipient_id: str,
    sender_id: str,
    notif_type: str,
    title: str,
    message: str,
    sender_name: str | None = None,
    data: dict | None = None,
) -> None:
    if not recipient_id or not sender_id or recipient_id == sender_id:
        return
    if notif_type not in SOCIAL_TYPES:
        return

    merged_data = dict(data or {})
    merged_data.setdefault("from_user_id", sender_id)
    if sender_name:
        merged_data.setdefault("from_user_name", sender_name)

    db.collection("notifications").add(
        {
            "user_id": recipient_id,
            "from_user_id": sender_id,
            "type": notif_type,
            "title": title,
            "message": message,
            "data": merged_data,
            "read": False,
            "created_at": iso_now(),
            "dispatched_by": "python_worker",
        }
    )


def process_follow_notify(db, job_id: str, data: dict) -> None:
    payload = data.get("payload") or {}
    to_user = payload.get("toUserId")
    from_user = payload.get("fromUserId") or data.get("requestedBy")
    if not to_user or not from_user:
        return

    write_notification(
        db,
        recipient_id=to_user,
        sender_id=from_user,
        notif_type="follow",
        title="New follower",
        message=payload.get("message") or "Someone started following you.",
        data={"from_user_id": from_user},
    )


def process_social_notify(db, job_id: str, data: dict) -> None:
    payload = data.get("payload") or {}
    recipient_id = payload.get("recipientId")
    sender_id = data.get("requestedBy")
    notif_type = payload.get("type")
    title = payload.get("title")
    message = payload.get("message")

    if not recipient_id or not sender_id or not notif_type or not title or not message:
        return

    write_notification(
        db,
        recipient_id=recipient_id,
        sender_id=sender_id,
        notif_type=notif_type,
        title=title,
        message=message,
        sender_name=payload.get("senderName"),
        data=payload.get("data") if isinstance(payload.get("data"), dict) else {},
    )


def process_activity_review(db, job_id: str, data: dict) -> None:
    payload = data.get("payload") or {}
    user_id = payload.get("userId")
    if not user_id:
        return

    db.collection("activity_feed").add(
        {
            "user_id": user_id,
            "type": "review",
            "content_id": payload.get("contentId"),
            "content_type": payload.get("contentType"),
            "rating": payload.get("rating"),
            "created_at": iso_now(),
        }
    )


HANDLERS = {
    "follow_notify": process_follow_notify,
    "social_notify": process_social_notify,
    "activity_review": process_activity_review,
}


def run_once(db) -> int:
    pending = (
        db.collection("pending_jobs")
        .where("status", "==", "pending")
        .limit(50)
        .stream()
    )
    processed = 0

    for doc in pending:
        data = doc.to_dict() or {}
        job_type = data.get("type")
        handler = HANDLERS.get(job_type)
        if not handler:
            doc.reference.update({"status": "skipped", "error": f"unknown type {job_type}"})
            continue
        try:
            handler(db, doc.id, data)
            doc.reference.update({"status": "done", "processedAt": int(time.time() * 1000)})
            processed += 1
        except Exception as exc:  # noqa: BLE001
            doc.reference.update({"status": "error", "error": str(exc)})

    return processed


def main() -> None:
    parser = argparse.ArgumentParser(description="FlixVerse pending job worker")
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    parser.add_argument("--interval", type=int, default=10, help="Poll interval seconds")
    args = parser.parse_args()

    db = get_db()
    print(f"Worker started (project={PROJECT_ID})")

    if args.once:
        count = run_once(db)
        print(f"Processed {count} job(s)")
        return

    while True:
        count = run_once(db)
        if count:
            print(f"Processed {count} job(s)")
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
