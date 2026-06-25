# 🎨 Multimodal AI Image Generation Studio

> **DecodeLabs Generative AI Internship 2026 · Week 3**
> A Midjourney-style image studio powered by Stable Diffusion XL — with aspect ratio control, style presets, batch generation, and production-grade reliability patterns.

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-black?logo=flask)](https://flask.palletsprojects.com)
[![HuggingFace](https://img.shields.io/badge/HuggingFace-SDXL-FFD21E?logo=huggingface&logoColor=black)](https://huggingface.co)
[![License](https://img.shields.io/badge/License-MIT-green)](../LICENSE)

```bash
cd week-3-image-generation-studio
cp .env.example .env   # add HUGGINGFACE_API_TOKEN
python app.py          # → http://localhost:5002
```

---

## Screenshots

> *(Add screenshots after running — embed here for portfolio)*
> ```md
> ![Empty studio](screenshots/01-empty.png)
> ![Generation in progress](screenshots/02-generating.png)
> ![Gallery with results](screenshots/03-gallery.png)
> ![Lightbox view](screenshots/04-lightbox.png)
> ```

---

## Overview

A browser-based image generation studio that gives users full control over the AI generation pipeline: prompt, negative prompt, aspect ratio, style presets, batch count, guidance scale, inference steps, and seed. Images are displayed in a gallery with a fullscreen lightbox, individual download buttons, and a zip export.

The project intentionally puts the PDF's **required reliability patterns front and centre**: the free-tier Hugging Face API cold-starts frequently, so the exponential back-off and retry logic are not optional — they're what make the app actually work.

---

## Problem Statement

> *"Integrate a text-to-image API. Provide payload controls for resolution, aspect ratio, and image count. Handle binary/URL image data. Display and download images cleanly."*
> — DecodeLabs Generative AI Project 3 brief

---

## Solution Architecture

```
┌──────── BROWSER (image studio) ────────────────────────────┐
│ Prompt / Negative prompt / Style preset chips               │
│ Aspect ratio: 1:1 | 16:9 | 9:16                            │
│ Sliders: Count (1-4) · Guidance (1-20) · Steps (20-50)     │
│ Gallery: tiles + lightbox + download + zip                  │
└──────────────────────┬──────────────────────────────────────┘
                       │ POST /api/generate
                       ▼
┌──────── FLASK (app.py) ────────────────────────────────────┐
│ 1. validate prompt + params                                 │
│ 2. image_client.generate_image(prompt, params)  (R1/R2/R3) │
│    ├── build payload: {inputs, parameters}       (R4)      │
│    ├── POST to HF Inference API (binary response)(R5)      │
│    ├── timeout=(3.05, 60)                        (R6)      │
│    ├── retry w/ exponential back-off 1/2/4/8s   (R7)      │
│    └── 503 model-load → wait + retry            (R8)      │
│ 3. chunked save to disk (8 KB chunks)            (R9)      │
│ 4. Pillow QC validation                                     │
│ 5. return { image_url, seed, params }                       │
└──────── Hugging Face Inference API (SDXL) ──────────────────┘
```

---

## Features

| Feature | PDF Req | Status |
|---|---|---|
| Text-to-image via Hugging Face Inference API | R1 | ✅ |
| Aspect ratio control: 1:1 / 16:9 / 9:16 | R2 | ✅ |
| Image count control: 1–4 per generation | R3 | ✅ |
| Handles binary image data (raw bytes → disk) | R4 | ✅ |
| Proper timeout `(3.05, 60)` on all API calls | R5 | ✅ |
| Exponential back-off: 1 / 2 / 4 / 8 s | R6 | ✅ |
| 503 model-load wait & retry | R7 | ✅ |
| Chunked streaming save (8 KB) | R8 | ✅ |
| Pillow QC validation on saved image | R9 | ✅ |
| Style presets (7 options) appended to prompt | *(bonus)* | ✅ |
| Negative prompt support | *(bonus)* | ✅ |
| Guidance scale + inference steps sliders | *(bonus)* | ✅ |
| Seed locking for reproducible generation | *(bonus)* | ✅ |
| History sidebar + zip export | *(bonus)* | ✅ |
| Gallery lightbox + per-image download | *(bonus)* | ✅ |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 · Flask 3.0 |
| Image API | Hugging Face Inference API · Stable Diffusion XL |
| Image handling | `requests` (binary streaming) · `Pillow` (QC) |
| Frontend | Vanilla HTML/CSS/JS |
| Config | `python-dotenv` |

---

## Folder Structure

```
week-3-image-generation-studio/
├── app.py               Flask routes + generation orchestration
├── image_client.py      HF Inference API abstraction + retry logic
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
├── REQUIREMENTS.md
├── templates/index.html
├── static/
│   ├── css/theme.css    Shared dark design system
│   └── js/app.js        Studio UI + gallery + lightbox
└── generated/           (git-ignored) saved images
```

---

## Setup (Local)

**Prerequisites:** Python 3.11+, a free Hugging Face API token.

```bash
# 1. Navigate to this folder
cd week-3-image-generation-studio

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Open .env and set HUGGINGFACE_API_TOKEN=your_token_here

# 5. Run
python app.py

# 6. Open in browser
# → http://localhost:5002
```

---

## Configuration

| Variable | Required | Description |
|---|---|---|
| `HUGGINGFACE_API_TOKEN` | ✅ | Free at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) |
| `FLASK_SECRET_KEY` | No | Auto-generated if unset |
| `FLASK_DEBUG` | No | `true` for development |

> **Note:** The HF free tier cold-starts the SDXL model frequently. The first request in a session may take 20–60 seconds while the model loads — this is expected and the app handles it with a "model warming up" retry loop.

---

## Usage

1. **Write a prompt** — describe the image you want to generate.
2. **Add a negative prompt** *(optional)* — things to exclude from the image.
3. **Choose style** — Cyberpunk, Photoreal, Anime, Minimalism, 3D Render, Oil Painting, or None.
4. **Set aspect ratio** — 1:1 square, 16:9 landscape, or 9:16 portrait.
5. **Adjust count** — 1–4 images per generation.
6. **Tune advanced settings** — guidance scale and inference steps.
7. **Generate** — results appear in the gallery. Click a tile for fullscreen lightbox.
8. **Download** — individual images via the download button, or select multiple for zip export.

---

## Deployment (Render)

1. Push this folder to a GitHub repo.
2. Create a new **Web Service** on [Render](https://render.com).
3. **Build command:** `pip install -r requirements.txt`
4. **Start command:** `gunicorn app:app`
5. Add `HUGGINGFACE_API_TOKEN` and `FLASK_SECRET_KEY` as Environment Variables.
6. Note: `generated/` is in `.gitignore` — images are stored on Render's ephemeral disk (cleared on restart). For persistence, swap to an S3 bucket.

---

## Requirement Compliance

See [REQUIREMENTS.md](REQUIREMENTS.md) for the full PDF requirement → feature traceability table.

---

## Future Improvements

- S3 or Cloudflare R2 for persistent image storage
- Image-to-image (img2img) using an uploaded reference
- Inpainting — edit a specific region of a generated image
- ControlNet integration for pose/depth conditioning
- User gallery saved to SQLite for session persistence

---

## Author

**Nikhil** · DecodeLabs Generative AI Internship 2026
[GitHub](https://github.com/Nikhil03-hub) · Powered by Hugging Face · Stable Diffusion XL
