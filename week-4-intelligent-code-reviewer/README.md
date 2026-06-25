# 🔬 Intelligent AI Code Reviewer (Flagship)

> **DecodeLabs Generative AI Internship 2026 · Week 4**
> An enterprise-grade AI code reviewer with Monaco editor, structured JSON output, animated score ring, diff view, and export — powered by Google Gemini.

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-black?logo=flask)](https://flask.palletsprojects.com)
[![Gemini](https://img.shields.io/badge/Gemini-Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev)
[![Monaco](https://img.shields.io/badge/Monaco-Editor-0078D4?logo=visualstudiocode&logoColor=white)](https://microsoft.github.io/monaco-editor/)
[![License](https://img.shields.io/badge/License-MIT-green)](../LICENSE)

```bash
cd week-4-intelligent-code-reviewer
cp .env.example .env   # add GEMINI_API_KEY
python app.py          # → http://localhost:5003
```

---

## Screenshots

> *(Add screenshots after running — embed here for portfolio)*
> ```md
> ![Empty state](screenshots/01-empty.png)
> ![Analysis in progress](screenshots/02-analyzing.png)
> ![Results with score ring](screenshots/03-results.png)
> ![Diff view](screenshots/04-diff.png)
> ```

---

## Overview

A production-quality code review tool: paste or upload any source file, click Analyze, and get a structured report with a quality score, severity-filtered bug cards, and a complete AI-refactored version of the code in a Monaco diff editor. Everything is backed by a strict JSON schema with validation and a self-healing repair retry.

---

## Problem Statement

> *"Ingest a raw code file (.py / .js / .java) as a string. Use system instructions to force structured output: a distinct bug_report list and an optimised code block. Render with markdown syntax highlighting."*
> — DecodeLabs Generative AI Project 4 brief

---

## Solution Architecture

```
┌──────── BROWSER ────────────────────────────────────────────┐
│ Monaco Editor (paste) │ Drag-drop upload                    │
│ Language chips · Sample loaders (buggy.py / .js / .java)   │
│                                                             │
│ Results:                                                    │
│  Score ring (0–100) + summary                               │
│  Bug cards — filterable by Critical/High/Medium/Low/Info    │
│  Monaco: fixed code tab + diff view (original vs refactored)│
│  Export .md · Re-analyze                                    │
└─────────────────────┬───────────────────────────────────────┘
                      │ POST /api/review-text  or  /api/review
                      ▼
┌──────── FLASK (app.py) ────────────────────────────────────┐
│ ingest.py  → validate + detect language (ext→shebang→heur)│
│ analyzer.py → build user_msg + system_prompt        (R2)  │
│            → generate(messages, max_output_tokens=16384)   │
│            → _extract_json()                        (R3)  │
│            → validate_output()  ← requires bug_report      │
│                                   + refactored_code  (R3) │
│            → repair retry if invalid                (R4)  │
│            → _normalise() + _stats                  (R5)  │
│ return structured JSON                                     │
└──────── Gemini Flash ───────────────────────────────────────┘
```

---

## Features

| Feature | PDF Req | Status |
|---|---|---|
| Ingest code as string (paste or file upload) | R1 | ✅ |
| System prompt forces structured JSON output | R2 | ✅ |
| `bug_report` list — severity / line / category / suggestion | R3 | ✅ |
| `refactored_code` — complete fixed version | R3 | ✅ |
| `validate_output()` + automatic repair retry | R4 | ✅ |
| Quality score 0–100 + per-severity counts | R5 | ✅ |
| Language auto-detection (extension → shebang → heuristic) | R6 | ✅ |
| Monaco Editor — VS Code's editor in the browser | *(bonus)* | ✅ |
| Monaco DiffEditor — original vs refactored side-by-side | *(bonus)* | ✅ |
| Animated score ring with count-up | *(bonus)* | ✅ |
| Bug cards filterable by severity | *(bonus)* | ✅ |
| Export full review as `.md` report | *(bonus)* | ✅ |
| Sample files: buggy.py / buggy.js / buggy.java | *(bonus)* | ✅ |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 · Flask 3.0 |
| LLM | Google Gemini Flash (`google-genai` SDK) |
| Code editor | Monaco Editor (VS Code's editor, loaded via CDN) |
| JSON validation | Custom schema validator + repair retry |
| Frontend | Vanilla HTML/CSS/JS |
| Config | `python-dotenv` |

---

## Folder Structure

```
week-4-intelligent-code-reviewer/
├── app.py               Flask routes
├── analyzer.py          AI review engine — prompt, parse, validate, retry
├── ingest.py            File validation + language detection
├── llm_client.py        Gemini provider abstraction
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
├── REQUIREMENTS.md
├── samples/
│   ├── buggy.py         SQL injection · eval() · bare except · MD5 · O(n²)
│   ├── buggy.js         XSS · prototype pollution · var hoisting · unhandled promises
│   └── buggy.java       String == · NPE · resource leaks · hardcoded credentials
├── templates/index.html
└── static/
    ├── css/theme.css    Shared dark design system
    └── js/app.js        Monaco integration + results rendering
```

---

## Setup (Local)

**Prerequisites:** Python 3.11+, a free Google Gemini API key.

```bash
# 1. Navigate to this folder
cd week-4-intelligent-code-reviewer

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
# → http://localhost:5003
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

1. **Paste code** in the Monaco editor — or switch to Upload tab to drag-drop a file.
2. **Load a sample** using the "Load buggy.py / .js / .java" buttons for instant demos.
3. **Select language** with the chips, or leave on Auto for automatic detection.
4. **Click Analyze Code** — the overlay shows real-time step progress.
5. **Review the score** — the animated ring shows 0–100 quality score with colour coding.
6. **Filter bug cards** — click Critical / High / Medium / Low / Info chips to focus.
7. **Switch tabs** — Fixed Code shows the refactored version; Diff shows what changed.
8. **Export** — download the full review as a Markdown report.

---

## Deployment (Render)

1. Push this folder to a GitHub repo.
2. Create a new **Web Service** on [Render](https://render.com).
3. **Build command:** `pip install -r requirements.txt`
4. **Start command:** `gunicorn app:app`
5. Add `GEMINI_API_KEY` and `FLASK_SECRET_KEY` as Environment Variables.
6. Same pattern works on Railway or Hugging Face Spaces.

---

## Requirement Compliance

See [REQUIREMENTS.md](REQUIREMENTS.md) for the full PDF requirement → feature traceability table.

---

## Future Improvements

- Streaming review output — bug cards appear one by one as Gemini generates
- PR diff mode — paste a GitHub PR diff and review only changed lines
- Severity trend chart — track score improvement over multiple reviews
- CI/CD integration — GitHub Action that fails the build if score drops below threshold
- Multi-file review — zip upload and review across a whole module

---

## Author

**Nikhil** · DecodeLabs Generative AI Internship 2026
[GitHub](https://github.com/Nikhil03-hub) · Powered by Google Gemini · Monaco Editor
