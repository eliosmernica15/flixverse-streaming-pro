"""GDPR Export Worker — generates export files and manages expiry links.

This worker can be run as a scheduled job to:
1. Generate GDPR exports asynchronously for large datasets
2. Clean up expired exports
3. Handle export notifications (email, etc.)

Usage:
    python scripts/python/gdprExportWorker.py --generate-export <user_id>
    python scripts/python/gdprExportWorker.py --cleanup-expired
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

# Add backend to path
BACKEND = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from database import (
    db_execute,
    db_fetchall,
    db_fetchone,
    get_conn,
    init_db,
    iso_now,
    new_id,
    row_get,
    USE_POSTGRES,
)


def _sql(sql: str) -> str:
    """Convert SQLite placeholders to PostgreSQL placeholders if needed."""
    return sql.replace("?", "%s") if USE_POSTGRES else sql


def _fetch_user_rows(conn: Any, uid: str) -> dict[str, list[dict[str, Any]]]:
    """Return a {table: [row, ...]} mapping of every row this user owns."""
    # Tables to walk for export. Each tuple is (table, column) where
    # `column` is the SQL column that holds the user id.
    USER_TABLES: list[tuple[str, str]] = [
        ("reviews", "user_id"),
        ("comments", "user_id"),
        ("likes", "user_id"),
        ("content_ratings", "user_id"),
        ("user_movie_lists", "user_id"),
        ("watch_history", "user_id"),
        ("notifications", "user_id"),
        ("activity_feed", "user_id"),
        ("user_settings", "user_id"),
        ("subscriptions", "user_id"),
        ("friend_requests", "from_user_id"),
        ("friend_requests", "to_user_id"),
        ("friendships", "user_a"),
        ("friendships", "user_b"),
        ("follows", "follower_id"),
        ("follows", "following_id"),
    ]

    out: dict[str, list[dict[str, Any]]] = {}
    cur = conn.cursor()

    for table, column in USER_TABLES:
        try:
            cur.execute(_sql(f"SELECT * FROM {table} WHERE {column} = ?"), (uid,))
        except Exception:
            continue
        cols = [d[0] for d in cur.description] if cur.description else []
        rows: list[dict[str, Any]] = []
        for row in cur.fetchall():
            rows.append({col: _serialize(val) for col, val in zip(cols, row)})
        out[table] = rows

    # Usernames (no single user_id column)
    try:
        cur.execute(_sql("SELECT * FROM usernames WHERE uid = ?"), (uid,))
        cols = [d[0] for d in cur.description] if cur.description else []
        out["usernames"] = [
            {c: _serialize(v) for c, v in zip(cols, row)} for row in cur.fetchall()
        ]
    except Exception:
        out["usernames"] = []

    # Member profiles (owner_id)
    try:
        cur.execute(_sql("SELECT * FROM member_profiles WHERE owner_id = ?"), (uid,))
        cols = [d[0] for d in cur.description] if cur.description else []
        out["member_profiles"] = [
            {c: _serialize(v) for c, v in zip(cols, row)} for row in cur.fetchall()
        ]
    except Exception:
        out["member_profiles"] = []

    # Firestore user document (if Firebase is configured)
    try:
        # Import Firebase modules
        sys.path.insert(0, str(BACKEND))
        from auth import _init_firebase
        from firebase_admin import firestore
        _init_firebase()
        db = firestore.client()
        user_doc = db.collection("users").document(uid).get()
        if user_doc.exists:
            out["firestore_user"] = [_serialize_firestore_doc(user_doc.to_dict() or {})]
        # Also fetch sub-collections if they exist
        sub_collections = ["watch_parties", "notifications", "activity_feed"]
        for coll_name in sub_collections:
            try:
                docs = db.collection("users").document(uid).collection(coll_name).stream()
                out[f"firestore_{coll_name}"] = [
                    _serialize_firestore_doc(doc.to_dict() or {}, doc.id) for doc in docs
                ]
            except Exception:
                out[f"firestore_{coll_name}"] = []
    except Exception:
        # Firebase not configured or not available - skip silently
        pass

    return out


def _serialize_firestore_doc(doc: dict[str, Any], doc_id: str | None = None) -> dict[str, Any]:
    """Serialize a Firestore document, converting timestamps and adding doc_id."""
    result = {"_doc_id": doc_id} if doc_id else {}
    for key, val in doc.items():
        if hasattr(val, "timestamp"):  # Firestore Timestamp
            result[key] = val.timestamp().isoformat()
        elif isinstance(val, datetime):
            result[key] = val.isoformat()
        elif isinstance(val, dict):
            result[key] = _serialize_firestore_doc(val)
        elif isinstance(val, list):
            result[key] = [
                _serialize_firestore_doc(v) if isinstance(v, dict) else v for v in val
            ]
        else:
            result[key] = val
    return result


def _serialize(val: Any) -> Any:
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, (bytes, bytearray)):
        return val.decode("utf-8", errors="replace")
    return val


def generate_export(user_id: str, ttl_days: int = 7) -> dict[str, Any]:
    """Generate a GDPR export for a user and store it with an expiry link.

    Returns:
        Dict with export_id, download_url, expires_at, total_records
    """
    init_db()

    with get_conn() as conn:
        rows = _fetch_user_rows(conn, user_id)
    total = sum(len(v) for v in rows.values())

    export_id = new_id()
    # Use a secure random token for the download link
    import secrets
    import hashlib
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=ttl_days)

    export_data = {
        "exportDate": datetime.now(timezone.utc).isoformat(),
        "userId": user_id,
        "totalRecords": total,
        "data": rows,
    }

    with get_conn() as conn:
        db_execute(
            conn,
            _sql("INSERT INTO gdpr_exports (id, user_id, token_hash, data_json, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)"),
            (
                export_id,
                user_id,
                token_hash,
                json.dumps(export_data, default=str),
                expires_at.isoformat(),
                datetime.now(timezone.utc).isoformat(),
            ),
        )

    base_url = os.environ.get("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3000")
    download_url = f"{base_url}/api/account/export/download/{export_id}/{token}"

    return {
        "exportId": export_id,
        "downloadUrl": download_url,
        "expiresAt": expires_at.isoformat(),
        "totalRecords": total,
    }


def cleanup_expired_exports() -> int:
    """Delete all expired GDPR exports from the database.

    Returns:
        Number of deleted exports
    """
    init_db()

    now = datetime.now(timezone.utc).isoformat()

    with get_conn() as conn:
        cur = db_execute(
            conn,
            _sql("DELETE FROM gdpr_exports WHERE expires_at < ?"),
            (now,),
        )
        deleted = getattr(cur, "rowcount", 0)

    return deleted


def list_exports(user_id: str | None = None) -> list[dict[str, Any]]:
    """List all GDPR exports, optionally filtered by user_id."""
    init_db()

    with get_conn() as conn:
        if user_id:
            rows = db_fetchall(
                conn,
                _sql("SELECT id, user_id, expires_at, created_at FROM gdpr_exports WHERE user_id = ? ORDER BY created_at DESC"),
                (user_id,),
            )
        else:
            rows = db_fetchall(
                conn,
                _sql("SELECT id, user_id, expires_at, created_at FROM gdpr_exports ORDER BY created_at DESC"),
            )

    result = []
    for row in rows:
        result.append({
            "id": row_get(row, "id"),
            "user_id": row_get(row, "user_id"),
            "expires_at": row_get(row, "expires_at"),
            "created_at": row_get(row, "created_at"),
        })

    return result


def delete_export(export_id: str) -> bool:
    """Delete a specific GDPR export by ID.

    Returns:
        True if deleted, False if not found
    """
    init_db()

    with get_conn() as conn:
        cur = db_execute(
            conn,
            _sql("DELETE FROM gdpr_exports WHERE id = ?"),
            (export_id,),
        )
        return getattr(cur, "rowcount", 0) > 0


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="GDPR Export Worker")
    parser.add_argument("--generate-export", metavar="USER_ID", help="Generate export for user")
    parser.add_argument("--ttl-days", type=int, default=7, help="Export TTL in days (default: 7)")
    parser.add_argument("--cleanup-expired", action="store_true", help="Clean up expired exports")
    parser.add_argument("--list-exports", metavar="USER_ID", nargs="?", const="", help="List exports for user (or all if no user provided)")
    parser.add_argument("--delete-export", metavar="EXPORT_ID", help="Delete a specific export")

    args = parser.parse_args()

    if args.generate_export:
        result = generate_export(args.generate_export, args.ttl_days)
        print(json.dumps(result, indent=2))
    elif args.cleanup_expired:
        deleted = cleanup_expired_exports()
        print(f"Deleted {deleted} expired exports")
    elif args.list_exports is not None:
        user_id = args.list_exports if args.list_exports else None
        exports = list_exports(user_id)
        print(json.dumps(exports, indent=2))
    elif args.delete_export:
        success = delete_export(args.delete_export)
        print(f"Export deleted: {success}")
    else:
        parser.print_help()