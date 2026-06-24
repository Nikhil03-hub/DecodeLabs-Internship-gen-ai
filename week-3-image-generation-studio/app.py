"""
app.py — DecodeLabs GenAI Week 3: Multimodal Image Generation Studio
======================================================================
PDF requirements:
  R1: HF Inference API (SDXL) integration
  R2: Aspect ratio + count payloads
  R3: Binary bytes downloaded, validated, served
  R4: timeout=(3.05, 60)
  R5: Retry/backoff 1/2/4/8s with visible status
  R6: Chunked streaming save to generated/
  R7: Pillow validation + Regenerate
  R8: Style presets
  R9: History + zip export
"""
from __future__ import annotations

import logging
import os
import time

from dotenv import load_dotenv

# Load .env BEFORE importing local modules so os.environ is populated
# when image_client.py reads HUGGINGFACE_API_TOKEN at import time.
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from flask import Flask, jsonify, render_template, request, send_file, send_from_directory

from image_client import ImageGenError, check_config, generate as gen_image
from storage import log_metadata, recent, save_stream, validate, zip_selected
from studio import ASPECT_RATIOS, STYLE_PRESETS, build_payload

# ─── Bootstrap ───────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.secret_key = os.environ.get("FLASK_SECRET_KEY", os.urandom(32))

try:
    check_config()
    _CONFIG_ERROR = None
except ImageGenError as exc:
    logger.critical("Config error: %s", exc)
    _CONFIG_ERROR = str(exc)

_GENERATED_DIR = os.path.join(os.path.dirname(__file__), "generated")
os.makedirs(_GENERATED_DIR, exist_ok=True)


# ─── Routes ──────────────────────────────────────────────────────────────────


@app.route("/")
def index():
    return render_template(
        "index.html",
        aspect_ratios=list(ASPECT_RATIOS.keys()),
        style_presets=list(STYLE_PRESETS.keys()),
    )


@app.route("/api/generate", methods=["POST"])
def generate():
    """
    POST /api/generate
    { prompt, aspect_ratio, style?, negative?, steps?, guidance?, seed? }
    → ONE image { url, filename, width, height, seed, valid, status }
    """
    if _CONFIG_ERROR:
        return jsonify({"error": _CONFIG_ERROR}), 502

    data = request.get_json(silent=True) or {}
    prompt = (data.get("prompt") or "").strip()

    if not prompt:
        return jsonify({"error": "Prompt is required."}), 400

    aspect_ratio = data.get("aspect_ratio", "1:1")
    if aspect_ratio not in ASPECT_RATIOS:
        aspect_ratio = "1:1"

    style    = data.get("style", "None")
    negative = data.get("negative", "")
    steps    = max(10, min(50, int(data.get("steps", 30))))
    guidance = max(1.0, min(15.0, float(data.get("guidance", 7.5))))
    seed_val = data.get("seed")
    seed     = int(seed_val) if seed_val is not None else int(time.time() * 1000) % (2**31)

    payload = build_payload(prompt, aspect_ratio, style, negative, steps, guidance, seed)

    # R1 + R3 + R4 + R5 — generate via HF
    try:
        image_bytes, status = gen_image(payload)
    except ImageGenError as exc:
        return jsonify({"error": str(exc)}), 502

    # R6 — chunked save
    try:
        path = save_stream(image_bytes)
    except Exception as exc:
        logger.error("Save failed: %s", exc)
        return jsonify({"error": "Failed to save the generated image."}), 500

    # R7 — validate
    qc = validate(path)
    filename = os.path.basename(path)

    # R9 — log metadata
    w, h = ASPECT_RATIOS.get(aspect_ratio, (1024, 1024))
    log_metadata({
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,
        "style": style,
        "seed": seed,
        "filename": filename,
        "ts": int(time.time()),
        "url": f"/generated/{filename}",
        "width": qc.get("width", w),
        "height": qc.get("height", h),
    })

    return jsonify({
        "url":      f"/generated/{filename}",
        "filename": filename,
        "width":    qc.get("width", w),
        "height":   qc.get("height", h),
        "seed":     seed,
        "valid":    qc.get("valid", True),
        "status":   status,
    })


@app.route("/generated/<filename>")
def serve_generated(filename: str):
    """Serve a generated image file."""
    return send_from_directory(_GENERATED_DIR, filename)


@app.route("/api/history", methods=["GET"])
def history():
    """GET /api/history — returns recent generation records."""
    return jsonify({"items": recent(20)})


@app.route("/api/download-zip", methods=["POST"])
def download_zip():
    """POST /api/download-zip { filenames: [] } — zip and send."""
    data = request.get_json(silent=True) or {}
    filenames = data.get("filenames", [])
    if not filenames:
        return jsonify({"error": "No filenames provided."}), 400

    zip_path = zip_selected(filenames)
    if not zip_path:
        return jsonify({"error": "Failed to create zip."}), 500

    return send_file(zip_path, as_attachment=True, download_name="generated-images.zip")


# ─── Run ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5002))
    app.run(host="0.0.0.0", port=port, debug=False)
