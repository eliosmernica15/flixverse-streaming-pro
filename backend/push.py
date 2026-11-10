"""Push notification sender for FlixVerse (FCM via firebase-admin).

No-op when Firebase credentials are not configured: the rest of the API
keeps working (in-app notifications still land; email workers still run).
"""

from __future__ import annotations

from typing import Any

from database import db_fetchall, get_conn, db_execute, row_get


def push_to_user(user_id: str, title: str, body: str, data: dict[str, Any] | None = None) -> None:
    """Best-effort push to all of the user's registered device tokens. Never raises."""
    try:
        from firebase_admin import messaging

        with get_conn() as conn:
            rows = db_fetchall(conn, "SELECT token FROM device_tokens WHERE user_id = ?", (user_id,))
        tokens = [str(row_get(r, "token")) for r in rows]
        if not tokens:
            return

        payload = {k: str(v) for k, v in (data or {}).items()}
        message = messaging.MulticastMessage(
            tokens=tokens,
            notification=messaging.Notification(title=title, body=body),
            data=payload,
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(icon="/icons/icon-192.png"),
            ),
        )
        resp = messaging.send_each_for_multicast(message)
        # Prune tokens that are definitively invalid (unregistered/malformed).
        if resp.failure_count:
            with get_conn() as conn:
                for idx, item in enumerate(resp.responses):
                    if item.success:
                        continue
                    exc = item.exception
                    code = exc.code if exc is not None else ""
                    if any(
                        bad in code
                        for bad in ("registration-token-not-registered", "invalid-argument", "invalid-registration-token")
                    ):
                        db_execute(conn, "DELETE FROM device_tokens WHERE token = ?", (tokens[idx],))
    except Exception as exc:  # noqa: BLE001 - push is best-effort
        print(f"[push] skipped: {exc}")
