"""
app.py — DecodeLabs GenAI Week 2: Automated Copywriting & Tone Transformer
===========================================================================
Flask backend. PDF requirements satisfied:
  R1: Inputs Product_Name, Platform, Tone (+ description)
  R2: Dynamic string template compiled from variables; surfaced in UI
  R3: Temperature + Top-P controls flow into Gemini generation config
  R4: Platform-tailored output (LinkedIn vs Instagram vs Email vs Twitter differ)
  R5: Length validation per platform; over-limit flagged
  R6: Compare-temperatures endpoint
  R7: Multiple variations + export support
"""

from __future__ import annotations

import logging
import os

from flask import Flask, jsonify, render_template, request
from dotenv import load_dotenv

from llm_client import LLMError, check_config
from prompt_compiler import PLATFORMS, TONES, compile as compile_prompt, parse_structured

# ─── Bootstrap ───────────────────────────────────────────────────────────────

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.secret_key = os.environ.get("FLASK_SECRET_KEY", os.urandom(32))

try:
    check_config()
    _CONFIG_ERROR = None
except LLMError as exc:
    logger.critical("Config error: %s", exc)
    _CONFIG_ERROR = str(exc)

# ─── Helpers ─────────────────────────────────────────────────────────────────


def _clamp(val: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, float(val)))


# ─── Routes ──────────────────────────────────────────────────────────────────


@app.route("/")
def index():
    return render_template("index.html", platforms=list(PLATFORMS.keys()), tones=list(TONES.keys()))


@app.route("/api/generate", methods=["POST"])
def generate():
    """
    POST /api/generate
    Body: { product_name, description, platform, tone, temperature, top_p, n }
    Returns: { compiled_prompt, variations[], platform_limit, platform, tone }
    """
    if _CONFIG_ERROR:
        return jsonify({"error": _CONFIG_ERROR}), 502

    data = request.get_json(silent=True) or {}

    product_name = (data.get("product_name") or "").strip()
    description  = (data.get("description") or "").strip()
    platform     = (data.get("platform") or "LinkedIn").strip()
    tone         = (data.get("tone") or "Professional").strip()
    n            = int(data.get("n", 1))
    temperature  = _clamp(data.get("temperature", 0.7), 0.0, 1.0)
    top_p        = _clamp(data.get("top_p", 0.95), 0.0, 1.0)

    # Validation
    if not product_name:
        return jsonify({"error": "Product name is required."}), 400
    if not description:
        return jsonify({"error": "Product description is required."}), 400
    if platform not in PLATFORMS:
        return jsonify({"error": f"Unknown platform '{platform}'."}), 400
    if tone not in TONES:
        return jsonify({"error": f"Unknown tone '{tone}'."}), 400
    n = max(1, min(4, n))

    # R2: compile the dynamic template
    compiled = compile_prompt(product_name, description, platform, tone, n)

    # R3: call LLM with temperature + top_p
    try:
        import llm_client
        raw = llm_client.generate(
            [{"role": "user", "content": compiled}],
            temperature=temperature,
            top_p=top_p,
            max_output_tokens=2048,
            system="You are a professional marketing copywriter. Follow the user's instructions precisely.",
        )
    except LLMError as exc:
        return jsonify({"error": str(exc)}), 502

    # Parse + length validate (R4, R5)
    variations = parse_structured(raw, platform)
    spec = PLATFORMS[platform]

    return jsonify({
        "compiled_prompt": compiled,
        "variations": variations,
        "platform_limit": spec.get("char_limit"),
        "platform": platform,
        "tone": tone,
        "temperature": temperature,
        "top_p": top_p,
    })


@app.route("/api/compare-temps", methods=["POST"])
def compare_temps():
    """
    POST /api/compare-temps — R6 temperature comparison
    Same as /api/generate but runs at temps 0.2 / 0.7 / 1.0 and returns all three.
    """
    if _CONFIG_ERROR:
        return jsonify({"error": _CONFIG_ERROR}), 502

    data = request.get_json(silent=True) or {}
    product_name = (data.get("product_name") or "").strip()
    description  = (data.get("description") or "").strip()
    platform     = (data.get("platform") or "LinkedIn").strip()
    tone         = (data.get("tone") or "Professional").strip()

    if not product_name or not description:
        return jsonify({"error": "Product name and description are required."}), 400
    if platform not in PLATFORMS:
        return jsonify({"error": f"Unknown platform '{platform}'."}), 400

    compiled = compile_prompt(product_name, description, platform, tone, n=1)
    results = []

    for temp in [0.2, 0.7, 1.0]:
        try:
            import llm_client
            raw = llm_client.generate(
                [{"role": "user", "content": compiled}],
                temperature=temp,
                top_p=0.95,
                max_output_tokens=1024,
                system="You are a professional marketing copywriter. Follow the user's instructions precisely.",
            )
            variations = parse_structured(raw, platform)
        except LLMError as exc:
            variations = [{"text": f"Error: {exc}", "char_count": 0, "within_limit": True, "over_by": 0, "subject": "", "body": ""}]

        results.append({"temperature": temp, "variations": variations})

    return jsonify({"results": results, "platform": platform, "tone": tone})


# ─── Run ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
