"""Storage: Vercel Postgres (production) or SQLite (local dev)."""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

USE_POSTGRES = bool(
    os.environ.get("POSTGRES_URL")
    or os.environ.get("DATABASE_URL")
    or os.environ.get("POSTGRES_URL_NON_POOLING")
)

DB_PATH = Path(os.environ.get("FLIXVERSE_DB_PATH", Path(__file__).parent / "data" / "flixverse.db"))

SCHEMA_SQL = """
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

CREATE TABLE IF NOT EXISTS party_rooms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  host_id TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  playback_state TEXT NOT NULL DEFAULT 'paused',
  last_known_time DOUBLE PRECISION NOT NULL DEFAULT 0,
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
  last_seen_at BIGINT NOT NULL,
  mic_muted_by_host INTEGER NOT NULL DEFAULT 0,
  cam_disabled_by_host INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS party_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT,
  text TEXT NOT NULL,
  emoji TEXT,
  created_at BIGINT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS party_signals (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- ── User profiles (migrated from Firestore /profiles) ─────────
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  favorite_genres_json TEXT NOT NULL DEFAULT '[]',
  followers_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ── Usernames (migrated from Firestore /usernames) ───────────
CREATE TABLE IF NOT EXISTS usernames (
  handle TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  display_name TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- ── Watch history (migrated from Firestore /watch_history) ───
CREATE TABLE IF NOT EXISTS watch_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content_id BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  content_title TEXT NOT NULL,
  content_poster_path TEXT,
  season INTEGER,
  episode INTEGER,
  progress_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_duration_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  watched_at BIGINT NOT NULL
);

-- ── User movie lists (migrated from Firestore /user_movie_lists) ──
CREATE TABLE IF NOT EXISTS user_movie_lists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  movie_id BIGINT NOT NULL,
  movie_title TEXT NOT NULL,
  movie_poster_path TEXT,
  media_type TEXT NOT NULL DEFAULT 'movie',
  added_at BIGINT NOT NULL
);

-- ── Reviews (migrated from Firestore /reviews) ────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_display_name TEXT NOT NULL,
  user_avatar_url TEXT,
  content_id BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  content_title TEXT NOT NULL,
  content_poster_path TEXT,
  rating INTEGER NOT NULL,
  review_text TEXT NOT NULL,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ── Comments (migrated from Firestore /comments) ──────────────
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_display_name TEXT NOT NULL,
  user_avatar_url TEXT,
  content_id BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  parent_id TEXT,
  text TEXT NOT NULL,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ── Likes (migrated from Firestore /likes) ────────────────────
CREATE TABLE IF NOT EXISTS likes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  content_id BIGINT,
  created_at BIGINT NOT NULL
);

-- ── Follows (migrated from Firestore /follows) ────────────────
CREATE TABLE IF NOT EXISTS follows (
  id TEXT PRIMARY KEY,
  follower_id TEXT NOT NULL,
  following_id TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE(follower_id, following_id)
);

-- ── Activity feed (migrated from Firestore /activity_feed) ────
CREATE TABLE IF NOT EXISTS activity_feed (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_display_name TEXT NOT NULL,
  user_avatar_url TEXT,
  type TEXT NOT NULL,
  content_id BIGINT,
  content_type TEXT,
  content_title TEXT,
  content_poster_path TEXT,
  target_user_id TEXT,
  target_user_name TEXT,
  rating INTEGER,
  review_text TEXT,
  created_at BIGINT NOT NULL
);

-- ── Content ratings (migrated from Firestore /content_ratings) ──
CREATE TABLE IF NOT EXISTS content_ratings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content_id BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  rating INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, content_id, content_type)
);

-- ── Friendships (migrated from Firestore /friendships) ────────
CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  user_a TEXT NOT NULL,
  user_b TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'accepted',
  created_at BIGINT NOT NULL,
  UNIQUE(user_a, user_b)
);

-- ── Friend requests (migrated from Firestore /friend_requests) ──
CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at BIGINT NOT NULL,
  UNIQUE(from_user_id, to_user_id)
);

-- ── User settings (migrated from Firestore /user_settings) ────
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  settings_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

-- ── Member profiles (migrated from Firestore /member_profiles) ──
CREATE TABLE IF NOT EXISTS member_profiles (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  type TEXT NOT NULL DEFAULT 'standard',
  is_primary INTEGER NOT NULL DEFAULT 0,
  pin_hash TEXT,
  max_certification TEXT,
  blocked_genres_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ── Stripe subscriptions (migrated from Firestore /subscriptions) ──
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL,
  plan TEXT,
  current_period_end BIGINT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

-- ── Stripe webhook idempotency (migrated from Firestore /stripe_webhook_events) ──
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at BIGINT NOT NULL
);
"""

INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_party_messages_room ON party_messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invites_to ON watch_party_invites(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_party_signals_room ON party_signals(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usernames_uid ON usernames(uid);
CREATE INDEX IF NOT EXISTS idx_watch_history_user ON watch_history(user_id, watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_movie_lists_user ON user_movie_lists(user_id, added_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_content ON reviews(content_id, content_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_content ON comments(content_id, content_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_target ON likes(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON activity_feed(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_ratings_content ON content_ratings(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_ratings_user ON content_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_a ON friendships(user_a);
CREATE INDEX IF NOT EXISTS idx_friendships_b ON friendships(user_b);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON friend_requests(from_user_id, status);
CREATE INDEX IF NOT EXISTS idx_member_profiles_owner ON member_profiles(owner_id);
"""


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def _postgres_url() -> str:
    return (
        os.environ.get("POSTGRES_URL")
        or os.environ.get("DATABASE_URL")
        or os.environ.get("POSTGRES_URL_NON_POOLING")
        or ""
    )


@contextmanager
def get_conn() -> Iterator[Any]:
    if USE_POSTGRES:
        import psycopg
        from psycopg.rows import dict_row

        with psycopg.connect(_postgres_url(), row_factory=dict_row) as conn:
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
    elif os.environ.get("VERCEL") == "1":
        raise RuntimeError("POSTGRES_URL is required on Vercel (SQLite is not supported)")
    else:
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


def _exec_script(conn: Any, sql: str) -> None:
    if USE_POSTGRES:
        with conn.cursor() as cur:
            cur.execute(sql)
    else:
        conn.executescript(sql)


def _migrate_party_content_meta(conn: Any) -> None:
    """Add content_meta_json column for guest redirects without URL hash key."""
    try:
        if USE_POSTGRES:
            with conn.cursor() as cur:
                cur.execute(
                    "ALTER TABLE party_rooms ADD COLUMN IF NOT EXISTS content_meta_json TEXT"
                )
        else:
            rows = conn.execute("PRAGMA table_info(party_rooms)").fetchall()
            names = {row[1] for row in rows}
            if "content_meta_json" not in names:
                conn.execute("ALTER TABLE party_rooms ADD COLUMN content_meta_json TEXT")
    except Exception:
        pass


def init_db() -> None:
    if os.environ.get("VERCEL") == "1" and not USE_POSTGRES:
        return
    with get_conn() as conn:
        for stmt in SCHEMA_SQL.split(";"):
            s = stmt.strip()
            if s:
                _exec_script(conn, s + ";")
        for stmt in INDEX_SQL.split(";"):
            s = stmt.strip()
            if s:
                try:
                    _exec_script(conn, s + ";")
                except Exception:
                    pass
        _migrate_party_content_meta(conn)


def row_get(row: Any, key: str) -> Any:
    if isinstance(row, sqlite3.Row):
        return row[key]
    return row[key]


def row_to_notification(row: Any) -> dict[str, Any]:
    data = json.loads(row_get(row, "data_json") or "{}")
    read_val = row_get(row, "read")
    return {
        "id": row_get(row, "id"),
        "user_id": row_get(row, "user_id"),
        "from_user_id": row_get(row, "from_user_id"),
        "type": row_get(row, "type"),
        "title": row_get(row, "title"),
        "message": row_get(row, "message"),
        "data": data,
        "read": bool(read_val),
        "created_at": row_get(row, "created_at"),
    }


def storage_label() -> str:
    if USE_POSTGRES:
        return "vercel-postgres"
    if os.environ.get("VERCEL") == "1":
        return "none"
    return "sqlite-local"


def _sql(sql: str) -> str:
    return sql.replace("?", "%s") if USE_POSTGRES else sql


def db_execute(conn: Any, sql: str, params: tuple = ()) -> Any:
    if USE_POSTGRES:
        cur = conn.cursor()
        cur.execute(_sql(sql), params)
        return cur
    return conn.execute(sql, params)


def db_fetchall(conn: Any, sql: str, params: tuple = ()) -> list[Any]:
    if USE_POSTGRES:
        with conn.cursor() as cur:
            cur.execute(_sql(sql), params)
            return cur.fetchall()
    return conn.execute(sql, params).fetchall()


def db_fetchone(conn: Any, sql: str, params: tuple = ()) -> Any:
    if USE_POSTGRES:
        with conn.cursor() as cur:
            cur.execute(_sql(sql), params)
            return cur.fetchone()
    return conn.execute(sql, params).fetchone()

