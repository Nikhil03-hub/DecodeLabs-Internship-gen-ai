"""
storage.py — Image Storage & Metadata (PDF R6, R9)
====================================================
  R6: Streaming chunked save to disk (don't hold whole image in RAM)
  R7: Validate image via Pillow (decodable + correct dimensions)
  R9: Metadata log + recent history + zip export
"""
from __future__ import annotations

import io
import json
import logging
import os
import time
import uuid
import zipfile
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Paths ───────────────────────────────────────────────────────────────────

_GENERATED_DIR = os.path.join(os.path.dirname(__file__), "generated")
_HISTORY_FILE  = os.path.join(_GENERATED_DIR, "_history.json")


def _ensure_dir() -> None:
    os.makedirs(_GENERATED_DIR, exist_ok=True)


# ─── Save (streaming / chunked) ──────────────────────────────────────────────

def save_stream(data: bytes, chunk_size: int = 8192) -> str:
    """
    PDF R6 — Write image bytes to disk IN CHUNKS (not all at once in RAM).

    Parameters
    ----------
    data       : raw image bytes from the API
    chunk_size : write chunk size in bytes (default 8 KB)

    Returns
    -------
    str : absolute path to the saved file
    """
    _ensure_dir()
    filename = f"{int(time.time())}-{uuid.uuid4().hex[:8]}.png"
    path = os.path.join(_GENERATED_DIR, filename)

    # Chunked write — R6
    bio = io.BytesIO(data)
    with open(path, "wb") as f:
        while True:
            chunk = bio.read(chunk_size)
            if not chunk:
                break
            f.write(chunk)

    logger.debug("Saved %d bytes → %s (chunked)", len(data), filename)
    return path


# ─── Validate (R7) ───────────────────────────────────────────────────────────

def validate(path: str) -> dict:
    """
    PDF R7 — Quality check: verify image is decodable and has correct dimensions.

    Returns
    -------
    {"valid": bool, "width": int, "height": int, "format": str}
    """
    try:
        from PIL import Image
        with Image.open(path) as img:
            width, height = img.size
            fmt = img.format or "PNG"
            return {"valid": True, "width": width, "height": height, "format": fmt}
    except Exception as exc:
        logger.warning("Image validation failed for %s: %s", path, exc)
        return {"valid": False, "width": 0, "height": 0, "format": "unknown"}


# ─── Metadata log (R9) ───────────────────────────────────────────────────────

def log_metadata(record: dict) -> None:
    """Append a generation record to _history.json."""
    _ensure_dir()
    history = _load_history()
    history.append(record)
    # Keep at most 100 entries
    if len(history) > 100:
        history = history[-100:]
    try:
        with open(_HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2, ensure_ascii=False)
    except Exception as exc:
        logger.warning("Could not write history: %s", exc)


def _load_history() -> list[dict]:
    if not os.path.exists(_HISTORY_FILE):
        return []
    try:
        with open(_HISTORY_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def recent(limit: int = 20) -> list[dict]:
    """Return the most recent `limit` generation records."""
    return _load_history()[-limit:]


# ─── Zip export (R9) ─────────────────────────────────────────────────────────

def zip_selected(filenames: list[str]) -> Optional[str]:
    """
    Create a zip of the selected generated image files.

    Parameters
    ----------
    filenames : list of filename strings (not paths)

    Returns
    -------
    str | None : path to the zip file, or None on failure
    """
    _ensure_dir()
    zip_path = os.path.join(_GENERATED_DIR, f"export-{uuid.uuid4().hex[:8]}.zip")

    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for fname in filenames:
                fpath = os.path.join(_GENERATED_DIR, os.path.basename(fname))
                if os.path.exists(fpath):
                    zf.write(fpath, arcname=os.path.basename(fname))
        return zip_path
    except Exception as exc:
        logger.error("Zip export failed: %s", exc)
        return None
