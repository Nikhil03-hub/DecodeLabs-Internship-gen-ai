# Week 3 — Multimodal Image Generation Studio

**DecodeLabs Gen AI · Project 3** · Status: **REQUIRED** · Folder: `week-3-image-generation-studio/`
**Stack:** Flask + vanilla JS · **Hugging Face Inference API (free SDXL)** · shared design system.
> Read `00-MASTER-ARCHITECTURE.md` first. This file = full design + the copy-paste Sonnet master prompt (bottom).

---

## 1. The contract — verbatim from the PDF (+ the technical lessons it teaches)

> **Goal:** A visual application that translates natural-language descriptions into high-quality digital artwork.
>
> **Key Requirements:**
> 1. **Integrate an image-generation API** (like DALL-E 3 or Stable Diffusion).
> 2. **Set up parameter payloads for resolution, aspect ratio, and generation count.**
> 3. **Download the resulting binary image data or URL and display it cleanly.**
>
> **Key Skills:** Text-to-image APIs, handling image URLs/binary streams, design parameters.
>
> **Conclusion / bonus:** automated download pipeline saving high-res assets locally; **style preset parameters** (cyberpunk, minimalism, …).

**The PDF's middle pages explicitly teach these production patterns — implement them (they are the grade-winners):**
- **Aspect-ratio → resolution map:** `1:1 → 1024×1024` (logos/avatars), `16:9 → 1344×768` (thumbnails/web), `9:16 → 768×1344` (Reels/Shorts).
- **Timeouts:** image gen takes 20–60 s; use **separate connect + read timeouts** `timeout=(3.05, 60)` so the app never hangs forever.
- **Retry with exponential back-off:** on `429 Too Many Requests` (and HF `503 model loading`), wait **1 → 2 → 4 → 8 s** instead of hammering.
- **Streaming download to disk:** don't hold whole images in RAM; **write bytes to disk in chunks** (scalable).
- **Quality check:** verify the result — **aesthetic** (looks good) and **semantic** (matches the prompt); regenerate on failure.

> **Provider note:** we use the **Hugging Face Inference API (free)** with a Stable-Diffusion-XL model. HF returns **raw binary image bytes**, so the PDF's "binary image data" handling is satisfied literally, and HF's free-tier **cold-start (503) + rate-limit (429)** behavior is exactly why the timeout/retry/back-off logic is genuinely needed — turning a compliance requirement into a real, demonstrable engineering feature.

---

## 2. Requirement → feature traceability (becomes `REQUIREMENTS.md`)

| # | PDF requirement | How it's satisfied | Where reviewer sees it |
|---|---|---|---|
| R1 | Integrate an image-gen API | `image_client.py` calls HF Inference API (SDXL) with `HUGGINGFACE_API_TOKEN` | Real generated images; README Tech Stack |
| R2 | Payloads for resolution, **aspect ratio**, **count** | Aspect-ratio segmented control → width/height; count stepper (1–4); payload builder | Controls in the studio panel |
| R3 | Handle **binary** image data + display cleanly | HF bytes → validated (Pillow) → saved → served → shown in gallery | Gallery grid + lightbox |
| R4 | **Timeouts** (connect/read) | `timeout=(3.05, 60)` on every request | `image_client.py`; README |
| R5 | **Retry + exponential back-off** | 429/503 → 1/2/4/8 s back-off; respects HF `estimated_time` on cold start | "retried / model warmed up" status line |
| R6 | **Streaming download to disk** | bytes written to `generated/` in chunks | saved files + per-image Download |
| R7 | **Quality check** | validate decodable image + correct dimensions; manual **Regenerate**; (CLIP semantic = future) | "valid ✓" badge + Regenerate |
| R8 (bonus) | **Style presets** | Cyberpunk / Minimalism / Photoreal / Anime / 3D / Oil-painting appended to prompt | Style chips |
| R9 (bonus) | Local high-res asset pipeline + gallery/history | `generated/` store + metadata log + prompt history + "Download all (zip)" | History sidebar + export |

---

## 3. End-to-end architecture

```
┌──────────────────────── BROWSER (AI Image Studio) ────────────────────────┐
│  Prompt textarea                          │  GALLERY (grid of results)      │
│  Style chips: [Cyberpunk][Minimal]…(R8)   │  • image + dims + seed          │
│  Aspect: ( 1:1 )( 16:9 )( 9:16 )  (R2)    │  • Download · Regenerate (R7)   │
│  Count: [1–4]   ▸ Advanced (neg, steps,   │  • "valid ✓" QC badge           │
│         guidance, seed)        [Generate] │  • status: "model warmed up 7s" │
│  History sidebar (recent prompts)         │  • Download all (zip) (R9)      │
└───────────────┬────────────────────────────────────────────────────────────┘
        frontend loops `count` times, one call per image (live progress "2/4")
                │ POST /api/generate { prompt, aspect_ratio, style, seed, negative, steps, guidance }
                ▼
┌──────────────────────── FLASK BACKEND (app.py) ───────────────────────────┐
│ 1. validate + build payload (width/height from aspect ratio)   (R2)        │
│ 2. bytes = image_client.generate(payload)                                  │
│      • timeout=(3.05,60)                                       (R4)        │
│      • retry/backoff on 429 & 503-loading (1/2/4/8s)           (R5)        │
│ 3. validate image (Pillow: decodable + dims)                   (R7)        │
│ 4. path = storage.save_stream(bytes)  ← chunked write to disk  (R6, R9)    │
│ 5. log metadata (prompt, ratio, style, seed, file)                          │
│ 6. return { url, filename, width, height, seed, valid, status }            │
└───────────────┬────────────────────────────────────────────────────────────┘
                ▼  HF Inference API  (stabilityai/SDXL) → raw PNG bytes  (R1, R3)
GET /generated/<file>  serves saved assets   ·   generated/  is git-ignored
```

**Why frontend-loops-per-image:** each image is an isolated request with its own timeout/retry, so one slow/failed image doesn't sink the batch; the gallery fills progressively ("Generating 2 of 4…"); free-tier rate-limits are respected (sequential, gentle). The backend `/api/generate` handles exactly one image robustly.

---

## 4. Folder structure

```
week-3-image-generation-studio/
├── app.py                 # Flask routes
├── image_client.py        # HF integration: payload, timeout, retry/backoff, returns bytes
├── storage.py             # chunked save to generated/, metadata log, zip export
├── studio.py              # ASPECT_RATIOS, STYLE_PRESETS, build_payload()
├── requirements.txt       # flask, requests, pillow, python-dotenv, gunicorn
├── .env.example           # IMAGE_PROVIDER, HUGGINGFACE_API_TOKEN
├── .gitignore             # + generated/
├── README.md
├── REQUIREMENTS.md
├── SCREENSHOT_PLAN.md
├── templates/index.html
├── static/css/theme.css   # shared design system
├── static/js/app.js
├── generated/             # saved assets (git-ignored, auto-created)
└── screenshots/
```

---

## 5. Backend design (contracts, not code)

**`studio.py`**
- `ASPECT_RATIOS = {"1:1":(1024,1024), "16:9":(1344,768), "9:16":(768,1344)}` (exact PDF values).
- `STYLE_PRESETS = {None, "Cyberpunk", "Minimalism", "Photoreal", "Anime", "3D Render", "Oil Painting"}` → each a suffix appended to the prompt (e.g., "…, cyberpunk neon aesthetic, …"). (R8)
- `build_payload(prompt, ratio, style, negative, steps, guidance, seed) -> dict` — assembles HF `{inputs, parameters:{negative_prompt, width, height, guidance_scale, num_inference_steps, seed}}`. (R2) (Note: SDXL is happiest near 1024px; comment that some HF serverless models clamp width/height — Sonnet verifies behavior and falls back to native size if needed.)

**`image_client.py`** (R1, R4, R5)
- `generate(payload) -> bytes` — POST to HF model endpoint with `Authorization: Bearer <token>`, `timeout=(3.05, 60)`.
  - **429** → exponential back-off retry 1/2/4/8 s (cap ~4 tries).
  - **503** (`{"error":"...loading","estimated_time":X}`) → wait ~`estimated_time` (bounded) then retry — surface "model warming up (~Xs)".
  - Non-image/4xx → raise typed `ImageGenError` with a friendly message.
  - Returns raw bytes; records a small `status` (e.g., "ok", "retried after rate-limit", "model warmed up in Xs") to surface in the UI (R5 made visible).

**`storage.py`** (R6, R9)
- `save_stream(bytes_or_iter) -> path` — write to `generated/<timestamp>-<shortid>.png` **in chunks** (don't materialize twice in RAM). (If a provider ever returns a URL instead, download with `requests.get(url, stream=True)` and `iter_content`.)
- `validate(path) -> {valid, width, height}` — open with Pillow, confirm decodable + dimensions (R7).
- `log_metadata(record)` / `recent(limit)` — append/read a small `generated/_history.json` for the prompt-history sidebar + gallery.
- `zip_selected(filenames) -> path` — bonus "Download all".

**`app.py` routes:**

| Method · Path | Request | Response |
|---|---|---|
| `GET /` | — | renders studio |
| `POST /api/generate` | `{prompt, aspect_ratio, style?, negative?, steps?, guidance?, seed?}` | `{url, filename, width, height, seed, valid, status}` (one image) |
| `GET /generated/<file>` | — | serves the saved image |
| `GET /api/history` | — | `{items:[{prompt, url, ratio, style, seed, ts}]}` |
| `POST /api/download-zip` *(bonus)* | `{filenames:[]}` | zip file |

**Validation/edge:** require non-empty prompt; clamp count 1–4 (enforced client+server), steps/guidance to sane ranges; missing token → fail fast; `ImageGenError` → 502 + toast (other images in the batch continue).

---

## 6. Frontend design (Midjourney/Leonardo-style studio)

- **Composer (left):** large **Prompt** textarea; **Style preset chips** (R8); **Aspect-ratio segmented control** with dimension labels "1:1 · 1024×1024 / 16:9 · 1344×768 / 9:16 · 768×1344" (R2); **Count** stepper 1–4; collapsible **Advanced** (negative prompt, guidance scale, steps, seed); **Generate** (gradient).
- **Gallery (right):** responsive grid; while generating, show **skeleton tiles + "Generating {i} of {n}…"**; each finished tile = image, dimensions + seed caption, **Download**, **Regenerate** (same prompt, new seed) (R7), and a **"valid ✓"** QC badge; click → **lightbox**. A subtle **status line** shows reliability events ("model warmed up in 7s", "retried after rate-limit") — this makes the timeout/retry work visible (R4/R5).
- **History sidebar:** recent prompts (click to reuse) (R9); **"Download all (zip)"**.
- **Cold-start UX:** friendly "The free model is warming up (~{X}s). Hang tight — retrying automatically." Never a raw error or infinite spinner.
- States: loading, success, per-tile error, empty state ("Describe an image and hit Generate").

---

## 7. Error handling & reliability (the heart of this project)

`timeout=(3.05, 60)` everywhere (R4); exponential back-off on 429/503 (R5); HF cold-start handled via `estimated_time`; image validated before display (R7); per-image isolation so a batch survives one failure; typed `ImageGenError` → friendly toast; missing token → fail fast; `logging` (never log the token). These are explicitly taught in the PDF — implement them for real and surface them in the status line and README.

---

## 8. Deliverables checklist (acceptance gate)

- [ ] Real images from HF SDXL via API token (R1); clean error without a token.
- [ ] Aspect-ratio (1:1/16:9/9:16 → correct dims) + count (1–4) payloads work (R2).
- [ ] Binary bytes validated, saved, served, displayed cleanly (R3).
- [ ] `timeout=(3.05,60)` on requests (R4); 429/503 back-off 1/2/4/8 s with visible status (R5).
- [ ] Images written to `generated/` in chunks; downloadable (R6); zip export (R9).
- [ ] QC validity badge + Regenerate (R7).
- [ ] Style presets change output (R8); prompt history sidebar (R9).
- [ ] Cold-start handled gracefully (no infinite spinner).
- [ ] README + REQUIREMENTS.md + SCREENSHOT_PLAN.md + .env.example + requirements.txt; runs from README; Render notes; shared design system; responsive.

---

## 9. SCREENSHOT_PLAN.md (contents to generate)

1. **Studio / empty state.** 2. **Generating** (skeletons + "2 of 4"). 3. **Gallery** with 4 results (visible dims/seed). 4. **Aspect-ratio** comparison (1:1 vs 16:9 vs 9:16). 5. **Style preset** effect (same prompt, Cyberpunk vs Minimalism). 6. **Lightbox** view. 7. **Cold-start / retry** status line. 8. History sidebar + zip export.

---

## 10. Future improvements (README section)

CLIP-based **semantic** quality scoring (auto-flag prompt↔image mismatch); image-to-image + inpainting; upscaling; SSE/job-queue for true async batches; provider switch to Stability/Replicate/DALL·E via the same `image_client` contract; gallery persistence in a DB; pair with Week 2 to auto-caption generated images.

---

## 11. MASTER PROMPT FOR SONNET 4.6 — Week 3

> Paste everything in the box into a fresh Sonnet 4.6 (high-effort) session. Self-contained.

```
ROLE
You are a senior Gen-AI application engineer building a portfolio-grade project for the DecodeLabs Generative AI internship (Batch 2026), Week 3. It must look like a real AI image studio (think Midjourney/Leonardo), and a reviewer must verify every requirement at a glance.

NON-NEGOTIABLE PRINCIPLE — THE PDF IS THE CONTRACT
Satisfy 100% of the requirements below, make each VISIBLE, and ship REQUIREMENTS.md mapping each to its feature/file. The PDF explicitly teaches production patterns (timeouts, retry/back-off, streaming save, quality check) — implement them for REAL; they are the grade-winners. Only then add polish.

PROJECT: Multimodal Image Generation Studio
GOAL: Translate natural-language prompts into high-quality images.
REQUIREMENTS (verbatim intent + the PDF's taught patterns):
  R1. Integrate a text-to-image API (we use Hugging Face free Inference API, Stable Diffusion XL).
  R2. Parameter payloads for resolution, ASPECT RATIO, and generation COUNT.
  R3. Handle BINARY image data and display it cleanly.
  R4. TIMEOUTS: separate connect+read timeouts timeout=(3.05, 60) so it never hangs.
  R5. RETRY with EXPONENTIAL BACK-OFF on 429 (and HF 503 "model loading"): 1/2/4/8s; respect HF estimated_time on cold start.
  R6. STREAMING save: write image bytes to disk in chunks (don't hold whole images in RAM).
  R7. QUALITY CHECK: validate the image (decodable + correct dimensions) and offer Regenerate.
  R8. (bonus) STYLE PRESETS (Cyberpunk, Minimalism, Photoreal, Anime, 3D, Oil Painting).
  R9. (bonus) Local asset pipeline + gallery/prompt-history + "Download all (zip)".

LOCKED TECH DECISIONS
- Backend Flask (Python); frontend server-rendered template + vanilla HTML/CSS/JS (NO React, NO Bootstrap default look). Use `requests` + `Pillow`.
- Image API: Hugging Face Inference API, a Stable-Diffusion-XL model (e.g. stabilityai/stable-diffusion-xl-base-1.0). Endpoint https://api-inference.huggingface.co/models/<model>, header Authorization: Bearer HUGGINGFACE_API_TOKEN (from .env via python-dotenv). HF text-to-image returns RAW IMAGE BYTES on success, 503 {error, estimated_time} while the model loads, 429 when rate-limited. VERIFY the current HF inference endpoint/behavior and that the chosen model is available on the free serverless tier at build time.
- Provider abstraction: put all API access in image_client.py exposing generate(payload) -> bytes (raising typed ImageGenError), so a future Stability/Replicate/DALL·E backend fits the same contract. Select via IMAGE_PROVIDER env (default huggingface).

ARCHITECTURE (implement exactly)
- studio.py: ASPECT_RATIOS = {"1:1":(1024,1024), "16:9":(1344,768), "9:16":(768,1344)} (use these EXACT sizes). STYLE_PRESETS dict mapping name -> prompt suffix. build_payload(prompt, ratio, style, negative, steps, guidance, seed) -> HF payload {inputs, parameters:{negative_prompt,width,height,guidance_scale,num_inference_steps,seed}} (comment that some serverless models clamp width/height; fall back to native 1024 if the API rejects custom dims).
- image_client.py: generate(payload) -> bytes. requests.post(url, json=payload, headers, timeout=(3.05,60)). On 429 -> back-off 1/2/4/8s (cap ~4 tries). On 503 -> read estimated_time, wait (bounded), retry, and report "model warmed up in Xs". On other 4xx/parse failure -> raise ImageGenError(friendly msg). Return bytes + a short status string surfaced to the UI.
- storage.py: save_stream(bytes) -> path (write to generated/<timestamp>-<shortid>.png in CHUNKS). validate(path) -> {valid,width,height} via Pillow. log_metadata(record)/recent(limit) using generated/_history.json. zip_selected(filenames) -> zip path.
- app.py routes:
   GET  /                  -> studio
   POST /api/generate       {prompt, aspect_ratio, style?, negative?, steps?, guidance?, seed?} -> ONE image {url, filename, width, height, seed, valid, status}
   GET  /generated/<file>   -> serve saved image
   GET  /api/history        -> {items:[...]}
   POST /api/download-zip    {filenames} -> zip
   Validation: non-empty prompt; clamp steps/guidance; missing token -> fail fast; ImageGenError -> 502 {error}.
- FRONTEND LOOP: the client reads `count` (1–4) and calls /api/generate once per image (increment seed each time), appending each result to the gallery as it arrives with live "Generating {i} of {n}…" progress, so each image is isolated and the gallery fills progressively.

FRONTEND (shared design system — dark, modern, responsive; reuse the SAME static/css/theme.css)
Tokens: --bg #0B0F17, --surface #141A24, --surface-2 #1C2430, --border rgba(255,255,255,.08), --text #E8EDF4, --text-dim #9AA7B8, --brand #6366F1, --brand-2 #A855F7, --accent #22D3EE; radius 14px; Inter UI / JetBrains Mono. Gradient wordmark "DecodeLabs · GenAI Suite"; right label "Week 3 · Image Studio"; footer "Built by Nikhil · DecodeLabs GenAI Internship 2026 · powered by Hugging Face SDXL".
Composer: big Prompt textarea; Style preset chips (R8); aspect-ratio segmented control labeled with dimensions "1:1 · 1024×1024 / 16:9 · 1344×768 / 9:16 · 768×1344" (R2); Count stepper 1–4; collapsible Advanced (negative prompt, guidance, steps, seed); Generate (gradient).
Gallery: responsive grid; skeleton tiles + "Generating {i} of {n}…" while loading; each tile = image + "{w}×{h} · seed {s}" caption + Download + Regenerate (R7) + "valid ✓" badge; click -> lightbox. A subtle status line surfaces reliability events ("model warmed up in 7s", "retried after rate-limit"). History sidebar of recent prompts (click to reuse) + "Download all (zip)". Friendly cold-start message; never an infinite spinner or raw error.

DELIVERABLES (create all)
app.py, image_client.py, storage.py, studio.py, requirements.txt (flask, requests, pillow, python-dotenv, gunicorn — pinned), .env.example (IMAGE_PROVIDER=huggingface, HUGGINGFACE_API_TOKEN=your_token_here), .gitignore (+ generated/), templates/index.html, static/css/theme.css, static/js/app.js, README.md, REQUIREMENTS.md, SCREENSHOT_PLAN.md.
README order: title + pitch, screenshots, Overview, Problem Statement, Solution Architecture (ASCII diagram), Features (R1–R9 checklist; call out timeouts/retry/streaming/QC explicitly), Tech Stack, Folder Structure, Setup, Configuration (how to get a free HF token), Usage, Deployment (Render: gunicorn app:app + env vars; note generated/ is ephemeral on free tier), Requirement Compliance (link REQUIREMENTS.md), Future Improvements (CLIP semantic check, img2img, upscaling), Author (Nikhil).
REQUIREMENTS.md: table mapping R1–R9 to feature/file, all checked.
SCREENSHOT_PLAN.md: empty state, generating progress, full gallery, aspect-ratio comparison, style-preset comparison, lightbox, cold-start/retry status, history+zip.

CODING STANDARDS
Modular files, docstrings, type hints on public funcs, centralized typed errors with friendly messages, python logging (never log the token), input validation per route, pinned requirements. The reliability patterns (R4–R7) must be REAL, not cosmetic.

ACCEPTANCE — self-verify and report:
  [ ] Real SDXL images via HF token; clean error without token.
  [ ] Aspect ratios map to exact dims; count 1–4 works; binary bytes validated/saved/served/displayed.
  [ ] timeout=(3.05,60); 429/503 back-off 1/2/4/8s with visible status; cold-start handled.
  [ ] Chunked save to generated/; per-image + zip download; QC badge + Regenerate.
  [ ] Style presets change output; history sidebar works.
  [ ] All files present; runs from README alone; responsive; matches design tokens.
Output a build summary + filled checklist. Ask before adding any dependency/pattern not listed.
```

---
*End of Week 3. Next: `WEEK-4-CODE-REVIEWER.md` (flagship).*
