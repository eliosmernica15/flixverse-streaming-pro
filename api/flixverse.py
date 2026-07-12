"""Vercel serverless entry — FastAPI via Mangum."""

from __future__ import annotations

import os
import sys

# Allow imports from backend/
ROOT = os.path.join(os.path.dirname(__file__), "..")
BACKEND = os.path.join(ROOT, "backend")
sys.path.insert(0, BACKEND)

from main import app  # noqa: E402
from mangum import Mangum  # noqa: E402

handler = Mangum(app, lifespan="off")
