#!/usr/bin/env python3
"""
Sync new reports → moderation_queue. Spark-free alternative to Cloud Functions.

  python process_reports.py
"""

from __future__ import annotations

import time

from firebase_client import get_db


def run_once(db) -> int:
    reports = (
        db.collection("reports")
        .where("status", "==", "pending")
        .limit(25)
        .stream()
    )
    count = 0

    for doc in reports:
        data = doc.to_dict() or {}
        queue_id = doc.id

        existing = db.collection("moderation_queue").document(queue_id).get()
        if existing.exists:
            continue

        db.collection("moderation_queue").document(queue_id).set(
            {
                "reportId": queue_id,
                "status": "pending",
                "targetType": data.get("targetType"),
                "targetId": data.get("targetId"),
                "reporterId": data.get("reporterId"),
                "reason": data.get("reason"),
                "createdAt": data.get("createdAt") or int(time.time() * 1000),
            }
        )
        count += 1

    return count


def main() -> None:
    db = get_db()
    count = run_once(db)
    print(f"Queued {count} report(s) for moderation")


if __name__ == "__main__":
    main()
