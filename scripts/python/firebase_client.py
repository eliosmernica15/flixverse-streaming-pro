"""Shared Firebase Admin initialization for FlixVerse Python workers."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

# Reuse the hardened service-account parser from the FastAPI backend so we
# can survive Vercel's env-var encoding (literal \\n, surrounding quotes,
# trailing whitespace).
BACKEND = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from auth import _load_service_account  # type: ignore  # noqa: E402

PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "streaming-web-2272d")


def get_db():
    if not firebase_admin._apps:
        sa = _load_service_account()
        if sa:
            cred = credentials.Certificate(sa)
        elif os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            cred = credentials.Certificate(
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"]
            )
        else:
            # Application Default Credentials (gcloud auth application-default login)
            cred = credentials.ApplicationDefault()

        firebase_admin.initialize_app(cred, {"projectId": sa.get("project_id") if sa else PROJECT_ID})

    return firestore.client()
