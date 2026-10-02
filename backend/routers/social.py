"""Social routes: reviews, comments, follows, friends, likes.

Replaces Firestore /reviews, /comments, /follows, /friendships,
/friend_requests, /likes, /activity_feed.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from auth import uid_from_auth, verify_bearer
from crud import (
    accept_friend_request,
    create_comment,
    create_review,
    decline_friend_request,
    delete_review,
    follow,
    get_profile,
    is_following,
    list_activity,
    list_comments,
    list_friend_requests,
    list_friends,
    list_followers,
    list_following,
    list_global_activity,
    list_reviews,
    post_activity,
    send_friend_request,
    unfollow,
    update_review,
)
from database import get_conn

router = APIRouter(prefix="/social", tags=["social"])


# ── Reviews ──────────────────────────────────────────────────────

class ReviewBody(BaseModel):
    contentId: int
    contentType: str
    contentTitle: str
    contentPosterPath: str | None = None
    rating: int = Field(ge=1, le=10)
    reviewText: str = ""


@router.post("/reviews")
def add_review(body: ReviewBody, auth: dict = Depends(verify_bearer)) -> dict[str, str]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        prof = get_profile(conn, uid) or {}
        review_id = create_review(
            conn,
            user_id=uid,
            user_display_name=prof.get("display_name") or "",
            user_avatar_url=prof.get("avatar_url"),
            content_id=body.contentId,
            content_type=body.contentType,
            content_title=body.contentTitle,
            content_poster_path=body.contentPosterPath,
            rating=body.rating,
            review_text=body.reviewText,
        )
        post_activity(
            conn,
            user_id=uid,
            user_display_name=prof.get("display_name") or "",
            user_avatar_url=prof.get("avatar_url"),
            activity_type="review",
            content_id=body.contentId,
            content_type=body.contentType,
            content_title=body.contentTitle,
            content_poster_path=body.contentPosterPath,
            rating=body.rating,
            review_text=body.reviewText,
        )
    return {"id": review_id}


class ReviewEditBody(BaseModel):
    rating: int = Field(ge=1, le=10)
    reviewText: str = ""


@router.patch("/reviews/{review_id}")
def edit_review(review_id: str, body: ReviewEditBody, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        if not update_review(conn, review_id, uid, body.rating, body.reviewText):
            raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@router.delete("/reviews/{review_id}")
def remove_review(review_id: str, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        if not delete_review(conn, review_id, uid):
            raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@router.get("/reviews")
def reviews_for(
    contentId: int = Query(..., alias="contentId"),
    contentType: str = Query(..., alias="contentType"),
    limit: int = 50,
    offset: int = 0,
    auth: dict = Depends(verify_bearer),
) -> dict[str, Any]:
    with get_conn() as conn:
        items = list_reviews(conn, contentId, contentType, limit=min(max(limit, 1), 100), offset=max(offset, 0))
    return {"reviews": items}


# ── Comments ─────────────────────────────────────────────────────

class CommentBody(BaseModel):
    contentId: int
    contentType: str
    text: str
    parentId: str | None = None


@router.post("/comments")
def add_comment(body: CommentBody, auth: dict = Depends(verify_bearer)) -> dict[str, str]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        prof = get_profile(conn, uid) or {}
        cid = create_comment(
            conn,
            user_id=uid,
            user_display_name=prof.get("display_name") or "",
            user_avatar_url=prof.get("avatar_url"),
            content_id=body.contentId,
            content_type=body.contentType,
            text=body.text,
            parent_id=body.parentId,
        )
    return {"id": cid}


@router.get("/comments")
def comments_for(
    contentId: int = Query(..., alias="contentId"),
    contentType: str = Query(..., alias="contentType"),
    limit: int = 50,
    auth: dict = Depends(verify_bearer),
) -> dict[str, Any]:
    with get_conn() as conn:
        items = list_comments(conn, contentId, contentType, limit=min(max(limit, 1), 200))
    return {"comments": items}


# ── Follows ──────────────────────────────────────────────────────

class FollowBody(BaseModel):
    targetUserId: str


@router.post("/follow")
def do_follow(body: FollowBody, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        if not is_following(conn, uid, body.targetUserId):
            follow(conn, uid, body.targetUserId)
    return {"ok": True}


@router.delete("/follow/{target_id}")
def do_unfollow(target_id: str, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        unfollow(conn, uid, target_id)
    return {"ok": True}


@router.get("/followers/{user_id}")
def get_followers(user_id: str, auth: dict = Depends(verify_bearer)) -> dict[str, list[str]]:
    with get_conn() as conn:
        ids = list_followers(conn, user_id)
    return {"userIds": ids}


@router.get("/following/{user_id}")
def get_following(user_id: str, auth: dict = Depends(verify_bearer)) -> dict[str, list[str]]:
    with get_conn() as conn:
        ids = list_following(conn, user_id)
    return {"userIds": ids}


# ── Friend requests / friendships ────────────────────────────────

class FriendRequestBody(BaseModel):
    toUserId: str


@router.post("/friend-request")
def request_friend(body: FriendRequestBody, auth: dict = Depends(verify_bearer)) -> dict[str, str]:
    uid = uid_from_auth(auth)
    if body.toUserId == uid:
        raise HTTPException(status_code=400, detail="Cannot friend yourself")
    with get_conn() as conn:
        req_id = send_friend_request(conn, uid, body.toUserId)
    return {"id": req_id}


@router.post("/friend-request/{request_id}/accept")
def accept_req(request_id: str, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        if not accept_friend_request(conn, request_id, uid):
            raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@router.post("/friend-request/{request_id}/decline")
def decline_req(request_id: str, auth: dict = Depends(verify_bearer)) -> dict[str, bool]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        if not decline_friend_request(conn, request_id, uid):
            raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@router.get("/friend-requests")
def pending_requests(auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    uid = uid_from_auth(auth)
    with get_conn() as conn:
        items = list_friend_requests(conn, uid)
    return {"requests": items}


@router.get("/friends/{user_id}")
def get_friends(user_id: str, auth: dict = Depends(verify_bearer)) -> dict[str, list[str]]:
    with get_conn() as conn:
        ids = list_friends(conn, user_id)
    return {"userIds": ids}


# ── Activity feed ────────────────────────────────────────────────

@router.get("/activity")
def activity_for(user_id: str | None = None, limit: int = 50, auth: dict = Depends(verify_bearer)) -> dict[str, Any]:
    with get_conn() as conn:
        items = (
            list_activity(conn, user_id, limit=min(max(limit, 1), 200))
            if user_id
            else list_global_activity(conn, limit=min(max(limit, 1), 200))
        )
    return {"items": items}
