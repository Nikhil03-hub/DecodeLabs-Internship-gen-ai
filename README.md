# 🤖 DecodeLabs GenAI Suite

> **Internship Submission — Batch 2026 | Nikhil**
> A 4-week AI engineering portfolio built with Flask · Google Gemini · Hugging Face — plus 2 bonus projects.

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-black?logo=flask)](https://flask.palletsprojects.com)
[![Gemini](https://img.shields.io/badge/Gemini-Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev)
[![HuggingFace](https://img.shields.io/badge/HuggingFace-SDXL-FFD21E?logo=huggingface&logoColor=black)](https://huggingface.co)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## Projects

| | Week | Project | Core Tech | Port |
|--|------|---------|-----------|------|
| 🧠 | [Week 1](./week-1-ai-chatbot-memory/) | AI Chatbot with Persistent Memory | Flask · Gemini | 5000 |
| ✍️ | [Week 2](./week-2-copywriting-tone-transformer/) | Copywriting & Tone Transformer | Flask · Gemini | 5001 |
| 🎨 | [Week 3](./week-3-image-generation-studio/) | Multimodal Image Generation Studio | Flask · HF SDXL | 5002 |
| 🔬 | [Week 4 ★](./week-4-intelligent-code-reviewer/) | Intelligent AI Code Reviewer *(Flagship)* | Flask · Gemini · Monaco | 5003 |
| 🔍 | [Bonus: RAG](./bonus/rag-knowledge-analyst/) | RAG Knowledge Analyst | Flask · Gemini Embeddings | 5004 |
| 🛡️ | [Bonus: Safety](./bonus/ai-safety-audit/) | AI Safety Audit Tool | Flask · Gemini | 5005 |

---

## Week 1 — AI Chatbot with Persistent Memory

An intelligent chatbot that maintains a live in-memory conversation history across turns using a server-side session array.

**Key features:** In-memory `SESSIONS` dict (the required history array) · context pruning at 6 000 token budget · live memory panel showing the session array and token estimate · "Run memory test" button proves cross-turn retention · Terminal REPL (`chat_cli.py`) with `/reset`, `/history`, `/exit`.

```bash
cd week-1-ai-chatbot-memory && python app.py   # → http://localhost:5000
```

---

## Week 2 — Copywriting & Tone Transformer

Dynamic marketing copy generator with platform-specific prompt compilation and visible template engineering.

**Key features:** `prompt_compiler.py` assembles platform + tone variables into a compiled template · Compiled Prompt Inspector (collapsible, shows the exact prompt before sending) · Temperature + Top-P sliders wired directly into Gemini generation config · 4 variations per run · char meter validates against platform limits (LinkedIn 3000, Twitter 280…) · "Compare Temperatures" modal runs the same prompt at 0.2 / 0.7 / 1.0 simultaneously.

```bash
cd week-2-copywriting-tone-transformer && python app.py   # → http://localhost:5001
```

---

## Week 3 — Multimodal Image Generation Studio

Midjourney-style AI image studio using Hugging Face Stable Diffusion XL with full production reliability patterns.

**Key features:** 3 aspect ratios (1:1 / 16:9 / 9:16) · 7 style presets appended to prompt · batch generation 1–4 · `timeout=(3.05, 60)` + exponential back-off 1/2/4/8s on 429/503 · 503 model-load wait loop · chunked streaming save (8 KB) + Pillow QC · gallery with lightbox · per-image download + zip export.

```bash
cd week-3-image-generation-studio && python app.py   # → http://localhost:5002
```

---

## Week 4 ★ — Intelligent Code Reviewer (Flagship)

Enterprise-grade AI code reviewer with VS Code's Monaco editor, structured JSON schema validation, animated score ring, and a side-by-side diff view.

**Key features:** Monaco Editor embedded · drag-drop file upload or paste · Gemini reviews for security / logic / performance / style · strict JSON schema with `validate_output()` + automatic repair retry · score ring 0–100 with animated count-up · bug cards filterable by severity (Critical → Info) · Monaco DiffEditor (original vs AI-refactored side-by-side) · language auto-detection (extension → shebang → heuristic) · export full review as `.md`.

```bash
cd week-4-intelligent-code-reviewer && python app.py   # → http://localhost:5003
```

---

## Bonus Projects

### 🔍 RAG Knowledge Analyst

A complete Retrieval-Augmented Generation pipeline — upload any document, ask questions, get cited answers. Uses Gemini `text-embedding-004` for semantic search with no external vector database required.

```bash
cd bonus/rag-knowledge-analyst && python app.py   # → http://localhost:5004
```

### 🛡️ AI Safety Audit Tool

A red-teaming framework that runs 15 curated safety prompts (jailbreak, harmful content, bias, PII extraction, prompt injection) against Gemini and uses an LLM-as-judge to score each response. Generates a severity-scored audit report with export.

```bash
cd bonus/ai-safety-audit && python app.py   # → http://localhost:5005
```

---

## Shared Architecture

All 6 projects share a consistent design system and provider abstraction:

- **`theme.css`** — identical dark design system across all projects: dot-grid background, border beam, shimmer button, spotlight hover, blur-fade reveal, skeleton loader, shared CSS tokens (`--bg #0B0F17`, `--brand #6366F1`, `--brand-2 #A855F7`, `--accent #22D3EE`)
- **`llm_client.py`** — shared Gemini abstraction: `generate(messages, *, temperature, top_p, max_output_tokens)` with retry + typed errors (Weeks 1/2/4 + both bonus)

---

## Setup (any project)

```bash
cd week-X-project-name     # or bonus/project-name

# Create & activate virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure API keys
cp .env.example .env       # then edit .env with your keys

# Run
python app.py
```

**API Keys:**

| Project | Key needed | Where to get it |
|---|---|---|
| Weeks 1, 2, 4 + Bonus | `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/app/apikey) — free |
| Week 3 | `HUGGINGFACE_API_TOKEN` | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) — free |

---

## Repository Structure

```
DecodeLabs-GenAI/
├── README.md                              ← This file (portfolio landing page)
├── LICENSE
├── .gitignore                             ← .env, venv, __pycache__, generated/
│
├── week-1-ai-chatbot-memory/              ← Flask · Gemini · port 5000
├── week-2-copywriting-tone-transformer/   ← Flask · Gemini · port 5001
├── week-3-image-generation-studio/        ← Flask · HF SDXL · port 5002
├── week-4-intelligent-code-reviewer/      ← Flask · Gemini · Monaco · port 5003
│
└── bonus/
    ├── rag-knowledge-analyst/             ← RAG pipeline · Gemini embeddings · port 5004
    └── ai-safety-audit/                   ← Red-team framework · LLM-as-judge · port 5005
```

---

## Deployment

Every project is independently deployable on [Render](https://render.com) (free tier):

- **Build command:** `pip install -r requirements.txt`
- **Start command:** `gunicorn app:app`
- **Env vars:** `GEMINI_API_KEY` (or `HUGGINGFACE_API_TOKEN` for Week 3) + `FLASK_SECRET_KEY`

Same pattern works on **Railway** or **Hugging Face Spaces** (Docker/Gradio).

---

*Built with care for DecodeLabs GenAI Internship 2026 · Batch 2026 · Nikhil*
