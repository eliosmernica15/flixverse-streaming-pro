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
        sys.stderr.write(
            f"[firebase_client] sa loaded: {bool(sa)}"
            f" keys={list(sa.keys()) if isinstance(sa, dict) else 'n/a'}\n"
        )
        if sa:
            cred = credentials.Certificate(sa)
            sys.stderr.write(
                f"[firebase_client] cert type: {type(cred).__name__}\n"
            )
        elif os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            cred = credentials.Certificate(
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"]
            )
        else:
            # Application Default Credentials (gcloud auth application-default login)
            cred = credentials.ApplicationDefault()
            sys.stderr.write("[firebase_client] using ApplicationDefault()\n")

        pid = sa.get("project_id") if sa else PROJECT_ID
        sys.stderr.write(f"[firebase_client] initialize_app projectId={pid}\n")
        firebase_admin.initialize_app(cred, {"projectId": pid})

    return firestore.client()
