"""
app.py — DecodeLabs GenAI Week 1: Custom AI Chatbot with Memory
================================================================
Flask backend.  Satisfies all PDF requirements:
  R1: Real Gemini call via official google-genai SDK
  R2: SESSIONS in-memory list array
  R3: Append every user + model turn; send full array each call
  R4: Context preserved across the session
  R5: Prune loop when over token budget
  R6: chat_cli.py bonus terminal interface
"""

from __future__ import annotations

import logging
import os
import secrets
import uuid

from flask import Flask, jsonify, render_template, request, session
from dotenv import load_dotenv

from llm_client import LLMError, check_config
import memory as mem

# ─── Bootstrap ───────────────────────────────────────────────────────────────

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# A secure random secret key for signed session cookies.
# In production, set FLASK_SECRET_KEY in your .env.
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

# Fail fast at startup if GEMINI_API_KEY is missing
try:
    check_config()
except LLMError as exc:
    logger.critical("Configuration error: %s", exc)
    # Let the server start but every request will return a clear error.
    _CONFIG_ERROR = str(exc)
else:
    _CONFIG_ERROR = None

# ─── Helpers ─────────────────────────────────────────────────────────────────

_MAX_INPUT_LEN = 4_000  # characters
_CHATBOT_SYSTEM = (
    "You are an intelligent, warm, and helpful AI assistant. "
    "You maintain context across the conversation and refer back to earlier "
    "messages when relevant. Keep responses clear and engaging. "
    "If asked about your memory, explain that you see the full conversation "
    "history in each request."
)


def _get_session_id() -> str:
    """Return the current session's ID, creating one if absent."""
    if "session_id" not in session:
        session["session_id"] = str(uuid.uuid4())
    return session["session_id"]


def _history_summary(history: list[dict]) -> dict:
    """Build the memory-panel payload sent to the frontend."""
    return {
        "memory": history,
        "message_count": len(history),
        "est_tokens": mem.estimate_tokens(history),
    }


# ─── Routes ──────────────────────────────────────────────────────────────────


@app.route("/")
def index():
    """Serve the chat UI (index.html). Ensure session_id is set."""
    _get_session_id()
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    POST /api/chat  { "message": str }

    1. Append user message to in-memory array (R2, R3)
    2. Prune if over token budget (R5)
    3. Call Gemini with full history array (R1, R4)
    4. Append model reply to array (R3)
    5. Return reply + memory snapshot
    """
    if _CONFIG_ERROR:
        return jsonify({"error": _CONFIG_ERROR}), 502

    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()

    # Input validation
    if not message:
        return jsonify({"error": "Message cannot be empty."}), 400
    if len(message) > _MAX_INPUT_LEN:
        return jsonify(
            {"error": f"Message too long ({len(message)} chars). Max {_MAX_INPUT_LEN} chars."}
        ), 400

    session_id = _get_session_id()
    history = mem.get_history(session_id)

    # --- R3: Append user turn ---
    mem.append_turn(session_id, "user", message)

    # --- R5: Prune if needed ---
    pruned = mem.prune_if_needed(history)
    if pruned:
        logger.info("Session %s: context pruned", session_id)

    # --- R1 + R4: Call LLM with the FULL history array ---
    try:
        import llm_client
        reply = llm_client.generate(
            history,
            temperature=0.7,
            top_p=0.95,
            max_output_tokens=1024,
            system=_CHATBOT_SYSTEM,
        )
    except LLMError as exc:
        # Roll back the user turn on failure so history stays clean
        if history and history[-1]["role"] == "user":
            history.pop()
        logger.warning("LLMError for session %s: %s", session_id, exc)
        return jsonify({"error": str(exc)}), 502

    # --- R3: Append model reply ---
    mem.append_turn(session_id, "model", reply)

    summary = _history_summary(history)
    return jsonify({
        "reply": reply,
        "pruned": pruned,
        **summary,
    })


@app.route("/api/history", methods=["GET"])
def get_history():
    """
    GET /api/history  — returns the current memory panel payload.
    Powers the Memory panel on page load / refresh.
    """
    session_id = _get_session_id()
    history = mem.get_history(session_id)
    return jsonify(_history_summary(history))


@app.route("/api/reset", methods=["POST"])
def reset_session():
    """
    POST /api/reset  — clear this session's history (New Chat).
    """
    session_id = _get_session_id()
    mem.reset(session_id)
    logger.info("Session %s: reset by user", session_id)
    return jsonify({"ok": True})


# ─── Run ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    logger.info("Starting DecodeLabs GenAI — Week 1 on http://localhost:%d", port)
    app.run(host="0.0.0.0", port=port, debug=debug)
