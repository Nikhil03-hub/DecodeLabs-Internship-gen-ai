# Week 3 — Multimodal AI Image Generation Studio

> DecodeLabs GenAI Internship 2026 | Nikhil

A Midjourney-style image generation studio powered by Stable Diffusion XL via the Hugging Face Inference API.

## Features

- **Text-to-image** with Stable Diffusion XL (free tier)
- **Aspect ratio control**: 1:1 (1024×1024) / 16:9 (1344×768) / 9:16 (768×1344)
- **Style presets**: Cyberpunk, Minimalism, Photoreal, Anime, 3D Render, Oil Painting
- **Batch generation**: 1–4 images in a single session
- **Advanced controls**: guidance scale, inference steps, seed locking
- **Reliability patterns**: `timeout=(3.05, 60)`, exponential backoff 1/2/4/8s, 503 model-load wait
- **Chunked save** to disk + Pillow QC validation
- **History sidebar** + zip export of selected images

## Quick Start

```bash
cd week-3-image-generation-studio
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — add your HF token from https://huggingface.co/settings/tokens
python app.py  # → http://localhost:5002
```

## Deploy to Render

1. Create new **Web Service**, connect this folder
2. Build command: `pip install -r requirements.txt`
3. Start command: `gunicorn app:app`
4. Add env vars: `HUGGINGFACE_API_TOKEN`, `FLASK_SECRET_KEY`
5. Add `generated/` to `.gitignore` (already done) — images stored on ephemeral disk

## PDF Requirements Met

See [REQUIREMENTS.md](REQUIREMENTS.md) for R1–R9 traceability.
