"""SQLite storage — no Firestore quota for social/party features."""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

DB_PATH = Path(os.environ.get("FLIXVERSE_DB_PATH", Path(__file__).parent / "data" / "flixverse.db"))


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS notifications (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              from_user_id TEXT,
              type TEXT NOT NULL,
              title TEXT NOT NULL,
              message TEXT NOT NULL,
              data_json TEXT NOT NULL DEFAULT '{}',
              read INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS party_rooms (
              id TEXT PRIMARY KEY,
              code TEXT NOT NULL UNIQUE,
              host_id TEXT NOT NULL,
              encrypted_payload TEXT NOT NULL,
              playback_state TEXT NOT NULL DEFAULT 'paused',
              last_known_time REAL NOT NULL DEFAULT 0,
              server_index INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS party_participants (
              room_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              display_name TEXT NOT NULL,
              avatar_url TEXT,
              role TEXT NOT NULL DEFAULT 'guest',
              last_seen_at INTEGER NOT NULL,
              mic_muted_by_host INTEGER NOT NULL DEFAULT 0,
              cam_disabled_by_host INTEGER NOT NULL DEFAULT 0,
              PRIMARY KEY (room_id, user_id),
              FOREIGN KEY (room_id) REFERENCES party_rooms(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS party_messages (
              id TEXT PRIMARY KEY,
              room_id TEXT NOT NULL,
              sender_id TEXT NOT NULL,
              sender_name TEXT NOT NULL,
              sender_avatar TEXT,
              text TEXT NOT NULL,
              emoji TEXT,
              created_at INTEGER NOT NULL,
              FOREIGN KEY (room_id) REFERENCES party_rooms(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_party_messages_room ON party_messages(room_id, created_at);

            CREATE TABLE IF NOT EXISTS watch_party_invites (
              id TEXT PRIMARY KEY,
              room_id TEXT NOT NULL,
              from_user_id TEXT NOT NULL,
              from_user_name TEXT NOT NULL,
              to_user_id TEXT NOT NULL,
              to_user_name TEXT NOT NULL,
              party_join_url TEXT NOT NULL,
              movie_title TEXT,
              data_json TEXT NOT NULL DEFAULT '{}',
              status TEXT NOT NULL DEFAULT 'pending',
              created_at TEXT NOT NULL,
              responded_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_invites_to ON watch_party_invites(to_user_id, status);
            """
        )


def row_to_notification(row: sqlite3.Row) -> dict[str, Any]:
    data = json.loads(row["data_json"] or "{}")
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "from_user_id": row["from_user_id"],
        "type": row["type"],
        "title": row["title"],
        "message": row["message"],
        "data": data,
        "read": bool(row["read"]),
        "created_at": row["created_at"],
    }
