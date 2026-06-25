# 🧠 Custom AI Chatbot with Memory

> **DecodeLabs Generative AI Internship 2026 · Week 1**
> A conversational web app powered by Google Gemini that **remembers everything you said** — demonstrating real-time in-memory session state management.

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-black?logo=flask)](https://flask.palletsprojects.com)
[![Gemini](https://img.shields.io/badge/Gemini-Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev)
[![License](https://img.shields.io/badge/License-MIT-green)](../LICENSE)

```bash
cd week-1-ai-chatbot-memory
cp .env.example .env   # add GEMINI_API_KEY
python app.py          # → http://localhost:5000
```

---

## Screenshots

> *(Add screenshots here after running the app — see [SCREENSHOT_PLAN.md](SCREENSHOT_PLAN.md))*
>
> Suggested embeds:
> ```md
> ![Empty state](screenshots/01-empty-state.png)
> ![Memory proof](screenshots/03-memory-proof.png)
> ```

---

## Overview

Most LLM API calls are stateless — each request has no memory of the previous one. This project solves that: it wraps Google Gemini with a **server-side in-memory history array**, appending every user message and model reply to a growing list that is sent back to the model on every turn.

The result is a chatbot that genuinely remembers — a key building block of every real AI assistant, copilot, and agent in production today.

---

## Problem Statement

> *"Connect to a frontier LLM using an official SDK, maintain an active in-memory list array of conversation history, and append every new user input + model response to the payload."*
> — DecodeLabs Generative AI Project 1 brief

---

## Solution Architecture

```
┌──────────────────────── BROWSER ──────────────────────────┐
│  Chat window (user/assistant bubbles)  │  Session Memory   │
│                                        │  • live array     │
│  [ message input ........... ] [Send]  │  • N msgs ~T tkns │
│  [ New Chat ]  (typing indicator)      │  • trimmed badge  │
└──────────────────┬──────────────────────────────────────────┘
                   │ POST /api/chat { message }
                   ▼
┌──────────────────────── FLASK (app.py) ───────────────────┐
│  1. Resolve session_id (Flask cookie)                      │
│  2. history = SESSIONS[session_id]   ← in-memory list (R2)│
│  3. append_turn("user", message)                   (R3)   │
│  4. prune_if_needed(history)          ← loop       (R5)   │
│  5. reply = llm_client.generate(history, ...)      (R1/R4)│
│  6. append_turn("model", reply)                    (R3)   │
│  7. return {reply, memory, message_count, est_tokens}      │
└──────────────────┬────────────────────────────────────────┘
                   ▼ google-genai SDK → Gemini Flash
       SESSIONS: dict[session_id → list[Message]]
```

---

## Features

| Feature | PDF Requirement | Status |
|---|---|---|
| Real Gemini API call via official `google-genai` SDK | R1 | ✅ |
| In-memory `SESSIONS` dict of lists (the history array) | R2 | ✅ |
| Append every user + model turn; send full array each call | R3 | ✅ |
| Cross-turn context retention (name/city memory test) | R4 | ✅ |
| Token-limit pruning loop with "context trimmed" badge | R5 *(bonus)* | ✅ |
| Terminal REPL (`chat_cli.py`) with memory readout | R6 *(bonus)* | ✅ |
| Live "Session Memory" panel showing the in-memory array | Portfolio | ✅ |
| Typing indicator, error toasts, responsive UI | Portfolio | ✅ |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 · Flask 3.0 |
| LLM | Google Gemini Flash (`google-genai` SDK) |
| Frontend | Vanilla HTML/CSS/JavaScript |
| Memory | Python in-process `dict[str, list]` |
| Config | `python-dotenv` |
| Deploy | Gunicorn / Render |

---

## Folder Structure

```
week-1-ai-chatbot-memory/
├── app.py               Flask routes + session orchestration
├── llm_client.py        Gemini provider abstraction (reused in Wk 2 & 4)
├── memory.py            SESSIONS store, append, estimate_tokens, prune
├── chat_cli.py          Bonus terminal REPL
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
├── REQUIREMENTS.md      PDF requirement → feature traceability
├── SCREENSHOT_PLAN.md
├── templates/index.html
└── static/
    ├── css/theme.css    Shared dark design system
    ├── css/chat.css     Week 1 specific overrides
    └── js/app.js        Chat UI + memory panel logic
```

---

## Setup (Local)

**Prerequisites:** Python 3.11+, a free Google Gemini API key.

```bash
# 1. Navigate to this folder
cd week-1-ai-chatbot-memory

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
# → http://localhost:5000
```

---

## Configuration

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Free at [aistudio.google.com](https://aistudio.google.com/apikey) |
| `LLM_PROVIDER` | No | `gemini` (default) |
| `GEMINI_MODEL` | No | Default: `gemini-2.0-flash` |
| `FLASK_DEBUG` | No | `true` for development |
| `FLASK_SECRET_KEY` | No | Auto-generated if unset |

---

## Usage

1. **Chat** — Type any message and press Enter (or click Send).
2. **Memory panel** — Watch the live array on the right grow with every exchange.
3. **Memory test** — Click "Run memory test" to prove cross-turn context retention.
4. **New Chat** — Clears the history and starts fresh.
5. **CLI** — `python chat_cli.py` for a terminal experience.

---

## Deployment (Render)

1. Push this folder to a GitHub repo.
2. Create a new **Web Service** on [Render](https://render.com).
3. **Build command:** `pip install -r requirements.txt`
4. **Start command:** `gunicorn app:app`
5. Add `GEMINI_API_KEY` as an Environment Variable in the Render dashboard.
6. Deploy — free tier cold-starts may add ~30s on first request.

> Same pattern works on **Railway** or **Hugging Face Spaces** (Gradio/Docker).

---

## Requirement Compliance

See [REQUIREMENTS.md](REQUIREMENTS.md) for a table mapping every PDF requirement to the exact file and feature that satisfies it.

---

## Future Improvements

- Replace token heuristic (`chars/4`) with the SDK's exact `count_tokens()` call
- Streaming responses via Server-Sent Events (SSE) for word-by-word display
- Optional Redis-backed session store for multi-instance / serverless deploys
- Export conversation transcript as Markdown or PDF
- System-prompt selector to switch personas
- Provider switch to OpenAI/Anthropic via the same `llm_client` contract

---

## Author

**Nikhil** · DecodeLabs Generative AI Internship 2026
[GitHub](https://github.com/Nikhil03-hub) · Powered by Google Gemini
