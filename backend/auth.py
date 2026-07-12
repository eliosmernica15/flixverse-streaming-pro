"""Firebase ID token verification for the FlixVerse Python API."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from fastapi import Header, HTTPException

PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "streaming-web-2272d")


def _init_firebase() -> None:
    if firebase_admin._apps:
        return

    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    sa_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

    if sa_json:
        cred = credentials.Certificate(json.loads(sa_json))
    elif sa_path and Path(sa_path).exists():
        cred = credentials.Certificate(sa_path)
    else:
        cred = credentials.ApplicationDefault()

    firebase_admin.initialize_app(cred, {"projectId": PROJECT_ID})


def verify_bearer(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")

    _init_firebase()
    token = authorization[7:]
    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid token") from exc


def uid_from_auth(auth: dict[str, Any]) -> str:
    uid = auth.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return str(uid)
