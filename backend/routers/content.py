"""Content-facing routes: watch history, user movie lists, content ratings.

Replaces Firestore /watch_history, /user_movie_lists, /content_ratings.
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import uid_from_auth, verify_bearer
from crud import (
    add_movie_to_list,
    get_user_rating,
    list_user_movies,
    list_watch_history,
    rate_content,
    remove_movie_from_list,
    upsert_watch_history,
)
from database import get_conn, new_id

router = APIRouter(prefix="/content", tags=["content"])


# ── Watch history ────────────────────────────────────────────────

class WatchHistoryUpsertBody(BaseModel):
    historyId: str | None = None
    contentId: int
    contentType: str
    contentTitle: str
    contentPosterPath: str | None = None
    progressSeconds: float = 0
    totalDurationSeconds: float = 0
    season: int | None = None
    episode: int | None = None
    completed: bool = False


@router.post("/watch-history")
def upsert_history(body: WatchHistoryUpsertBody, auth: dict = Depends(verify_bearer)) -> dict[str, str]:
    uid = uid_from_auth(auth)
    hid = body.historyId or new_id()
    with get_conn() as conn:
        upsert_watch_history(
            conn,
            history_id=hid,
            user_id=uid,
            content_id=body.contentId,
            content_type=body.contentType,
            content_title=body.contentTitle,
            poster_path=body.contentPosterPath,
            progress_seconds=body.progressSeconds,
            total_duration_seconds=body.totalDurationSeconds,
            season=body.season,
            episode=body.episode,
            completed=body.completed,
        )
    return {"id": hid}


@router.get("/watch-history")
def list_history(limit: int = 100, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        items = list_watch_history(conn, uid, limit=min(max(limit, 1), 500))
    return {"items": items}


# ── User movie list ──────────────────────────────────────────────

class MovieListAddBody(BaseModel):
    movieId: int
    movieTitle: str
    moviePosterPath: str | None = None
    mediaType: str = "movie"


@router.post("/user-movie-list")
def add_to_list(body: MovieListAddBody, auth: dict = Depends(verify_bearer)) -> dict[str, str]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        item_id = add_movie_to_list(
            conn,
            user_id=uid,
            movie_id=body.movieId,
            movie_title=body.movieTitle,
            poster_path=body.moviePosterPath,
            media_type=body.mediaType,
        )
    return {"id": item_id}


@router.delete("/user-movie-list/{item_id}")
def remove_from_list(item_id: str, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        remove_movie_from_list(conn, uid, item_id)
    return {"ok": True}


@router.get("/user-movie-list")
def get_user_list(limit: int = 500, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        items = list_user_movies(conn, uid, limit=min(max(limit, 1), 2000))
    return {"items": items}


# ── Content ratings ──────────────────────────────────────────────

class RateBody(BaseModel):
    contentId: int
    contentType: str
    rating: int = Field(ge=1, le=10)


@router.post("/rating")
def rate(body: RateBody, auth: dict = Depends(verify_bearer)) -> dict[str, str]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        rid = rate_content(conn, uid, body.contentId, body.contentType, body.rating)
    return {"id": rid}


@router.get("/rating")
def get_rating(contentId: int, contentType: str, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        rating = get_user_rating(conn, uid, contentId, contentType)
    return {"rating": rating}
