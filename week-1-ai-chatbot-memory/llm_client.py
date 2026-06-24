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

# Default Gemini Flash model — fast, free-tier friendly.
# NOTE: Verify the exact current model string against Google AI Studio docs
# at https://ai.google.dev/gemini-api/docs/models  before deploying.
_GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")

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
            "Copy .env.example → .env and add your key from https://aistudio.google.com/apikey",
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
        # google-genai SDK uses "user" and "model" roles
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

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            client = genai.Client(api_key=_GEMINI_API_KEY)
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
            print("RAW GEMINI ERROR:", repr(exc))
            err_str = str(exc).lower()

            # Rate limit — exponential back-off
            if "429" in err_str or "quota" in err_str or "resource_exhausted" in err_str:
                if attempt < _MAX_RETRIES:
                    wait = _BACKOFF_BASE * (2 ** (attempt - 1))
                    logger.warning("Gemini rate-limit hit; retrying in %.1fs (attempt %d)…", wait, attempt)
                    time.sleep(wait)
                    continue
                raise LLMError(
                    "API rate limit reached. Please wait a moment and try again.",
                    code="rate_limit",
                ) from exc

            # Auth
            if "api_key" in err_str or "401" in err_str or "invalid" in err_str and "key" in err_str:
                raise LLMError(
                    "Invalid GEMINI_API_KEY. Check your key in .env.",
                    code="auth",
                ) from exc

            # Safety block
            if "safety" in err_str or "blocked" in err_str or "harm" in err_str:
                raise LLMError(
                    "The request was blocked by safety filters.",
                    code="safety",
                ) from exc

            # Network / timeout — retry
            if any(k in err_str for k in ("timeout", "connect", "network", "connection", "unavailable")):
                if attempt < _MAX_RETRIES:
                    wait = _BACKOFF_BASE * (2 ** (attempt - 1))
                    logger.warning("Network error; retrying in %.1fs (attempt %d)…", wait, attempt)
                    time.sleep(wait)
                    continue
                raise LLMError(
                    "Network error reaching the Gemini API. Check your connection.",
                    code="network",
                ) from exc

            # Unknown
            logger.error("Gemini API error (attempt %d): %s", attempt, exc, exc_info=True)
            raise LLMError(
                f"An unexpected error occurred: {exc}",
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

    # Future providers slot here:
    # elif _PROVIDER == "openai":
    #     return _openai_generate(...)
    # elif _PROVIDER == "anthropic":
    #     return _anthropic_generate(...)

    raise LLMError(
        f"Unknown LLM_PROVIDER '{_PROVIDER}'. Supported: gemini",
        code="unknown",
    )
