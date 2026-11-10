"""User settings routes — replaces Firestore /user_settings."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import uid_from_auth, verify_bearer
from crud import get_user_settings, set_user_settings
from database import get_conn

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
def fetch_settings(auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        settings = get_user_settings(conn, uid)
    return {"settings": settings}


class SettingsBody(BaseModel):
    settings: dict[str, Any]


@router.put("")
def save_settings(body: SettingsBody, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        set_user_settings(conn, uid, body.settings)
    return {"ok": True}
