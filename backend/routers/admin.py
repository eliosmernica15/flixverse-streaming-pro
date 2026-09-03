"""One-time admin routes used during the Firestore → Postgres migration.

All routes here are guarded by `CRON_SECRET` (already configured on Vercel
as a Production env var). They will be removed once the ETL has run and
verified.
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Header, HTTPException

# Make backend/ importable so we can run the ETL script as a module
BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))
ETL_PATH = Path(__file__).resolve().parents[2] / "scripts" / "python" / "etl_firestore_to_postgres.py"

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_secret(authorization: str | None) -> None:
    expected = os.environ.get("CRON_SECRET")
    if not expected:
        raise HTTPException(status_code=503, detail="CRON_SECRET not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer")
    if authorization[7:].strip() != expected:
        raise HTTPException(status_code=403, detail="Bad secret")


@router.post("/etl")
def run_etl(
    dry_run: bool = False,
    collections: str | None = None,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_secret(authorization)

    import subprocess  # local import keeps the module lightweight

    if not ETL_PATH.exists():
        raise HTTPException(status_code=500, detail=f"ETL script missing: {ETL_PATH}")

    cmd = [sys.executable, str(ETL_PATH)]
    if dry_run:
        cmd.append("--dry-run")
    if collections:
        cmd.extend(["--collections", *collections.split(",")])

    started = time.time()
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=540,  # Vercel function max is 300s for hobby, 900s for pro
        env={**os.environ},
    )
    elapsed = time.time() - started

    return {
        "ok": proc.returncode == 0,
        "returncode": proc.returncode,
        "elapsed_seconds": round(elapsed, 1),
        "stdout": proc.stdout[-4000:],
        "stderr": proc.stderr[-2000:],
    }
