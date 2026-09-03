"""Generic CRUD helpers for the post-Firestore migration tables.

Each helper is small, idempotent, and takes a `conn` so it can participate in
the caller's transaction if needed. Time fields are stored as either ISO-8601
strings (matching the Firestore convention for `created_at`/`updated_at` on
review/comment docs) or as Unix-ms integers (matching Firestore's
`serverTimestamp()` numeric representation used by watch_history, follows,
activity_feed, etc.). The shapes mirror `src/integrations/firebase/types.ts`
so the Next.js client can keep using the same TypeScript types.
"""

from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from database import (
    db_execute,
    db_fetchall,
    db_fetchone,
    iso_now,
    new_id,
    row_get,
)


def now_ms() -> int:
    return int(time.time() * 1000)


def to_iso(ms_or_iso: Any) -> str:
    """Coerce a Firestore-style timestamp (Unix-ms int or ISO string) to ISO."""
    if ms_or_iso is None:
        return iso_now()
    if isinstance(ms_or_iso, (int, float)):
        return datetime.fromtimestamp(ms_or_iso / 1000, tz=timezone.utc).isoformat()
    return str(ms_or_iso)


# ── Profiles ─────────────────────────────────────────────────────

def upsert_profile(
    conn: Any,
    user_id: str,
    display_name: str | None,
    avatar_url: str | None,
    bio: str | None = None,
    favorite_genres: list[Any] | None = None,
    username: str | None = None,
) -> None:
    db_execute(
        conn,
        """
        INSERT INTO profiles (user_id, display_name, username, avatar_url, bio, favorite_genres_json, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT(user_id) DO UPDATE SET
          display_name = COALESCE(excluded.display_name, profiles.display_name),
          username = COALESCE(excluded.username, profiles.username),
          avatar_url = COALESCE(excluded.avatar_url, profiles.avatar_url),
          bio = COALESCE(excluded.bio, profiles.bio),
          favorite_genres_json = excluded.favorite_genres_json,
          updated_at = excluded.updated_at
        """,
        (
            user_id,
            display_name,
            username,
            avatar_url,
            bio,
            json.dumps(favorite_genres or []),
            iso_now(),
            iso_now(),
        ),
    )


def get_profile(conn: Any, user_id: str) -> dict[str, Any] | None:
    row = db_fetchone(conn, "SELECT * FROM profiles WHERE user_id = %s", (user_id,))
    if not row:
        return None
    return {
        "id": row_get(row, "user_id"),
        "display_name": row_get(row, "display_name"),
        "username": row_get(row, "username"),
        "avatar_url": row_get(row, "avatar_url"),
        "bio": row_get(row, "bio"),
        "favorite_genres": json.loads(row_get(row, "favorite_genres_json") or "[]"),
        "followers_count": row_get(row, "followers_count"),
        "following_count": row_get(row, "following_count"),
        "created_at": row_get(row, "created_at"),
        "updated_at": row_get(row, "updated_at"),
    }


# ── Usernames ────────────────────────────────────────────────────

def claim_username(conn: Any, uid: str, handle: str, display_name: str) -> bool:
    """Returns True on success, False if handle is already taken by another uid."""
    existing = db_fetchone(
        conn, "SELECT uid FROM usernames WHERE handle = %s", (handle,)
    )
    if existing and row_get(existing, "uid") != uid:
        return False
    db_execute(
        conn,
        """
        INSERT INTO usernames (handle, uid, display_name, updated_at)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT(handle) DO UPDATE SET
          uid = excluded.uid,
          display_name = excluded.display_name,
          updated_at = excluded.updated_at
        """,
        (handle, uid, display_name, now_ms()),
    )
    return True


def lookup_username(conn: Any, handle: str) -> dict[str, Any] | None:
    row = db_fetchone(
        conn, "SELECT * FROM usernames WHERE handle = %s", (handle,)
    )
    if not row:
        return None
    return {
        "uid": row_get(row, "uid"),
        "displayName": row_get(row, "display_name"),
        "updatedAt": row_get(row, "updated_at"),
    }


# ── Watch history ────────────────────────────────────────────────

def upsert_watch_history(
    conn: Any,
    history_id: str,
    user_id: str,
    content_id: int,
    content_type: str,
    content_title: str,
    poster_path: str | None,
    progress_seconds: float,
    total_duration_seconds: float,
    season: int | None,
    episode: int | None,
    completed: bool,
) -> None:
    db_execute(
        conn,
        """
        INSERT INTO watch_history
          (id, user_id, content_id, content_type, content_title, content_poster_path,
           season, episode, progress_seconds, total_duration_seconds, completed, watched_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT(id) DO UPDATE SET
          content_title = excluded.content_title,
          content_poster_path = excluded.content_poster_path,
          progress_seconds = excluded.progress_seconds,
          total_duration_seconds = excluded.total_duration_seconds,
          completed = excluded.completed,
          watched_at = excluded.watched_at
        """,
        (
            history_id,
            user_id,
            content_id,
            content_type,
            content_title,
            poster_path,
            season,
            episode,
            progress_seconds,
            total_duration_seconds,
            1 if completed else 0,
            now_ms(),
        ),
    )


def list_watch_history(conn: Any, user_id: str, limit: int = 100) -> list[dict[str, Any]]:
    rows = db_fetchall(
        conn,
        """
        SELECT * FROM watch_history WHERE user_id = %s
        ORDER BY watched_at DESC LIMIT %s
        """,
        (user_id, limit),
    )
    return [_row_to_watch_history(r) for r in rows]


def _row_to_watch_history(row: Any) -> dict[str, Any]:
    return {
        "id": row_get(row, "id"),
        "user_id": row_get(row, "user_id"),
        "content_id": row_get(row, "content_id"),
        "content_type": row_get(row, "content_type"),
        "content_title": row_get(row, "content_title"),
        "content_poster_path": row_get(row, "content_poster_path"),
        "season": row_get(row, "season"),
        "episode": row_get(row, "episode"),
        "progress_seconds": row_get(row, "progress_seconds"),
        "total_duration_seconds": row_get(row, "total_duration_seconds"),
        "completed": bool(row_get(row, "completed")),
        "watched_at": row_get(row, "watched_at"),
    }


# ── User movie lists ─────────────────────────────────────────────

def add_movie_to_list(
    conn: Any,
    user_id: str,
    movie_id: int,
    movie_title: str,
    poster_path: str | None,
    media_type: str,
) -> str:
    item_id = f"{user_id}_{movie_id}_{media_type}"
    db_execute(
        conn,
        """
        INSERT INTO user_movie_lists
          (id, user_id, movie_id, movie_title, movie_poster_path, media_type, added_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT(id) DO UPDATE SET
          movie_title = excluded.movie_title,
          movie_poster_path = excluded.movie_poster_path
        """,
        (item_id, user_id, movie_id, movie_title, poster_path, media_type, now_ms()),
    )
    return item_id


def remove_movie_from_list(conn: Any, user_id: str, item_id: str) -> None:
    db_execute(
        conn,
        "DELETE FROM user_movie_lists WHERE id = %s AND user_id = %s",
        (item_id, user_id),
    )


def list_user_movies(conn: Any, user_id: str, limit: int = 500) -> list[dict[str, Any]]:
    rows = db_fetchall(
        conn,
        """
        SELECT * FROM user_movie_lists WHERE user_id = %s
        ORDER BY added_at DESC LIMIT %s
        """,
        (user_id, limit),
    )
    return [
        {
            "id": row_get(r, "id"),
            "user_id": row_get(r, "user_id"),
            "movie_id": row_get(r, "movie_id"),
            "movie_title": row_get(r, "movie_title"),
            "movie_poster_path": row_get(r, "movie_poster_path"),
            "media_type": row_get(r, "media_type"),
            "added_at": row_get(r, "added_at"),
        }
        for r in rows
    ]


# ── Reviews ──────────────────────────────────────────────────────

def create_review(
    conn: Any,
    user_id: str,
    user_display_name: str,
    user_avatar_url: str | None,
    content_id: int,
    content_type: str,
    content_title: str,
    content_poster_path: str | None,
    rating: int,
    review_text: str,
) -> str:
    review_id = new_id()
    db_execute(
        conn,
        """
        INSERT INTO reviews
          (id, user_id, user_display_name, user_avatar_url, content_id, content_type,
           content_title, content_poster_path, rating, review_text, likes_count,
           created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0, %s, %s)
        """,
        (
            review_id,
            user_id,
            user_display_name,
            user_avatar_url,
            content_id,
            content_type,
            content_title,
            content_poster_path,
            rating,
            review_text,
            iso_now(),
            iso_now(),
        ),
    )
    return review_id


def update_review(
    conn: Any, review_id: str, user_id: str, rating: int, review_text: str
) -> bool:
    cur = db_execute(
        conn,
        """
        UPDATE reviews SET rating = %s, review_text = %s, updated_at = %s
        WHERE id = %s AND user_id = %s
        """,
        (rating, review_text, iso_now(), review_id, user_id),
    )
    return getattr(cur, "rowcount", 0) > 0


def delete_review(conn: Any, review_id: str, user_id: str) -> bool:
    cur = db_execute(
        conn,
        "DELETE FROM reviews WHERE id = %s AND user_id = %s",
        (review_id, user_id),
    )
    return getattr(cur, "rowcount", 0) > 0


def list_reviews(
    conn: Any,
    content_id: int,
    content_type: str,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    rows = db_fetchall(
        conn,
        """
        SELECT * FROM reviews
        WHERE content_id = %s AND content_type = %s
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
        """,
        (content_id, content_type, limit, offset),
    )
    return [
        {
            "id": row_get(r, "id"),
            "user_id": row_get(r, "user_id"),
            "user_display_name": row_get(r, "user_display_name"),
            "user_avatar_url": row_get(r, "user_avatar_url"),
            "content_id": row_get(r, "content_id"),
            "content_type": row_get(r, "content_type"),
            "content_title": row_get(r, "content_title"),
            "content_poster_path": row_get(r, "content_poster_path"),
            "rating": row_get(r, "rating"),
            "review_text": row_get(r, "review_text"),
            "likes_count": row_get(r, "likes_count"),
            "created_at": row_get(r, "created_at"),
            "updated_at": row_get(r, "updated_at"),
        }
        for r in rows
    ]


# ── Comments ─────────────────────────────────────────────────────

def create_comment(
    conn: Any,
    user_id: str,
    user_display_name: str,
    user_avatar_url: str | None,
    content_id: int,
    content_type: str,
    text: str,
    parent_id: str | None = None,
) -> str:
    comment_id = new_id()
    db_execute(
        conn,
        """
        INSERT INTO comments
          (id, user_id, user_display_name, user_avatar_url, content_id, content_type,
           parent_id, text, likes_count, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 0, %s, %s)
        """,
        (
            comment_id,
            user_id,
            user_display_name,
            user_avatar_url,
            content_id,
            content_type,
            parent_id,
            text,
            iso_now(),
            iso_now(),
        ),
    )
    return comment_id


def list_comments(
    conn: Any, content_id: int, content_type: str, limit: int = 50
) -> list[dict[str, Any]]:
    rows = db_fetchall(
        conn,
        """
        SELECT * FROM comments
        WHERE content_id = %s AND content_type = %s
        ORDER BY created_at DESC LIMIT %s
        """,
        (content_id, content_type, limit),
    )
    return [
        {
            "id": row_get(r, "id"),
            "user_id": row_get(r, "user_id"),
            "user_display_name": row_get(r, "user_display_name"),
            "user_avatar_url": row_get(r, "user_avatar_url"),
            "content_id": row_get(r, "content_id"),
            "content_type": row_get(r, "content_type"),
            "parent_id": row_get(r, "parent_id"),
            "text": row_get(r, "text"),
            "likes_count": row_get(r, "likes_count"),
            "created_at": row_get(r, "created_at"),
            "updated_at": row_get(r, "updated_at"),
        }
        for r in rows
    ]


# ── Follows ──────────────────────────────────────────────────────

def follow(conn: Any, follower_id: str, following_id: str) -> bool:
    if follower_id == following_id:
        return False
    follow_id = f"{follower_id}_{following_id}"
    db_execute(
        conn,
        """
        INSERT INTO follows (id, follower_id, following_id, created_at)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT(follower_id, following_id) DO NOTHING
        """,
        (follow_id, follower_id, following_id, now_ms()),
    )
    db_execute(
        conn,
        "UPDATE profiles SET following_count = following_count + 1 WHERE user_id = %s",
        (follower_id,),
    )
    db_execute(
        conn,
        "UPDATE profiles SET followers_count = followers_count + 1 WHERE user_id = %s",
        (following_id,),
    )
    return True


def unfollow(conn: Any, follower_id: str, following_id: str) -> bool:
    cur = db_execute(
        conn,
        "DELETE FROM follows WHERE follower_id = %s AND following_id = %s",
        (follower_id, following_id),
    )
    if getattr(cur, "rowcount", 0) == 0:
        return False
    db_execute(
        conn,
        "UPDATE profiles SET following_count = MAX(0, following_count - 1) WHERE user_id = %s",
        (follower_id,),
    )
    db_execute(
        conn,
        "UPDATE profiles SET followers_count = MAX(0, followers_count - 1) WHERE user_id = %s",
        (following_id,),
    )
    return True


def is_following(conn: Any, follower_id: str, following_id: str) -> bool:
    row = db_fetchone(
        conn,
        "SELECT 1 FROM follows WHERE follower_id = %s AND following_id = %s",
        (follower_id, following_id),
    )
    return row is not None


def list_followers(conn: Any, user_id: str) -> list[str]:
    rows = db_fetchall(
        conn, "SELECT follower_id FROM follows WHERE following_id = %s", (user_id,)
    )
    return [row_get(r, "follower_id") for r in rows]


def list_following(conn: Any, user_id: str) -> list[str]:
    rows = db_fetchall(
        conn, "SELECT following_id FROM follows WHERE follower_id = %s", (user_id,)
    )
    return [row_get(r, "following_id") for r in rows]


# ── Content ratings ──────────────────────────────────────────────

def rate_content(
    conn: Any,
    user_id: str,
    content_id: int,
    content_type: str,
    rating: int,
) -> str:
    rating_id = f"{user_id}_{content_id}_{content_type}"
    db_execute(
        conn,
        """
        INSERT INTO content_ratings
          (id, user_id, content_id, content_type, rating, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT(user_id, content_id, content_type) DO UPDATE SET
          rating = excluded.rating,
          updated_at = excluded.updated_at
        """,
        (rating_id, user_id, content_id, content_type, rating, iso_now(), iso_now()),
    )
    return rating_id


def get_user_rating(
    conn: Any, user_id: str, content_id: int, content_type: str
) -> int | None:
    row = db_fetchone(
        conn,
        """
        SELECT rating FROM content_ratings
        WHERE user_id = %s AND content_id = %s AND content_type = %s
        """,
        (user_id, content_id, content_type),
    )
    return row_get(row, "rating") if row else None


# ── Activity feed ────────────────────────────────────────────────

def post_activity(
    conn: Any,
    user_id: str,
    user_display_name: str,
    user_avatar_url: str | None,
    activity_type: str,
    content_id: int | None,
    content_type: str | None,
    content_title: str | None,
    content_poster_path: str | None,
    rating: int | None = None,
    review_text: str | None = None,
    target_user_id: str | None = None,
    target_user_name: str | None = None,
) -> str:
    activity_id = new_id()
    db_execute(
        conn,
        """
        INSERT INTO activity_feed
          (id, user_id, user_display_name, user_avatar_url, type, content_id,
           content_type, content_title, content_poster_path, target_user_id,
           target_user_name, rating, review_text, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            activity_id,
            user_id,
            user_display_name,
            user_avatar_url,
            activity_type,
            content_id,
            content_type,
            content_title,
            content_poster_path,
            target_user_id,
            target_user_name,
            rating,
            review_text,
            now_ms(),
        ),
    )
    return activity_id


def list_activity(
    conn: Any, user_id: str, limit: int = 50
) -> list[dict[str, Any]]:
    rows = db_fetchall(
        conn,
        """
        SELECT * FROM activity_feed
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (user_id, limit),
    )
    return [_row_to_activity(r) for r in rows]


def list_global_activity(conn: Any, limit: int = 50) -> list[dict[str, Any]]:
    rows = db_fetchall(
        conn,
        """
        SELECT * FROM activity_feed
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (limit,),
    )
    return [_row_to_activity(r) for r in rows]


def _row_to_activity(row: Any) -> dict[str, Any]:
    return {
        "id": row_get(row, "id"),
        "user_id": row_get(row, "user_id"),
        "user_display_name": row_get(row, "user_display_name"),
        "user_avatar_url": row_get(row, "user_avatar_url"),
        "type": row_get(row, "type"),
        "content_id": row_get(row, "content_id"),
        "content_type": row_get(row, "content_type"),
        "content_title": row_get(row, "content_title"),
        "content_poster_path": row_get(row, "content_poster_path"),
        "target_user_id": row_get(row, "target_user_id"),
        "target_user_name": row_get(row, "target_user_name"),
        "rating": row_get(row, "rating"),
        "review_text": row_get(row, "review_text"),
        "created_at": row_get(row, "created_at"),
    }


# ── User settings ────────────────────────────────────────────────

def get_user_settings(conn: Any, user_id: str) -> dict[str, Any]:
    row = db_fetchone(
        conn, "SELECT settings_json FROM user_settings WHERE user_id = %s", (user_id,)
    )
    if not row:
        return {}
    try:
        return json.loads(row_get(row, "settings_json") or "{}")
    except json.JSONDecodeError:
        return {}


def set_user_settings(conn: Any, user_id: str, settings: dict[str, Any]) -> None:
    db_execute(
        conn,
        """
        INSERT INTO user_settings (user_id, settings_json, updated_at)
        VALUES (%s, %s, %s)
        ON CONFLICT(user_id) DO UPDATE SET
          settings_json = excluded.settings_json,
          updated_at = excluded.updated_at
        """,
        (user_id, json.dumps(settings), iso_now()),
    )


# ── Friendships / friend requests ────────────────────────────────

def send_friend_request(conn: Any, from_uid: str, to_uid: str) -> str:
    req_id = f"{from_uid}_{to_uid}"
    db_execute(
        conn,
        """
        INSERT INTO friend_requests (id, from_user_id, to_user_id, status, created_at)
        VALUES (%s, %s, %s, 'pending', %s)
        ON CONFLICT(from_user_id, to_user_id) DO NOTHING
        """,
        (req_id, from_uid, to_uid, now_ms()),
    )
    return req_id


def accept_friend_request(conn: Any, request_id: str, accepting_uid: str) -> bool:
    row = db_fetchone(
        conn,
        "SELECT * FROM friend_requests WHERE id = %s AND to_user_id = %s",
        (request_id, accepting_uid),
    )
    if not row:
        return False
    from_uid = row_get(row, "from_user_id")
    user_a, user_b = sorted([from_uid, accepting_uid])
    db_execute(
        conn,
        """
        INSERT INTO friendships (id, user_a, user_b, status, created_at)
        VALUES (%s, %s, %s, 'accepted', %s)
        ON CONFLICT(user_a, user_b) DO NOTHING
        """,
        (f"{user_a}_{user_b}", user_a, user_b, now_ms()),
    )
    db_execute(conn, "DELETE FROM friend_requests WHERE id = %s", (request_id,))
    return True


def decline_friend_request(conn: Any, request_id: str, declining_uid: str) -> bool:
    cur = db_execute(
        conn,
        "DELETE FROM friend_requests WHERE id = %s AND to_user_id = %s",
        (request_id, declining_uid),
    )
    return getattr(cur, "rowcount", 0) > 0


def list_friends(conn: Any, user_id: str) -> list[str]:
    rows = db_fetchall(
        conn,
        """
        SELECT CASE WHEN user_a = %s THEN user_b ELSE user_a END AS friend_id
        FROM friendships
        WHERE user_a = %s OR user_b = %s
        """,
        (user_id, user_id, user_id),
    )
    return [row_get(r, "friend_id") for r in rows]


def list_friend_requests(conn: Any, user_id: str) -> list[dict[str, Any]]:
    rows = db_fetchall(
        conn,
        """
        SELECT * FROM friend_requests
        WHERE to_user_id = %s AND status = 'pending'
        ORDER BY created_at DESC
        """,
        (user_id,),
    )
    return [
        {
            "id": row_get(r, "id"),
            "from_user_id": row_get(r, "from_user_id"),
            "to_user_id": row_get(r, "to_user_id"),
            "status": row_get(r, "status"),
            "created_at": row_get(r, "created_at"),
        }
        for r in rows
    ]


# ── Subscriptions (Stripe) ──────────────────────────────────────

def upsert_subscription(
    conn: Any,
    user_id: str,
    status: str,
    plan: str | None = None,
    stripe_customer_id: str | None = None,
    stripe_subscription_id: str | None = None,
    current_period_end: int | None = None,
    cancel_at_period_end: bool = False,
    metadata: dict[str, Any] | None = None,
) -> None:
    db_execute(
        conn,
        """
        INSERT INTO subscriptions
          (user_id, stripe_customer_id, stripe_subscription_id, status, plan,
           current_period_end, cancel_at_period_end, metadata_json, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT(user_id) DO UPDATE SET
          stripe_customer_id = excluded.stripe_customer_id,
          stripe_subscription_id = excluded.stripe_subscription_id,
          status = excluded.status,
          plan = excluded.plan,
          current_period_end = excluded.current_period_end,
          cancel_at_period_end = excluded.cancel_at_period_end,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at
        """,
        (
            user_id,
            stripe_customer_id,
            stripe_subscription_id,
            status,
            plan,
            current_period_end,
            1 if cancel_at_period_end else 0,
            json.dumps(metadata or {}),
            iso_now(),
        ),
    )


def get_subscription(conn: Any, user_id: str) -> dict[str, Any] | None:
    row = db_fetchone(
        conn, "SELECT * FROM subscriptions WHERE user_id = %s", (user_id,)
    )
    if not row:
        return None
    return {
        "user_id": row_get(row, "user_id"),
        "stripe_customer_id": row_get(row, "stripe_customer_id"),
        "stripe_subscription_id": row_get(row, "stripe_subscription_id"),
        "status": row_get(row, "status"),
        "plan": row_get(row, "plan"),
        "current_period_end": row_get(row, "current_period_end"),
        "cancel_at_period_end": bool(row_get(row, "cancel_at_period_end")),
        "metadata": json.loads(row_get(row, "metadata_json") or "{}"),
        "updated_at": row_get(row, "updated_at"),
    }


def record_stripe_event(conn: Any, event_id: str, event_type: str) -> bool:
    """Returns True if new, False if duplicate (idempotency)."""
    try:
        db_execute(
            conn,
            "INSERT INTO stripe_webhook_events (event_id, type, received_at) VALUES (%s, %s, %s)",
            (event_id, event_type, now_ms()),
        )
        return True
    except Exception:
        return False
