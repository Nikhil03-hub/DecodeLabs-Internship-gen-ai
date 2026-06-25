# 🔍 RAG Knowledge Analyst

> **DecodeLabs Generative AI Internship 2026 · Bonus Project**
> A Retrieval-Augmented Generation (RAG) pipeline that answers questions from your documents — with source citations showing exactly which passage was used.

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-black?logo=flask)](https://flask.palletsprojects.com)
[![Gemini](https://img.shields.io/badge/Gemini-Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev)

---

## Overview

RAG (Retrieval-Augmented Generation) is the architecture behind enterprise AI assistants like ChatGPT with web search, Notion AI, and GitHub Copilot Chat. Instead of asking an LLM to hallucinate from training data, RAG retrieves the most relevant passages from your documents and feeds them as grounded context to the LLM.

This project implements the complete RAG pipeline in ~300 lines of Python — no LangChain, no vector databases, no black boxes.

---

## How It Works

```
┌─────────────────── INGEST ──────────────────────────────────────┐
│ 1. Parse uploaded text → overlapping chunks (400 chars, 80 overlap)│
│ 2. Embed each chunk via Gemini text-embedding-004               │
│ 3. Store chunks + embeddings in memory (per-session)            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────── QUERY ───────────────────────────────────────┐
│ 1. Embed the user's question with the same model                │
│ 2. Cosine similarity → top-k most relevant chunks               │
│ 3. Gemini Flash synthesises an answer + inline citations [1][2] │
└─────────────────────────────────────────────────────────────────┘
```

---

## Features

- **Chunking:** overlapping sentence-boundary aware splitting
- **Embeddings:** Gemini `text-embedding-004` (768-dim vectors) with TF-IDF fallback
- **Retrieval:** cosine similarity (pure Python, no numpy required)
- **Synthesis:** Gemini Flash constrained to context only — no hallucination
- **Citations:** every answer shows which chunk it came from + relevance %
- **File support:** `.txt`, `.md`, `.py`, `.js`, `.html`, `.csv`, `.rst`
- **Paste mode:** drop text directly without a file
- **Sample documents:** 3 built-in samples to demo instantly

---

## Quick Start

```bash
cd bonus/rag-knowledge-analyst
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Add your GEMINI_API_KEY to .env
python app.py  # → http://localhost:5004
```

---

## Configuration

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Free at [aistudio.google.com](https://aistudio.google.com/apikey) |
| `FLASK_SECRET_KEY` | No | Auto-generated if unset |
| `PORT` | No | Default 5004 |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 · Flask 3.0 |
| Embeddings | Gemini `text-embedding-004` |
| LLM | Google Gemini Flash |
| Similarity | Pure Python cosine similarity |
| Frontend | Vanilla HTML/CSS/JS (shared design system) |

---

## Deployment (Render)

Build: `pip install -r requirements.txt` · Start: `gunicorn app:app` · Set `GEMINI_API_KEY` + `FLASK_SECRET_KEY`.

---

## Author

**Nikhil** · DecodeLabs GenAI Internship 2026 · Powered by Google Gemini
