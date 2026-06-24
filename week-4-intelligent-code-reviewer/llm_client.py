"""
llm_client.py — Provider Abstraction Layer
===========================================
Shared across Weeks 1, 2, and 4.  A thin wrapper so no app code ever
talks to a vendor SDK directly.

Public API
----------
    generate(messages, *, temperature, top_p, max_output_tokens, system) -> str

    messages : list[dict]  e.g. [{"role": "user",  "content": "Hi"},
                                  {"role": "model", "content": "Hello!"}]
    Returns  : the model's reply as a plain string.
    Raises   : LLMError on any failure (auth, network, rate-limit, safety).

Provider selection: set LLM_PROVIDER env var (default "gemini").
Primary backend  : Google Gemini via the official google-genai SDK.
                   Keyed by GEMINI_API_KEY env var.
Swappable        : add an openai/anthropic backend behind the same signature.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ─── Exceptions ──────────────────────────────────────────────────────────────


class LLMError(Exception):
    """Typed error for all LLM failures — callers catch this, never raw SDK errors."""

    def __init__(self, message: str, code: str = "unknown") -> None:
        super().__init__(message)
        self.code = code  # "auth" | "rate_limit" | "network" | "safety" | "unknown"


# ─── Configuration ───────────────────────────────────────────────────────────

_PROVIDER = os.environ.get("LLM_PROVIDER", "gemini").lower()
_GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# gemini-2.5-flash: stable, free-tier, best price-performance (as of 2026)
# gemini-2.0-flash was SHUT DOWN — do not use.
_GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

_DEFAULT_SYSTEM = (
    "You are a helpful, knowledgeable, and friendly AI assistant. "
    "Be concise, accurate, and engaging in your responses."
)

# Retry settings for transient failures
_MAX_RETRIES = 3
_BACKOFF_BASE = 1.0  # seconds; doubled each retry


# ─── Start-up guard ──────────────────────────────────────────────────────────


def check_config() -> None:
    """Fail fast at startup if required env vars are missing."""
    if _PROVIDER == "gemini" and not _GEMINI_API_KEY:
        raise LLMError(
            "GEMINI_API_KEY is not set. "
            "Copy .env.example to .env and add your key from https://aistudio.google.com/apikey",
            code="auth",
        )


# ─── Gemini backend ──────────────────────────────────────────────────────────


def _gemini_generate(
    messages: list[dict],
    *,
    temperature: float,
    top_p: float,
    max_output_tokens: int,
    system: str,
) -> str:
    """Call the Gemini API via the official google-genai SDK (v1+)."""
    try:
        from google import genai
        from google.genai import types as gtypes
    except ImportError as exc:
        raise LLMError(
            "google-genai is not installed. Run: pip install google-genai",
            code="unknown",
        ) from exc

    # Build contents list from messages
    contents: list[Any] = []
    for msg in messages:
        role = msg.get("role", "user")
        if role not in ("user", "model"):
            role = "user"
        contents.append(
            gtypes.Content(
                role=role,
                parts=[gtypes.Part(text=msg.get("content", ""))],
            )
        )

    config = gtypes.GenerateContentConfig(
        system_instruction=system,
        temperature=temperature,
        top_p=top_p,
        max_output_tokens=max_output_tokens,
        candidate_count=1,
    )

    # Create client ONCE outside the retry loop (avoids repeated AFC init messages)
    client = genai.Client(api_key=_GEMINI_API_KEY)

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            response = client.models.generate_content(
                model=_GEMINI_MODEL,
                contents=contents,
                config=config,
            )
            # Extract text from response
            if response.candidates and response.candidates[0].content.parts:
                return response.candidates[0].content.parts[0].text
            # Safety block or empty
            if response.prompt_feedback and response.prompt_feedback.block_reason:
                raise LLMError(
                    "The request was blocked by safety filters. "
                    "Try rephrasing your message.",
                    code="safety",
                )
            return ""  # Rare: empty but not blocked

        except LLMError:
            raise  # Don't swallow typed errors

        except Exception as exc:
            raw_err = repr(exc)
            err_str = str(exc).lower()
            logger.error("RAW GEMINI ERROR (attempt %d/%d): %s", attempt, _MAX_RETRIES, raw_err)

            # Auth / invalid key — never retry
            if any(k in err_str for k in (
                "api_key_invalid", "api key", "permission_denied",
                "api_key not valid", "invalid api key",
                "unauthenticated", "401", "403",
            )) or ("invalid" in err_str and "key" in err_str):
                raise LLMError(
                    f"Invalid or missing GEMINI_API_KEY. "
                    f"Get a free key at https://aistudio.google.com/apikey. "
                    f"Raw error: {exc}",
                    code="auth",
                ) from exc

            # Model not found / shut down — never retry
            if any(k in err_str for k in (
                "model not found", "not found", "404",
                "invalid_argument", "model_not_found",
            )):
                raise LLMError(
                    f"Model '{_GEMINI_MODEL}' not found or shut down. "
                    f"Set GEMINI_MODEL=gemini-2.5-flash in .env. Raw: {exc}",
                    code="unknown",
                ) from exc

            # 503 Server overload — longer backoff (Gemini takes time to recover)
            if any(k in err_str for k in ("503", "unavailable", "overload")):
                if attempt < _MAX_RETRIES:
                    wait = 5.0 * (2 ** (attempt - 1))  # 5s, 10s, 20s, 40s
                    logger.warning(
                        "Gemini 503 server overload; retrying in %.0fs (attempt %d/%d)…",
                        wait, attempt, _MAX_RETRIES
                    )
                    time.sleep(wait)
                    continue
                raise LLMError(
                    "Gemini servers are temporarily overloaded (503). "
                    "This is a Google-side issue — please wait 30–60 seconds and try again.",
                    code="rate_limit",
                ) from exc

            # Rate limit / quota — exponential back-off
            if any(k in err_str for k in ("429", "quota", "resource_exhausted", "rate_limit")):
                if attempt < _MAX_RETRIES:
                    wait = _BACKOFF_BASE * (2 ** (attempt - 1))
                    logger.warning(
                        "Gemini rate-limit; retrying in %.1fs (attempt %d/%d)…",
                        wait, attempt, _MAX_RETRIES
                    )
                    time.sleep(wait)
                    continue
                raise LLMError(
                    f"Gemini quota/rate-limit reached. Free tier: 15 req/min. "
                    f"Wait a minute and try again. Raw: {exc}",
                    code="rate_limit",
                ) from exc

            # Safety block
            if any(k in err_str for k in ("safety", "blocked", "harm", "recitation")):
                raise LLMError(
                    "The request was blocked by safety filters. Try rephrasing.",
                    code="safety",
                ) from exc

            # Network / timeout — retry with backoff
            if any(k in err_str for k in ("timeout", "connect", "network", "connection")):
                if attempt < _MAX_RETRIES:
                    wait = _BACKOFF_BASE * (2 ** (attempt - 1))
                    logger.warning(
                        "Network error; retrying in %.1fs (attempt %d/%d)…",
                        wait, attempt, _MAX_RETRIES
                    )
                    time.sleep(wait)
                    continue
                raise LLMError(
                    "Network error reaching the Gemini API. Check your internet connection.",
                    code="network",
                ) from exc

            # Unknown — surface raw error immediately
            logger.error("Gemini API error (attempt %d): %s", attempt, exc, exc_info=True)
            raise LLMError(
                f"Gemini API error: {exc}",
                code="unknown",
            ) from exc

    raise LLMError("Maximum retries exceeded.", code="network")



# ─── Public API ──────────────────────────────────────────────────────────────


def generate(
    messages: list[dict],
    *,
    temperature: float = 0.7,
    top_p: float = 0.95,
    max_output_tokens: int = 1024,
    system: str = _DEFAULT_SYSTEM,
) -> str:
    """
    Generate a response from the configured LLM provider.

    Parameters
    ----------
    messages : list of {"role": "user"|"model", "content": str}
        The ordered conversation/history payload.
    temperature : float
        Creativity control (0 = deterministic, 1 = very creative).
    top_p : float
        Nucleus sampling threshold.
    max_output_tokens : int
        Maximum tokens in the response.
    system : str
        System prompt / persona instructions.

    Returns
    -------
    str
        The model's reply as plain text.

    Raises
    ------
    LLMError
        On any failure — auth, rate-limit, network, or safety block.
    """
    if _PROVIDER == "gemini":
        return _gemini_generate(
            messages,
            temperature=temperature,
            top_p=top_p,
            max_output_tokens=max_output_tokens,
            system=system,
        )

    # Future providers: add openai/anthropic backends here behind same signature.
    raise LLMError(
        f"Unknown LLM_PROVIDER '{_PROVIDER}'. Supported: gemini",
        code="unknown",
    )
