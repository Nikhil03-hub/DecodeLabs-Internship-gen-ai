"""
app.py — DecodeLabs GenAI Week 4: Intelligent Code Reviewer
============================================================
PDF requirements:
  R1: Code submission via file upload or text paste
  R2: Structured JSON output (analyzer.py)
  R3: validate_output + repair retry (analyzer.py)
  R4: Bug report list with severity levels
  R5: Overall quality score (0-100)
  R6: Refactored code suggestion
  R7: Language auto-detection (ingest.py)
  R8: Export review as Markdown
"""
from __future__ import annotations

import logging
import os
import tempfile

from flask import Flask, jsonify, render_template, request
from dotenv import load_dotenv

from analyzer import analyze
from ingest import IngestError, read_file, read_text
from llm_client import LLMError, check_config

# ─── Bootstrap ───────────────────────────────────────────────────────────────

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.secret_key = os.environ.get("FLASK_SECRET_KEY", os.urandom(32))
app.config["MAX_CONTENT_LENGTH"] = 200 * 1024  # 200 KB upload limit

try:
    check_config()
    _CONFIG_ERROR = None
except LLMError as exc:
    logger.critical("Config error: %s", exc)
    _CONFIG_ERROR = str(exc)


# ─── Routes ──────────────────────────────────────────────────────────────────


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/review", methods=["POST"])
def review_file():
    """
    POST /api/review (multipart file upload)
    → { overall_score, summary, language, bug_report, refactored_code, _stats }
    """
    if _CONFIG_ERROR:
        return jsonify({"error": _CONFIG_ERROR}), 502

    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify({"error": "No file uploaded."}), 400

    # Save to temp file to let ingest.py handle encoding
    suffix = os.path.splitext(f.filename)[1] or ".txt"
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            f.save(tmp.name)
            tmp_path = tmp.name

        code, language = read_file(tmp_path)
    except IngestError as exc:
        return jsonify({"error": str(exc)}), 400
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    return _run_review(code, filename=f.filename, language=language)


@app.route("/api/review-text", methods=["POST"])
def review_text():
    """
    POST /api/review-text { code, language?, filename? }
    → { overall_score, summary, language, bug_report, refactored_code, _stats }
    """
    if _CONFIG_ERROR:
        return jsonify({"error": _CONFIG_ERROR}), 502

    data = request.get_json(silent=True) or {}
    raw_code = data.get("code", "")
    language  = data.get("language") or None
    filename  = data.get("filename", "pasted_code")

    try:
        code, detected_lang = read_text(raw_code, language=language)
    except IngestError as exc:
        return jsonify({"error": str(exc)}), 400

    return _run_review(code, filename=filename, language=detected_lang)


def _run_review(code: str, filename: str, language: str):
    """Shared review runner — calls analyzer and returns JSON."""
    try:
        result = analyze(code, filename=filename, language=language)
        return jsonify(result)
    except LLMError as exc:
        logger.error("LLM error: %s (code=%s)", exc, exc.code)
        if exc.code == "auth":
            return jsonify({"error": "Invalid Gemini API key. Check your .env file."}), 502
        if exc.code == "rate_limit":
            return jsonify({"error": "Gemini rate limit reached. Please wait and retry."}), 429
        return jsonify({"error": str(exc)}), 502
    except ValueError as exc:
        logger.error("Analysis failed (structured output): %s", exc)
        return jsonify({"error": f"Could not parse AI response: {exc}"}), 500
    except Exception as exc:
        logger.exception("Unexpected error in review")
        return jsonify({"error": f"Unexpected error: {exc}"}), 500


# ─── Run ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5003))
    app.run(host="0.0.0.0", port=port, debug=False)
