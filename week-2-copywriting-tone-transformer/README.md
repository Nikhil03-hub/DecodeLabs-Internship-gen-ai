# ✍️ Automated Copywriting & Tone Transformer

> **DecodeLabs Generative AI Internship 2026 · Week 2**
> A marketing dashboard that generates platform-tailored copy from a product description — with real-time temperature/Top-P control and a visible dynamic prompt template.

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-black?logo=flask)](https://flask.palletsprojects.com)
[![Gemini](https://img.shields.io/badge/Gemini-Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev)
[![License](https://img.shields.io/badge/License-MIT-green)](../LICENSE)

```bash
cd week-2-copywriting-tone-transformer
cp .env.example .env   # add GEMINI_API_KEY
python app.py          # → http://localhost:5001
```

---

## Screenshots

> *(Add screenshots after running — embed here for portfolio)*
> ```md
> ![Dashboard](screenshots/01-dashboard.png)
> ![Generated copy](screenshots/02-generated.png)
> ![Compare temperatures](screenshots/03-compare.png)
> ```

---

## Overview

Enter a product name and description, choose a platform (LinkedIn, Instagram, Email, Twitter/X) and a tone, adjust Temperature and Top-P, and watch the AI generate platform-native marketing copy — complete with character meters, a visible compiled prompt, and a side-by-side temperature comparison.

The core insight: most copy tools treat the LLM as a black box. This project makes the prompt engineering *visible* — you can see the exact prompt template that gets assembled before every generation call.

---

## Problem Statement

> *"Take a product_name, platform, and tone as inputs. Inject them into a dynamic prompt template. Expose Temperature and Top-P controls. Generate platform-tailored marketing copy."*
> — DecodeLabs Generative AI Project 2 brief

---

## Solution Architecture

```
┌──────── BROWSER (marketing dashboard) ─────────────────────┐
│ Inputs: Name / Description / Platform / Tone / Temp / Top-P │
│ ↓ Generate                                                   │
│ "Compiled Prompt" inspector (the assembled template)         │
│ Variation cards with live char meters                        │
│ "Compare Temperatures" 3-column modal (0.2 / 0.7 / 1.0)    │
└───────────────────────┬────────────────────────────────────┘
                        │ POST /api/generate
                        ▼
┌──────── FLASK (app.py) ────────────────────────────────────┐
│ 1. validate inputs                                          │
│ 2. prompt = prompt_compiler.compile(vars, spec, tone) (R2) │
│ 3. raw = llm_client.generate(prompt, temp, top_p)    (R3)  │
│ 4. variations = parse_structured(raw)                (R4)  │
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
| Platform-tailored output (LinkedIn ≠ Instagram ≠ Email ≠ Twitter) | R4 | ✅ |
| Length validation + live char meter (green/amber/red) | R5 *(bonus)* | ✅ |
| Compare temperatures (0.2 / 0.7 / 1.0 side by side) | R6 *(bonus)* | ✅ |
| 1–4 variations + Copy all + Download Markdown | R7 *(bonus)* | ✅ |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 · Flask 3.0 |
| LLM | Google Gemini Flash (`google-genai` SDK) |
| Prompt assembly | `prompt_compiler.py` — template + variable injection |
| Frontend | Vanilla HTML/CSS/JS |
| Config | `python-dotenv` |

---

## Folder Structure

```
week-2-copywriting-tone-transformer/
├── app.py               Flask routes + generation orchestration
├── prompt_compiler.py   Dynamic template assembly (R2 core)
├── llm_client.py        Gemini provider abstraction (shared with Wk 1 & 4)
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
├── REQUIREMENTS.md      PDF requirement → feature traceability
├── templates/index.html
└── static/
    ├── css/theme.css    Shared dark design system
    └── js/app.js        Dashboard logic + sliders + chips
```

---

## Setup (Local)

**Prerequisites:** Python 3.11+, a free Google Gemini API key.

```bash
# 1. Navigate to this folder
cd week-2-copywriting-tone-transformer

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Open .env and set GEMINI_API_KEY=your_key_here

# 5. Run
python app.py

# 6. Open in browser
# → http://localhost:5001
```

---

## Configuration

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Free at [aistudio.google.com](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | No | Default: `gemini-2.0-flash` |
| `FLASK_DEBUG` | No | `true` for development |
| `FLASK_SECRET_KEY` | No | Auto-generated if unset |

---

## Usage

1. **Enter product details** — name and description in the left panel.
2. **Choose platform** — LinkedIn, Instagram, Email, or Twitter/X chip.
3. **Choose tone** — Professional, Casual, Urgent, Inspirational, or Playful.
4. **Adjust sliders** — Temperature (creativity) and Top-P (diversity) control output style.
5. **Generate** — set N variations and click Generate.
6. **Inspect the prompt** — expand "Compiled Prompt" to see exactly what was sent to Gemini.
7. **Compare temperatures** — click Compare to see the same prompt at 0.2/0.7/1.0 side by side.
8. **Export** — copy individual variations or download all as a Markdown file.

---

## Deployment (Render)

1. Push this folder to a GitHub repo.
2. Create a new **Web Service** on [Render](https://render.com).
3. **Build command:** `pip install -r requirements.txt`
4. **Start command:** `gunicorn app:app`
5. Add `GEMINI_API_KEY` as an Environment Variable.
6. Deploy — same pattern works on Railway or Hugging Face Spaces.

---

## Requirement Compliance

See [REQUIREMENTS.md](REQUIREMENTS.md) for the full PDF requirement → feature traceability table.

---

## Future Improvements

- A/B test two tones against each other automatically
- Save favourite variations to a library (localStorage or SQLite)
- SEO score overlay per variation
- Streaming output — text appears word-by-word
- Brand voice fingerprinting — upload a sample to match style

---

## Author

**Nikhil** · DecodeLabs Generative AI Internship 2026
[GitHub](https://github.com/Nikhil03-hub) · Powered by Google Gemini
