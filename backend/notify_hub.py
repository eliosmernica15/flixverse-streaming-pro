"""DB helpers + notification hub (no-op push on Vercel — clients poll)."""

from __future__ import annotations

import os
from typing import Any


class NotificationHub:
    async def push(self, user_id: str, payload: dict[str, Any]) -> None:
        # WebSockets unavailable on Vercel serverless; clients poll /notifications
        if os.environ.get("VERCEL") == "1":
            return
        from ws.hub import notification_hub as _hub

        await _hub.push(user_id, payload)


notification_hub = NotificationHub()
