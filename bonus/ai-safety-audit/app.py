"""
app.py — AI Safety Audit Tool (Bonus Project)
==============================================
Red-teams Google Gemini against a curated prompt library,
judges each response for safety violations, and generates
a severity-scored audit report.

Routes:
  GET  /              — dashboard
  GET  /api/prompts   — list available red-team prompts
  POST /api/run       — run audit (full or by category)
  POST /api/run-one   — test a single prompt
  GET  /api/report    — download latest report as markdown
"""
from __future__ import annotations

import json
import logging
import os
import textwrap
from datetime import datetime

from google import genai
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, render_template, request

from safety_engine import RED_TEAM_PROMPTS, run_audit, run_single

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", os.urandom(24).hex())
app.config["TEMPLATES_AUTO_RELOAD"] = True

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

_API_KEY = os.getenv("GEMINI_API_KEY", "")
_client = genai.Client(api_key=_API_KEY) if _API_KEY else None

# Latest audit stored in memory (one at a time)
_last_audit: dict | None = None


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/prompts")
def list_prompts():
    """Return the red-team prompt library (without running them)."""
    categories = sorted({p["category"] for p in RED_TEAM_PROMPTS})
    return jsonify({
        "prompts":    RED_TEAM_PROMPTS,
        "categories": categories,
        "total":      len(RED_TEAM_PROMPTS),
        "api_ready":  bool(_API_KEY),
    })


@app.route("/api/run", methods=["POST"])
def run():
    """Run the full audit or a filtered subset."""
    if not _API_KEY:
        return jsonify({"error": "GEMINI_API_KEY not set."}), 503

    body       = request.get_json(force=True) or {}
    categories = body.get("categories") or None  # None = all

    try:
        global _last_audit
        result = run_audit(_client, categories=categories)
        _last_audit = result
        _last_audit["timestamp"] = datetime.utcnow().isoformat() + "Z"
        return jsonify(result)
    except Exception as exc:
        logger.exception("Audit run failed")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/run-one", methods=["POST"])
def run_one():
    """Test a single prompt by ID or by custom text."""
    if not _API_KEY:
        return jsonify({"error": "GEMINI_API_KEY not set."}), 503

    body = request.get_json(force=True) or {}
    pid  = body.get("id")
    custom_prompt = body.get("prompt")
    category      = body.get("category", "custom")

    if pid:
        item = next((p for p in RED_TEAM_PROMPTS if p["id"] == pid), None)
        if not item:
            return jsonify({"error": f"Prompt ID {pid!r} not found."}), 404
    elif custom_prompt:
        item = {
            "id": "CUSTOM",
            "category": category,
            "label": "Custom prompt",
            "prompt": custom_prompt,
            "expected_behaviour": "manual_review",
        }
    else:
        return jsonify({"error": "Provide 'id' or 'prompt'."}), 400

    try:
        result = run_single(_client, item)
        return jsonify(result)
    except Exception as exc:
        logger.exception("Single run failed")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/report")
def report():
    """Download the latest audit as a Markdown report."""
    if not _last_audit:
        return jsonify({"error": "No audit run yet."}), 404

    ts  = _last_audit.get("timestamp", "unknown")
    s   = _last_audit["summary"]
    md  = f"# AI Safety Audit Report\n\n"
    md += f"**Date:** {ts}  \n"
    md += f"**Model tested:** gemini-2.0-flash  \n"
    md += f"**Total prompts:** {s['total']}  \n\n"
    md += f"## Overall Safety Score: {s['safety_score']}/100\n\n"
    md += f"| Verdict | Count |\n|---|---|\n"
    md += f"| ✅ Safe    | {s['safe']} |\n"
    md += f"| ❌ Unsafe  | {s['unsafe']} |\n"
    md += f"| ⚠️ Partial | {s['partial']} |\n\n"
    md += f"**Average severity:** {s['avg_severity']}/10\n\n---\n\n"
    md += f"## Results by Prompt\n\n"

    for r in _last_audit["results"]:
        icon = {"SAFE": "✅", "UNSAFE": "❌", "PARTIAL": "⚠️"}.get(r["verdict"], "❓")
        md += f"### {icon} [{r['id']}] {r['label']}\n\n"
        md += f"**Category:** {r['category']}  \n"
        md += f"**Verdict:** {r['verdict']}  \n"
        md += f"**Severity:** {r['severity']}/10  \n"
        md += f"**Reason:** {r['reason']}  \n\n"
        if r.get("flags"):
            md += f"**Flags:** {', '.join(r['flags'])}  \n\n"
        md += f"**Prompt sent:**\n> {r['prompt']}\n\n"
        md += f"**AI response:**\n```\n{textwrap.shorten(r['response'], 500, placeholder='…')}\n```\n\n---\n\n"

    return Response(
        md,
        mimetype="text/markdown",
        headers={"Content-Disposition": f"attachment; filename=safety-audit-{ts[:10]}.md"},
    )


if __name__ == "__main__":
    port  = int(os.getenv("PORT", 5005))
    debug = os.getenv("FLASK_DEBUG", "true").lower() == "true"
    logger.info("AI Safety Audit → http://localhost:%d", port)
    app.run(host="0.0.0.0", port=port, debug=debug)
