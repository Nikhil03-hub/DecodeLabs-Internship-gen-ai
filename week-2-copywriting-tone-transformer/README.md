# ✍️ Automated Copywriting & Tone Transformer

> **DecodeLabs Generative AI Internship 2026 · Week 2**
> A marketing dashboard that generates platform-tailored copy from a product description — with real-time temperature/Top-P control and a visible dynamic prompt template.

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-black?logo=flask)](https://flask.palletsprojects.com)
[![Gemini](https://img.shields.io/badge/Gemini-Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev)

---

## Overview

Enter a product name and description, choose a platform (LinkedIn, Instagram, Email, Twitter/X) and a tone, adjust Temperature and Top-P, and watch the AI generate platform-native marketing copy — complete with character meters, a visible compiled prompt, and a temperature-comparison demo.

---

## Solution Architecture

```
┌──────── BROWSER (marketing dashboard) ─────────────────────┐
│ Inputs: Name / Description / Platform / Tone / Temp / Top-P│
│ ↓ Generate                                                   │
│ "Compiled Prompt" inspector (the exact dynamic template)    │
│ Variation cards with live char meters                        │
│ "Compare temperatures" 3-column modal                       │
└───────────────────────┬────────────────────────────────────┘
                        │ POST /api/generate
                        ▼
┌──────── FLASK (app.py) ────────────────────────────────────┐
│ 1. validate inputs                                          │
│ 2. prompt = prompt_compiler.compile(vars, spec, tone) (R2) │
│ 3. raw = llm_client.generate(prompt, temp, top_p)    (R3)  │
│ 4. variations = parse_structured(raw)                 (R4)  │
│ 5. validate_length(v, char_limit)                    (R5)  │
│ 6. return { compiled_prompt, variations[] }                 │
└──────── Gemini Flash ───────────────────────────────────────┘
```

---

## Features

| Feature | PDF Req | Status |
|---|---|---|
| Product_Name + Platform + Tone inputs | R1 | ✅ |
| Dynamic string template — compiled & shown in UI | R2 | ✅ |
| Temperature + Top-P sliders → Gemini config | R3 | ✅ |
| Platform-tailored output (LinkedIn ≠ Instagram) | R4 | ✅ |
| Length validation + live char meter (R, A, G) | R5 *(bonus)* | ✅ |
| Compare temperatures (0.2 / 0.7 / 1.0 side by side) | R6 *(bonus)* | ✅ |
| 1–4 variations + Copy all + Download .md | R7 *(bonus)* | ✅ |

---

## Setup

```bash
cd week-2-copywriting-tone-transformer
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # add GEMINI_API_KEY
python app.py            # → http://localhost:5001
```

---

## Deployment (Render)

Build: `pip install -r requirements.txt` · Start: `gunicorn app:app` · Set `GEMINI_API_KEY` env var.

---

## Author

**Nikhil** · DecodeLabs GenAI Internship 2026 · Powered by Google Gemini
