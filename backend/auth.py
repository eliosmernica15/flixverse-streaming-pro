"""Firebase ID token verification for the FlixVerse Python API."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from fastapi import Header, HTTPException

PROJECT_ID = (
    os.environ.get("FIREBASE_PROJECT_ID")
    or os.environ.get("NEXT_PUBLIC_FIREBASE_PROJECT_ID")
    or "streaming-web-2272d"
)

_firebase_ready = False


def _normalize_private_key(key: str) -> str:
    return key.replace("\\n", "\n").strip()


def _parse_service_account_raw(raw: str) -> dict[str, Any] | None:
    text = raw.strip()
    if not text:
        return None

    if (text.startswith("'") and text.endswith("'")) or (text.startswith('"') and text.endswith('"')):
        text = text[1:-1]

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None

    if not isinstance(data, dict):
        return None

    pk = data.get("private_key")
    if isinstance(pk, str):
        data["private_key"] = _normalize_private_key(pk)

    return data


def _load_service_account() -> dict[str, Any] | None:
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if raw:
        parsed = _parse_service_account_raw(raw)
        if parsed:
            return parsed

    client_email = os.environ.get("FIREBASE_CLIENT_EMAIL")
    private_key = os.environ.get("FIREBASE_PRIVATE_KEY")
    if client_email and private_key:
        return {
            "type": "service_account",
            "project_id": PROJECT_ID,
            "client_email": client_email,
            "private_key": _normalize_private_key(private_key),
            "token_uri": "https://oauth2.googleapis.com/token",
        }

    sa_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if sa_path and Path(sa_path).exists():
        with open(sa_path, encoding="utf-8") as f:
            return _parse_service_account_raw(f.read())

    return None


def _init_firebase() -> None:
    global _firebase_ready
    if firebase_admin._apps:
        _firebase_ready = True
        return

    sa = _load_service_account()
    if sa:
        cred = credentials.Certificate(sa)
        project_id = sa.get("project_id") or PROJECT_ID
        firebase_admin.initialize_app(cred, {"projectId": project_id})
        _firebase_ready = True
        return

    firebase_admin.initialize_app(options={"projectId": PROJECT_ID})
    _firebase_ready = True


def _firebase_web_api_key() -> str | None:
    return os.environ.get("FIREBASE_WEB_API_KEY") or os.environ.get("NEXT_PUBLIC_FIREBASE_API_KEY")


def _verify_via_identity_toolkit(token: str) -> dict[str, Any]:
    api_key = _firebase_web_api_key()
    if not api_key:
        raise HTTPException(status_code=503, detail="Auth not configured")

    url = f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={api_key}"
    payload = json.dumps({"idToken": token}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    users = body.get("users") or []
    if not users:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = users[0]
    uid = user.get("localId")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token")

    return {
        "uid": uid,
        "email": user.get("email"),
        "name": user.get("displayName"),
    }


def verify_bearer(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")

    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization")

    try:
        _init_firebase()
        return firebase_auth.verify_id_token(token, check_revoked=False)
    except Exception:
        return _verify_via_identity_toolkit(token)


def uid_from_auth(auth: dict[str, Any]) -> str:
    uid = auth.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return str(uid)
