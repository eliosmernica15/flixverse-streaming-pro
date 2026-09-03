#!/usr/bin/env python3
"""
ETL: Firestore → Postgres (or SQLite for local validation).

One-shot migration. Reads from every collection the FlixVerse app uses
and bulk-loads it into the Postgres schema defined in backend/database.py.

Run with either:
  POSTGRES_URL=postgres://... python etl_firestore_to_postgres.py
  python etl_firestore_to_postgres.py --local       # writes to backend/data/flixverse.db
  python etl_firestore_to_postgres.py --dry-run     # reads Firestore, doesn't write

Required env:
  FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
  POSTGRES_URL (when not --local)

Safe to re-run: every collection insert uses ON CONFLICT DO UPDATE / DO NOTHING
and the activity feed is append-only (no re-import by default).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from firebase_client import get_db  # type: ignore
from database import (  # type: ignore
    get_conn,
    iso_now,
    new_id,
    now_ms,
    storage_label,
)
import crud  # type: ignore


COLLECTIONS = [
    "profiles",
    "usernames",
    "watch_history",
    "user_movie_lists",
    "reviews",
    "comments",
    "likes",
    "follows",
    "activity_feed",
    "content_ratings",
    "friendships",
    "friend_requests",
    "user_settings",
    "member_profiles",
    "subscriptions",
]


def _iter_collection(db: Any, name: str) -> Iterable[tuple[str, dict[str, Any]]]:
    coll = db.collection(name)
    for snap in coll.stream():
        yield snap.id, snap.to_dict() or {}


def _to_int(v: Any) -> int:
    if v is None:
        return 0
    if isinstance(v, (int, float)):
        return int(v)
    if isinstance(v, str):
        try:
            return int(float(v))
        except ValueError:
            return 0
    return 0


def _to_ms(v: Any) -> int:
    if v is None:
        return now_ms()
    if isinstance(v, (int, float)):
        return int(v)
    return now_ms()


def _to_iso(v: Any) -> str:
    if v is None:
        return iso_now()
    if hasattr(v, "isoformat"):
        return v.isoformat()
    if isinstance(v, (int, float)):
        from datetime import datetime, timezone
        return datetime.fromtimestamp(v / 1000, tz=timezone.utc).isoformat()
    return str(v)


def import_profiles(conn: Any, items: list[tuple[str, dict[str, Any]]]) -> int:
    n = 0
    for doc_id, data in items:
        crud.upsert_profile(
            conn,
            user_id=doc_id,
            display_name=data.get("display_name"),
            avatar_url=data.get("avatar_url"),
            bio=data.get("bio"),
            favorite_genres=data.get("favorite_genres") or [],
            username=data.get("username"),
        )
        n += 1
    return n


def import_usernames(conn: Any, items: list[tuple[str, dict[str, Any]]]) -> int:
    n = 0
    for handle, data in items:
        uid = data.get("uid") or handle
        crud.claim_username(
            conn, uid, handle, data.get("displayName") or handle
        )
        n += 1
    return n


def import_watch_history(conn: Any, items: list[tuple[str, dict[str, Any]]]) -> int:
    n = 0
    for doc_id, data in items:
        crud.upsert_watch_history(
            conn,
            history_id=doc_id,
            user_id=data.get("user_id") or doc_id.split("_")[0],
            content_id=_to_int(data.get("content_id")),
            content_type=data.get("content_type") or "movie",
            content_title=data.get("content_title") or "",
            poster_path=data.get("content_poster_path") or data.get("poster_path"),
            progress_seconds=float(data.get("progress_seconds") or 0),
            total_duration_seconds=float(data.get("total_duration_seconds") or 0),
            season=data.get("season"),
            episode=data.get("episode"),
            completed=bool(data.get("completed")),
        )
        n += 1
    return n


def import_user_movie_lists(conn: Any, items: list[tuple[str, dict[str, Any]]]) -> int:
    n = 0
    for doc_id, data in items:
        crud.add_movie_to_list(
            conn,
            user_id=data.get("user_id") or "",
            movie_id=_to_int(data.get("movie_id")),
            movie_title=data.get("movie_title") or "",
            poster_path=data.get("movie_poster_path") or data.get("poster_path"),
            media_type=data.get("media_type") or "movie",
        )
        n += 1
    return n


def import_reviews(conn: Any, items: list[tuple[str, dict[str, Any]]]) -> int:
    n = 0
    for doc_id, data in items:
        try:
            crud.create_review(
                conn,
                user_id=data.get("user_id") or "",
                user_display_name=data.get("user_display_name") or "",
                user_avatar_url=data.get("user_avatar_url"),
                content_id=_to_int(data.get("content_id")),
                content_type=data.get("content_type") or "movie",
                content_title=data.get("content_title") or "",
                content_poster_path=data.get("content_poster_path"),
                rating=_to_int(data.get("rating")),
                review_text=data.get("review_text") or "",
            )
            n += 1
        except Exception as exc:  # noqa: BLE001
            print(f"  ! review {doc_id} failed: {exc}")
    return n


def import_comments(conn: Any, items: list[tuple[str, dict[str, Any]]]) -> int:
    n = 0
    for doc_id, data in items:
        try:
            crud.create_comment(
                conn,
                user_id=data.get("user_id") or "",
                user_display_name=data.get("user_display_name") or "",
                user_avatar_url=data.get("user_avatar_url"),
                content_id=_to_int(data.get("content_id")),
                content_type=data.get("content_type") or "movie",
                text=data.get("text") or "",
                parent_id=data.get("parent_id"),
            )
            n += 1
        except Exception as exc:  # noqa: BLE001
            print(f"  ! comment {doc_id} failed: {exc}")
    return n


def import_follows(conn: Any, items: list[tuple[str, dict[str, Any]]]) -> int:
    n = 0
    for _doc_id, data in items:
        fid = data.get("follower_id")
        tid = data.get("following_id")
        if not fid or not tid:
            continue
        crud.follow(conn, fid, tid)
        n += 1
    return n


def import_content_ratings(conn: Any, items: list[tuple[str, dict[str, Any]]]) -> int:
    n = 0
    for _doc_id, data in items:
        crud.rate_content(
            conn,
            user_id=data.get("user_id") or "",
            content_id=_to_int(data.get("content_id")),
            content_type=data.get("content_type") or "movie",
            rating=_to_int(data.get("rating")),
        )
        n += 1
    return n


def import_friend_requests(conn: Any, items: list[tuple[str, dict[str, Any]]]) -> int:
    n = 0
    for doc_id, data in items:
        from_id = data.get("fromUserId") or data.get("from_user_id")
        to_id = data.get("toUserId") or data.get("to_user_id")
        if not from_id or not to_id:
            continue
        crud.send_friend_request(conn, from_id, to_id)
        n += 1
    return n


def import_friendships(conn: Any, items: list[tuple[str, dict[str, Any]]]) -> int:
    n = 0
    for _doc_id, data in items:
        users = data.get("users") or []
        if len(users) != 2:
            continue
        a, b = users
        # Create matching friend_request + accept it to land in friendships.
        req_id = f"{a}_{b}"
        crud.send_friend_request(conn, a, b)
        if not crud.accept_friend_request(conn, req_id, b):
            crud.accept_friend_request(conn, f"{b}_{a}", a)
        n += 1
    return n


def import_user_settings(conn: Any, items: list[tuple[str, dict[str, Any]]]) -> int:
    n = 0
    for doc_id, data in items:
        crud.set_user_settings(conn, doc_id, data)
        n += 1
    return n


HANDLERS = {
    "profiles": import_profiles,
    "usernames": import_usernames,
    "watch_history": import_watch_history,
    "user_movie_lists": import_user_movie_lists,
    "reviews": import_reviews,
    "comments": import_comments,
    "follows": import_follows,
    "content_ratings": import_content_ratings,
    "friend_requests": import_friend_requests,
    "friendships": import_friendships,
    "user_settings": import_user_settings,
}


def run(dry_run: bool, local: bool, collections: list[str] | None) -> dict[str, int]:
    print(f"Storage: {storage_label()}")
    if dry_run:
        print("DRY RUN — no writes")
    db = get_db()
    started = time.time()
    totals: dict[str, int] = {}
    targets = collections or COLLECTIONS

    for name in targets:
        items = list(_iter_collection(db, name))
        if not items:
            print(f"  {name}: 0 docs (skipped)")
            totals[name] = 0
            continue
        print(f"  {name}: {len(items)} docs …", end="", flush=True)
        if dry_run:
            totals[name] = len(items)
            print(" ok")
            continue
        handler = HANDLERS.get(name)
        if not handler:
            print(" no handler, skipped")
            totals[name] = 0
            continue
        with get_conn() as conn:
            try:
                n = handler(conn, items)
            except Exception as exc:  # noqa: BLE001
                conn.rollback() if hasattr(conn, "rollback") else None
                print(f" FAILED: {exc}")
                totals[name] = 0
                continue
        totals[name] = n
        print(f" imported {n}")

    print(f"\nDone in {time.time() - started:.1f}s")
    print("Summary:", json.dumps(totals, indent=2))
    return totals


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true", help="Read Firestore, don't write")
    p.add_argument("--local", action="store_true", help="Use local SQLite instead of Postgres")
    p.add_argument("--collections", nargs="*", help="Restrict to specific collections")
    args = p.parse_args()

    if args.local:
        os.environ.pop("POSTGRES_URL", None)
        os.environ.pop("DATABASE_URL", None)
    elif "POSTGRES_URL" not in os.environ and "DATABASE_URL" not in os.environ:
        print("POSTGRES_URL not set; pass --local to use SQLite instead", file=sys.stderr)
        return 2

    run(args.dry_run, args.local, args.collections)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
