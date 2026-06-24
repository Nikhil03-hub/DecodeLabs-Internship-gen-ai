"""
memory.py — Session Memory Store
==================================
Implements the "in-memory list array" required by the DecodeLabs Week 1 PDF.

SESSIONS is a module-level dict:  session_id -> list[Message]
This IS the required in-memory history array.  Every turn appends to it
and the entire array is sent back to the model on every call.

Types
-----
Message = {"role": "user" | "model", "content": str}

Public API
----------
    get_history(session_id)           -> list[Message]
    append_turn(session_id, role, content)
    estimate_tokens(history)          -> int
    prune_if_needed(history, max_tokens) -> bool
    reset(session_id)
    MAX_CONTEXT_TOKENS                   constant
"""

from __future__ import annotations

import logging
from typing import TypedDict

logger = logging.getLogger(__name__)

# ─── Types ───────────────────────────────────────────────────────────────────

class Message(TypedDict):
    role: str       # "user" | "model"
    content: str


# ─── Storage ─────────────────────────────────────────────────────────────────

# THE in-memory list array — one list per session_id.
# Lives for the lifetime of the Flask process (= the "live session").
SESSIONS: dict[str, list[Message]] = {}

# Token budget — kept deliberately low so pruning is demonstrable.
# A real system might use 30_000+ for flash models; 6000 surfaces the feature.
MAX_CONTEXT_TOKENS: int = 6_000


# ─── Public API ──────────────────────────────────────────────────────────────


def get_history(session_id: str) -> list[Message]:
    """Return (or create) the history list for a session."""
    if session_id not in SESSIONS:
        SESSIONS[session_id] = []
    return SESSIONS[session_id]


def append_turn(session_id: str, role: str, content: str) -> None:
    """
    Append one message to this session's history array (R3).

    Parameters
    ----------
    session_id : str
    role       : "user" | "model"
    content    : the message text
    """
    history = get_history(session_id)
    history.append({"role": role, "content": content})
    logger.debug("Session %s: appended %s turn (total=%d)", session_id, role, len(history))


def estimate_tokens(history: list[Message]) -> int:
    """
    Heuristic token estimate: ~1 token per 4 characters.

    NOTE: The google-genai SDK exposes an exact token counter via
    client.models.count_tokens(); this heuristic is used here to keep
    the module free of SDK imports and to keep the estimate instant.
    Replace with the SDK call for production accuracy.
    """
    total_chars = sum(len(m["content"]) for m in history)
    return total_chars // 4


def prune_if_needed(
    history: list[Message],
    max_tokens: int = MAX_CONTEXT_TOKENS,
) -> bool:
    """
    PDF R5 — Token-limit pruning loop.

    If the estimated token count exceeds max_tokens, repeatedly drop
    the OLDEST user+model pair (never drop a system message) until
    the history fits within budget.

    Returns True if any pruning occurred (triggers the UI badge).
    """
    if estimate_tokens(history) <= max_tokens:
        return False

    pruned = False
    while estimate_tokens(history) > max_tokens and len(history) >= 2:
        # Drop the oldest pair (index 0 = oldest user msg, index 1 = its model reply)
        # Skip any leading "system" role messages that we might pin later
        drop_idx = 0
        # Find first user or model message to drop
        for i, msg in enumerate(history):
            if msg["role"] in ("user", "model"):
                drop_idx = i
                break

        # Drop the oldest user message and its following model reply (if exists)
        removed = history.pop(drop_idx)
        logger.debug("Pruned oldest %s message: %.60s…", removed["role"], removed["content"])

        # Also drop the next message if it's the paired model reply
        if drop_idx < len(history) and history[drop_idx]["role"] == "model":
            history.pop(drop_idx)

        pruned = True

    if pruned:
        logger.info("History pruned to %d messages (~%d tokens)", len(history), estimate_tokens(history))

    return pruned


def reset(session_id: str) -> None:
    """Clear this session's history array (New Chat)."""
    SESSIONS[session_id] = []
    logger.debug("Session %s: history reset", session_id)
