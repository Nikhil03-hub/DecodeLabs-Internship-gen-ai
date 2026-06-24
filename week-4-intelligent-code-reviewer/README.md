# Week 4 — Intelligent AI Code Reviewer (Flagship)

> DecodeLabs GenAI Internship 2026 | Nikhil

An enterprise-grade AI code reviewer powered by Google Gemini. Detects security vulnerabilities, logic bugs, performance issues, and generates a complete refactored version of your code.

## Features

- **Monaco Editor** — VS Code's editor embedded in the browser (paste or type)
- **File Upload** — drag-drop any source file (.py, .js, .ts, .java, .go, .rs, .cpp, and more)
- **AI Review** — Gemini analyzes for security, logic, performance, and style issues
- **Structured JSON output** — strict schema with validation + automatic repair retry
- **Quality Score** — 0–100 score with animated ring visualization
- **Bug Cards** — filterable by severity (Critical / High / Medium / Low / Info)
- **Refactored Code** — complete AI-rewritten version in Monaco editor
- **Diff View** — Monaco DiffEditor: original vs refactored side-by-side
- **Language detection** — auto-detects from extension → shebang → heuristics
- **Export** — download full review as `.md` file

## Quick Start

```bash
cd week-4-intelligent-code-reviewer
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — add your Gemini API key from https://aistudio.google.com/app/apikey
python app.py  # → http://localhost:5003
```

## Try the Samples

Load any of the provided buggy samples to see the reviewer in action:

- `samples/buggy.py` — SQL injection, eval(), bare except, MD5 passwords, O(n²) algorithm
- `samples/buggy.js` — XSS, prototype pollution, var hoisting, unhandled promises
- `samples/buggy.java` — String ==, NPE risk, resource leaks, hardcoded credentials

## Deploy to Render

1. Create new **Web Service**, point to this folder
2. Build: `pip install -r requirements.txt`
3. Start: `gunicorn app:app`
4. Env vars: `GEMINI_API_KEY`, `FLASK_SECRET_KEY`

## PDF Requirements

See [REQUIREMENTS.md](REQUIREMENTS.md) for full R1–R10 traceability.
