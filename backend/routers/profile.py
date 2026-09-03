"""Profile / username routes — replaces Firestore /profiles + /usernames."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import uid_from_auth, verify_bearer
from crud import (
    claim_username,
    get_profile,
    lookup_username,
    upsert_profile,
)
from database import get_conn

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileUpdateBody(BaseModel):
    displayName: str | None = None
    avatarUrl: str | None = None
    bio: str | None = None
    favoriteGenres: list[Any] = Field(default_factory=list)


@router.get("/me")
def get_my_profile(auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        prof = get_profile(conn, uid)
    return {"profile": prof}


@router.get("/{user_id}")
def get_user_profile(user_id: str, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    with get_conn() as conn:
        prof = get_profile(conn, user_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Not found")
    return {"profile": prof}


@router.post("")
def update_profile(body: ProfileUpdateBody, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        upsert_profile(
            conn,
            user_id=uid,
            display_name=body.displayName,
            avatar_url=body.avatarUrl,
            bio=body.bio,
            favorite_genres=body.favoriteGenres,
        )
    return {"ok": True}


class UsernameBody(BaseModel):
    handle: str


@router.post("/username")
def reserve_username(body: UsernameBody, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    handle = body.handle.strip().lower()
    if not handle or not handle.replace("_", "").isalnum() or len(handle) > 30:
        raise HTTPException(status_code=400, detail="Invalid handle")
    with get_conn() as conn:
        prof = get_profile(conn, uid)
        display_name = (prof or {}).get("display_name") or body.handle
        if not claim_username(conn, uid, handle, display_name):
            raise HTTPException(status_code=409, detail="Handle taken")
        upsert_profile(
            conn,
            user_id=uid,
            display_name=display_name,
            avatar_url=(prof or {}).get("avatar_url"),
            bio=(prof or {}).get("bio"),
            favorite_genres=(prof or {}).get("favorite_genres") or [],
            username=handle,
        )
    return {"ok": True, "handle": handle}


@router.get("/username/{handle}")
def resolve_username(handle: str, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    with get_conn() as conn:
        rec = lookup_username(conn, handle)
    if not rec:
        raise HTTPException(status_code=404, detail="Not found")
    return {"uid": rec["uid"], "displayName": rec["displayName"]}
