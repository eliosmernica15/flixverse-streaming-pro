#!/usr/bin/env python3
"""
Process pending_jobs → notifications + activity_feed.
Run on a schedule (Task Scheduler / cron) — no Firebase Cloud Functions (Spark free).

  python process_jobs.py
  python process_jobs.py --once
"""

from __future__ import annotations

import argparse
import time

from firebase_client import get_db, PROJECT_ID


def process_follow_notify(db, job_id: str, data: dict) -> None:
    payload = data.get("payload") or {}
    to_user = payload.get("toUserId")
    from_user = payload.get("fromUserId")
    if not to_user or not from_user:
        return

    db.collection("notifications").add(
        {
            "user_id": to_user,
            "type": "follow",
            "title": "New follower",
            "message": payload.get("message") or "Someone started following you.",
            "from_user_id": from_user,
            "read": False,
            "created_at": int(time.time() * 1000),
        }
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
            "created_at": int(time.time() * 1000),
        }
    )


HANDLERS = {
    "follow_notify": process_follow_notify,
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
    parser.add_argument("--interval", type=int, default=30, help="Poll interval seconds")
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
