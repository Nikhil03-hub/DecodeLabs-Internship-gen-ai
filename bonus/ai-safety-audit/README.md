# 🛡️ AI Safety Audit Tool

> **DecodeLabs Generative AI Internship 2026 · Bonus Project**
> A red-teaming framework that systematically tests an LLM for jailbreaks, harmful content, bias, PII extraction, and prompt injection — then generates a severity-scored audit report.

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-black?logo=flask)](https://flask.palletsprojects.com)
[![Gemini](https://img.shields.io/badge/Gemini-Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev)

---

## Overview

AI safety evaluation is how teams at Anthropic, Google DeepMind, and OpenAI systematically find failure modes in LLMs before they reach users. This project implements a **LLM-as-judge** evaluation loop: one Gemini instance plays the role of the target AI being tested, a second Gemini instance acts as the safety judge, and a curated red-team prompt library drives the evaluation.

---

## How It Works

```
┌─────────────── RED-TEAM LOOP ──────────────────────────────────┐
│ For each prompt in the library:                                 │
│   1. Send prompt to Subject LLM (Gemini Flash, no guardrails)  │
│   2. Send (prompt + response) to Judge LLM                     │
│   3. Judge returns: SAFE / UNSAFE / PARTIAL + severity 0-10    │
│   4. Aggregate into overall safety score                        │
│ Export full audit as Markdown report                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Test Categories (15 prompts)

| Category | Tests | What it checks |
|---|---|---|
| 🔓 Jailbreak | 3 | DAN override, role-play bypass, token smuggling |
| ⚠️ Harmful Content | 3 | Malware, dangerous synthesis, violence glorification |
| ⚖️ Bias & Fairness | 3 | Gender stereotyping, racial bias, political manipulation |
| 🔑 PII Extraction | 2 | Credential phishing, personal data harvesting |
| 💉 Prompt Injection | 2 | Hidden instructions, delimiter confusion |
| ✅ Baseline | 2 | Benign requests that should be answered (not refused) |

---

## Features

- **15 curated red-team prompts** across 6 safety categories
- **LLM-as-judge evaluation** — Gemini scores each response independently
- **Safety score 0–100** with animated ring visualisation
- **Per-result severity bar** (0–10 scale with colour coding)
- **Expandable result cards** showing prompt, response, judge reasoning, and flags
- **Custom prompt tester** — paste any prompt and see the safety verdict live
- **Export report as `.md`** — full audit with all results and verdicts
- **Category filtering** — run only the categories you care about

---

## Quick Start

```bash
cd bonus/ai-safety-audit
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Add your GEMINI_API_KEY to .env
python app.py  # → http://localhost:5005
```

---

## Configuration

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Free at [aistudio.google.com](https://aistudio.google.com/apikey) |
| `FLASK_SECRET_KEY` | No | Auto-generated if unset |
| `PORT` | No | Default 5005 |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 · Flask 3.0 |
| LLM (subject) | Google Gemini Flash |
| LLM (judge) | Google Gemini Flash (separate call) |
| Evaluation | LLM-as-judge with structured JSON verdict |
| Frontend | Vanilla HTML/CSS/JS (shared design system) |

---

## Deployment (Render)

Build: `pip install -r requirements.txt` · Start: `gunicorn app:app` · Set `GEMINI_API_KEY` + `FLASK_SECRET_KEY`.

---

## Author

**Nikhil** · DecodeLabs GenAI Internship 2026 · Powered by Google Gemini
