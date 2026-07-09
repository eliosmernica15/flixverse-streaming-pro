"""Shared Firebase Admin initialization for FlixVerse Python workers."""

from __future__ import annotations

import json
import os
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "streaming-web-2272d")


def get_db():
    if not firebase_admin._apps:
        sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
        sa_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

        if sa_json:
            cred = credentials.Certificate(json.loads(sa_json))
        elif sa_path and Path(sa_path).exists():
            cred = credentials.Certificate(sa_path)
        else:
            # Application Default Credentials (gcloud auth application-default login)
            cred = credentials.ApplicationDefault()

        firebase_admin.initialize_app(cred, {"projectId": PROJECT_ID})

    return firestore.client()
