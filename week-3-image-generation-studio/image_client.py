"""
image_client.py — Hugging Face Image Generation Client
========================================================
PDF requirements implemented here:
  R1: Integrate Hugging Face Inference API (SDXL)
  R3: Returns raw binary image bytes
  R4: timeout=(3.05, 60) — separate connect + read timeouts
  R5: Retry + exponential back-off: 1/2/4/8s on 429 and 503 "model loading"
"""
from __future__ import annotations

import logging
import os
import time

import requests

logger = logging.getLogger(__name__)

# ─── Config ───────────────────────────────────────────────────────────────────

_HF_TOKEN = os.environ.get("HUGGINGFACE_API_TOKEN", "")
_MODEL_ID  = os.environ.get("HF_MODEL_ID", "stabilityai/stable-diffusion-xl-base-1.0")
_HF_URL    = f"https://api-inference.huggingface.co/models/{_MODEL_ID}"

# PDF-specified timeouts (R4): connect=3.05s, read=60s
_TIMEOUT = (3.05, 60)

# Exponential back-off delays (R5): 1 → 2 → 4 → 8 seconds
_BACKOFF_DELAYS = [1, 2, 4, 8]


# ─── Exceptions ──────────────────────────────────────────────────────────────

class ImageGenError(Exception):
    """Typed error for image generation failures."""
    def __init__(self, message: str, code: str = "unknown") -> None:
        super().__init__(message)
        self.code = code


# ─── Config check ────────────────────────────────────────────────────────────

def check_config() -> None:
    if not _HF_TOKEN:
        raise ImageGenError(
            "HUGGINGFACE_API_TOKEN is not set. "
            "Get a free token at https://huggingface.co/settings/tokens and add it to .env",
            code="auth",
        )


# ─── Core generate function ──────────────────────────────────────────────────

def generate(payload: dict) -> tuple[bytes, str]:
    """
    POST to HF Inference API and return (image_bytes, status_message).

    PDF requirements satisfied:
      R4: timeout=(3.05, 60) on every request
      R5: 429 → exponential back-off 1/2/4/8s
           503 {"error": "…loading", "estimated_time": X} → wait estimated_time + retry

    Returns
    -------
    bytes   : raw PNG/JPEG image bytes
    str     : human-readable status for the UI ("ok" | "retried after rate-limit" | "model warmed up in Xs")

    Raises
    ------
    ImageGenError : on permanent failure
    """
    if not _HF_TOKEN:
        raise ImageGenError("HUGGINGFACE_API_TOKEN not set.", code="auth")

    headers = {
        "Authorization": f"Bearer {_HF_TOKEN}",
        "Accept": "image/png",
    }

    status_msg = "ok"

    for attempt, delay in enumerate(["initial"] + _BACKOFF_DELAYS):
        try:
            logger.debug("HF request attempt %d → %s", attempt, _HF_URL)

            response = requests.post(
                _HF_URL,
                json=payload,
                headers=headers,
                timeout=_TIMEOUT,   # R4 — connect + read timeout
            )

            # ── 503 model loading (R5) ───────────────────────────────────────
            if response.status_code == 503:
                try:
                    err_body = response.json()
                except Exception:
                    err_body = {}

                estimated_time = err_body.get("estimated_time", 20)
                wait_time = min(float(estimated_time), 60)  # cap at 60s

                logger.info("HF model loading, estimated wait %.0fs — retrying…", wait_time)
                status_msg = f"model warmed up in ~{int(wait_time)}s"
                time.sleep(wait_time)
                continue

            # ── 429 rate-limit (R5) ──────────────────────────────────────────
            if response.status_code == 429:
                if attempt < len(_BACKOFF_DELAYS):
                    wait = _BACKOFF_DELAYS[attempt if attempt < len(_BACKOFF_DELAYS) else -1]
                    logger.warning("HF rate-limited, back-off %.0fs (attempt %d)…", wait, attempt + 1)
                    status_msg = "retried after rate-limit"
                    time.sleep(wait)
                    continue
                raise ImageGenError(
                    "Too many requests to the image API. Please wait and try again.",
                    code="rate_limit",
                )

            # ── Auth error ───────────────────────────────────────────────────
            if response.status_code in (401, 403):
                raise ImageGenError(
                    "Invalid or missing HUGGINGFACE_API_TOKEN. "
                    "Check your token at https://huggingface.co/settings/tokens",
                    code="auth",
                )

            # ── Other 4xx / 5xx ──────────────────────────────────────────────
            if not response.ok:
                try:
                    detail = response.json().get("error", response.text[:200])
                except Exception:
                    detail = response.text[:200]
                raise ImageGenError(
                    f"Image API error ({response.status_code}): {detail}",
                    code="api_error",
                )

            # ── Success — verify we got image bytes (R3) ─────────────────────
            content_type = response.headers.get("content-type", "")
            if not content_type.startswith("image/"):
                # Might be a JSON error wrapped in a 200
                try:
                    detail = response.json().get("error", "Unknown error")
                except Exception:
                    detail = "Unexpected response format"
                raise ImageGenError(f"Expected image, got: {detail}", code="api_error")

            image_bytes = response.content
            if len(image_bytes) < 100:
                raise ImageGenError("Received empty image response.", code="api_error")

            logger.info("HF image received: %d bytes, status=%s", len(image_bytes), status_msg)
            return image_bytes, status_msg

        except (requests.ConnectionError, requests.Timeout) as exc:
            if attempt < len(_BACKOFF_DELAYS):
                wait = _BACKOFF_DELAYS[min(attempt, len(_BACKOFF_DELAYS) - 1)]
                logger.warning("Network error, retrying in %ds: %s", wait, exc)
                time.sleep(wait)
                continue
            raise ImageGenError(
                "Network error reaching the image API. Check your connection.",
                code="network",
            ) from exc

        except ImageGenError:
            raise

        except Exception as exc:
            raise ImageGenError(f"Unexpected error: {exc}", code="unknown") from exc

    raise ImageGenError("Max retries exceeded — image API unavailable.", code="network")
