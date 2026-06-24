# Week 3 Requirements Traceability

| # | PDF Requirement | Implementation | File | How to Verify |
|---|---|---|---|---|
| R1 | Integrate Hugging Face Inference API (SDXL) | `generate()` POSTs to `api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0` | `image_client.py` | Watch network tab; HF token in `.env` |
| R2 | Aspect ratio + count selection in payload | `build_payload()` maps 1:1→1024×1024, 16:9→1344×768, 9:16→768×1344; count loop in `app.js` | `studio.py`, `app.js` | Change ratio; inspect request payload |
| R3 | Binary image bytes downloaded and served | `generate()` returns `response.content`; `send_from_directory` serves files | `image_client.py`, `app.py` | Image appears in gallery; check `generated/` folder |
| R4 | `timeout=(3.05, 60)` connect+read timeouts | `_TIMEOUT = (3.05, 60)` passed to every `requests.post()` | `image_client.py` line 27 | Code review; kill internet mid-request |
| R5 | Retry + exponential back-off 1/2/4/8s | 429 → backoff; 503 "loading" → wait `estimated_time`; network err → backoff | `image_client.py` lines 83-167 | Trigger 429 with burst; see status line |
| R6 | Chunked streaming save to `generated/` | `save_stream()` uses `io.BytesIO` + 8192-byte chunks | `storage.py` lines 33-59 | Code review; file appears in `generated/` |
| R7 | Pillow QC validation + Regenerate button | `validate()` opens with Pillow, checks decodable; Regenerate on each tile | `storage.py`, `index.html` | Click Regenerate; invalid images show ⚠ |
| R8 | Style presets applied to prompt | `STYLE_PRESETS` appended to prompt in `build_payload()` | `studio.py` | Select "Cyberpunk"; see augmented prompt in payload |
| R9 | History log + zip export | `log_metadata()` → `_history.json`; `/api/history`; `/api/download-zip` | `storage.py`, `app.py`, `app.js` | History sidebar updates; Download all zip |
