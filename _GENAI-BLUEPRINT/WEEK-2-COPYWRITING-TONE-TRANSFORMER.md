# Week 2 — Automated Copywriting & Tone Transformer

**DecodeLabs Gen AI · Project 2** · Status: **REQUIRED** · Folder: `week-2-copywriting-tone-transformer/`
**Stack:** Flask + vanilla JS · Gemini (free) via `google-genai` · shared design system.
> Read `00-MASTER-ARCHITECTURE.md` first. This file = full design + the copy-paste Sonnet master prompt (bottom).

---

## 1. The contract — verbatim from the PDF

> **Goal:** An application that takes a raw product description and **automatically generates professional marketing copy tailored to different platforms.**
>
> **Key Requirements:**
> 1. A Python script that takes user variables like **Product_Name, Platform (LinkedIn, Instagram, Email), and Tone**.
> 2. **Inject those variables into a dynamic string template** passed to the generative model.
> 3. **Handle system parameters like Temperature and Top_P** to control creativity.
>
> **Key Skills:** Dynamic prompt-template compilation, inference-parameter tuning, text generation.
>
> **Conclusion / bonus ideas:** test how high Temperature affects brand consistency on LinkedIn vs Instagram; implement **strict length-validation constraints for character-limited platforms.**

**Plain reading:** this project is about *programmatic control of generation*. The headline skills are (a) compiling a **dynamic prompt template** from user variables and (b) **tuning inference parameters** (Temperature, Top-P). Both must be **visible and adjustable** in the UI, and the platform-tailoring + length rules must be real.

---

## 2. Requirement → feature traceability (becomes `REQUIREMENTS.md`)

| # | PDF requirement | How it's satisfied | Where reviewer sees it |
|---|---|---|---|
| R1 | Inputs: Product_Name, Platform, Tone (+ description) | Form fields: Product Name, Product Description, Platform select, Tone select | Left input panel |
| R2 | Inject variables into a **dynamic string template** | `prompt_compiler.py` assembles system + variable injection + platform + tone + format blocks at request time | **"Compiled Prompt" inspector** shows the exact assembled prompt |
| R3 | Handle **Temperature** and **Top-P** | Sliders bound to the SDK generation config, passed through `llm_client.generate(...)` | Two labeled sliders with live values |
| R4 | Platform-tailored marketing copy | Per-platform spec (voice, structure, hashtags, char limit) drives the template + post-validation | Results differ by platform; platform badge on each card |
| R5 (bonus) | **Strict length validation** for char-limited platforms | Each variation validated vs platform limit; live char meter; over-limit flagged + auto-fix/regenerate option | Char meter (green/amber/red) per card |
| R6 (bonus) | Temperature-effect demonstration | "Compare temperatures" runs the same input at low/med/high temp side-by-side | Comparison view |
| R7 (bonus) | Multiple variations + export | N variations (1–4); copy-to-clipboard + download `.md`/`.txt` | Variation cards + export buttons |

---

## 3. End-to-end architecture

```
┌──────────────────────── BROWSER (marketing dashboard) ────────────────────────┐
│  INPUTS                              │   RESULTS                                │
│  • Product Name                      │   • Variation cards (copy + char meter)  │
│  • Product Description (textarea)    │   • per-card: copy / regenerate          │
│  • Platform [LinkedIn▾]              │   • "Compiled Prompt" inspector (R2)     │
│  • Tone [Luxury▾]                    │   • Export (copy all / download .md)     │
│  • Temperature ●──── 0.7  (R3)       │   • "Compare temperatures" (R6)          │
│  • Top-P       ●──── 0.95 (R3)       │                                          │
│  • Variations  [3]      [Generate]   │                                          │
└───────────────┬───────────────────────────────────────────────────────────────┘
                │ POST /api/generate { product_name, description, platform, tone, temperature, top_p, n }
                ▼
┌──────────────────────── FLASK BACKEND (app.py) ───────────────────────────────┐
│ 1. validate inputs                                                             │
│ 2. spec = PLATFORMS[platform]                  (voice, structure, char_limit)  │
│ 3. prompt = prompt_compiler.compile(vars, spec, tone)   ← DYNAMIC TEMPLATE (R2)│
│ 4. raw = llm_client.generate(prompt, temperature, top_p, ...)   (R3, text gen) │
│ 5. variations = parse_structured(raw)          (JSON array / delimited)        │
│ 6. for v: validate_length(v, spec.char_limit)  ← length rules (R5)             │
│ 7. return { compiled_prompt, variations:[{text, char_count, within_limit}],    │
│             platform_limit, platform, tone }                                   │
└───────────────┬───────────────────────────────────────────────────────────────┘
                ▼  llm_client.generate(...)  → Gemini (official google-genai SDK)
```

---

## 4. Folder structure

```
week-2-copywriting-tone-transformer/
├── app.py                 # Flask routes + orchestration
├── llm_client.py          # shared Gemini provider abstraction (temperature/top_p)
├── prompt_compiler.py     # PLATFORMS spec, TONES, compile(), parse_structured(), validate_length()
├── requirements.txt
├── .env.example           # LLM_PROVIDER, GEMINI_API_KEY
├── .gitignore
├── README.md
├── REQUIREMENTS.md
├── SCREENSHOT_PLAN.md
├── templates/index.html
├── static/css/theme.css   # shared design system
├── static/js/app.js
└── screenshots/
```

---

## 5. Backend design (contracts, not code)

**`prompt_compiler.py`**
- `PLATFORMS: dict` — each platform's spec:
  | Platform | char_limit | structure | voice notes |
  |---|---|---|---|
  | LinkedIn | 3000 | hook → value → CTA; 3–5 hashtags | professional, credible, first-person |
  | Instagram | 2200 | punchy caption + emoji + up to ~15 hashtags | vivid, energetic, visual |
  | Email | subject ≤ 60 + body | subject line + short body + CTA | clear, persuasive, scannable |
  | Twitter/X *(bonus)* | 280 | one sharp line + ≤2 hashtags | concise, witty |
- `TONES = [Professional, Friendly, Witty, Luxury, Bold, Inspirational, Minimalist]` (each with a one-line style directive injected into the template).
- `compile(vars, spec, tone) -> str` — assembles a **dynamic string template**: system role (expert marketing copywriter) + injected `{product_name}`/`{description}` + platform block (`{structure}`, `{char_limit}`, hashtag rules) + tone directive + **output-format instruction** (return a JSON array of `n` variations; Email items as `{subject, body}`). Return the final compiled string (this exact string is surfaced to the UI for R2).
- `parse_structured(raw) -> list[Variation]` — tolerant: strip code fences, `json.loads`; on failure, fall back to splitting on a delimiter or returning the whole text as one variation (never crash).
- `validate_length(text, char_limit) -> {char_count, within_limit, over_by}` — the length-validation rule (R5).

**`llm_client.py`** — shared (Master §7). The **Temperature** and **Top-P** from the request flow straight into the Gemini generation config via `generate(prompt, temperature=, top_p=, max_output_tokens=)`.

**`app.py` routes:**

| Method · Path | Request | Response |
|---|---|---|
| `GET /` | — | renders dashboard |
| `POST /api/generate` | `{product_name, description, platform, tone, temperature, top_p, n}` | `{compiled_prompt, variations[], platform_limit, platform, tone}` |
| `POST /api/compare-temps` *(bonus)* | same minus temperature | `{ results: [{temperature, variations[]}] }` for temps ~0.2/0.7/1.0 |

**Validation:** require product_name + description; clamp temperature 0–1 and top_p 0–1; clamp n to 1–4; friendly 400s; `LLMError` → 502 + toast; fail fast if key missing.

---

## 6. Frontend design (marketing dashboard)

- **Left input card:** Product Name; Product Description (textarea); Platform select (with small icons); Tone select/chips; **Temperature slider** (0–1, step 0.05, live numeric readout + hint "higher = more creative/varied"); **Top-P slider** (0–1, live readout + hint); Variations stepper (1–4); **Generate** (gradient). A reset/clear.
- **Right results:** one card per variation — the copy, a **live character meter** "{count}/{limit}" colored green/amber/red (R5), copy-to-clipboard, and a small **regenerate** for that card. Email variations render as **Subject** + **Body**. Platform + tone badges on top.
- **"Compiled Prompt" inspector:** a collapsible panel showing the exact dynamic template that was sent (monospace) — this *is* the visible proof of R2. Caption: "This is the dynamic template compiled from your variables and sent to the model."
- **"Compare temperatures" (R6):** button runs `/api/compare-temps` and shows 3 columns (Low 0.2 / Balanced 0.7 / High 1.0) of the same input, so the temperature effect is self-evident — directly demonstrating the PDF's suggested experiment.
- **Export:** "Copy all" and "Download .md" (formats variations with headings).
- States: loading skeletons on cards, success, clean error toast, empty state ("Describe your product and hit Generate").

---

## 7. Error handling & reliability

Missing key → fail fast. Invalid params → clamped + noted. Model returns non-JSON → tolerant parser fallback (never crash; show what came back). `LLMError` → 502 toast, inputs preserved. Centralized timeout + one back-off retry in `llm_client`. `logging`, no secrets logged.

---

## 8. Deliverables checklist (acceptance gate)

- [ ] Inputs Product_Name + Description + Platform + Tone present (R1).
- [ ] Dynamic template compiled from variables and **shown** in the inspector (R2).
- [ ] Temperature + Top-P sliders actually change the SDK generation config (R3) — visibly affect output.
- [ ] Output is genuinely platform-tailored (structure/voice/hashtags differ) (R4).
- [ ] Length validation + live char meter; over-limit flagged for char-limited platforms (R5).
- [ ] Compare-temperatures view works (R6).
- [ ] Multiple variations + copy + download export (R7).
- [ ] README + REQUIREMENTS.md + SCREENSHOT_PLAN.md + .env.example + requirements.txt present.
- [ ] Local run from README; Render notes; shared design system; responsive.

---

## 9. SCREENSHOT_PLAN.md (contents to generate)

1. **Dashboard / empty state.** 2. **Filled inputs** (sliders set). 3. **Results** — variation cards with char meters. 4. **Compiled Prompt inspector** open (proves dynamic template). 5. **Compare temperatures** view. 6. **Over-limit** example (red meter) on Twitter/X. 7. Email result showing subject + body.

---

## 10. Future improvements (README section)

A/B headline scoring; brand-voice memory (save tone profiles); SEO keyword injection; multi-platform "generate for all" in one click; image-caption pairing (ties to Week 3); analytics on which tone/temperature performs; provider switch via `llm_client`.

---

## 11. MASTER PROMPT FOR SONNET 4.6 — Week 2

> Paste everything in the box into a fresh Sonnet 4.6 (high-effort) session. Self-contained.

```
ROLE
You are a senior Gen-AI application engineer building a portfolio-grade project for the DecodeLabs Generative AI internship (Batch 2026), Week 2. It must look like a real marketing SaaS dashboard, and a reviewer must verify every requirement at a glance.

NON-NEGOTIABLE PRINCIPLE — THE PDF IS THE CONTRACT
Satisfy 100% of the official requirements below, make each VISIBLE, and ship a REQUIREMENTS.md mapping each requirement to its feature/file. Only then add polish. Never trade compliance for complexity.

PROJECT: Automated Copywriting & Tone Transformer
GOAL: Take a raw product description and auto-generate professional marketing copy tailored to different platforms.
REQUIREMENTS (verbatim intent):
  R1. Inputs: Product_Name, Platform (LinkedIn, Instagram, Email), Tone (+ a Product Description field).
  R2. Inject those variables into a DYNAMIC STRING TEMPLATE passed to the model — and surface the compiled prompt in the UI.
  R3. Expose Temperature and Top-P controls that flow into the model's generation config.
  R4. Output must be genuinely platform-tailored.
  R5. (bonus) Strict length validation for character-limited platforms.
  R6. (bonus) A "compare temperatures" demo (same input at low/medium/high temp).
  R7. (bonus) Multiple variations + export.

LOCKED TECH DECISIONS
- Backend Flask (Python); frontend server-rendered template + vanilla HTML/CSS/JS (NO React, NO Bootstrap default look).
- LLM: Google Gemini via OFFICIAL google-genai SDK, GEMINI_API_KEY from .env (python-dotenv). Use a current Gemini *Flash* model — VERIFY the exact model id against current Google docs.
- Reuse the provider abstraction llm_client.py with generate(prompt_or_messages, *, temperature, top_p, max_output_tokens) -> str raising typed LLMError; provider swappable via LLM_PROVIDER (default gemini). (Copy the same llm_client.py used in Week 1.)

ARCHITECTURE (implement exactly)
- prompt_compiler.py:
   PLATFORMS spec dict — LinkedIn (char_limit 3000; hook→value→CTA; 3–5 hashtags; professional), Instagram (2200; punchy caption + emoji + ~15 hashtags; vivid), Email (subject ≤60 + body; clear/persuasive), Twitter/X (280; one sharp line + ≤2 hashtags) [Twitter is bonus].
   TONES list (Professional, Friendly, Witty, Luxury, Bold, Inspirational, Minimalist), each a one-line style directive.
   compile(vars, spec, tone) -> str : assemble a dynamic template = system role (expert marketing copywriter) + injected {product_name}/{description} + platform block ({structure},{char_limit},hashtag rules) + tone directive + output-format instruction (RETURN a JSON array of n variations; for Email each item = {subject, body}). Return the final string (the UI will display it verbatim for R2).
   parse_structured(raw) -> list : tolerant — strip code fences, json.loads; on failure fall back to whole-text-as-one-variation (never crash).
   validate_length(text, char_limit) -> {char_count, within_limit, over_by}.
- app.py routes:
   GET  /                 -> dashboard
   POST /api/generate      {product_name,description,platform,tone,temperature,top_p,n} -> {compiled_prompt, variations:[{text,char_count,within_limit}], platform_limit, platform, tone}
   POST /api/compare-temps (same minus temperature) -> {results:[{temperature,variations}]} for temps 0.2/0.7/1.0
   Validation: require product_name+description; clamp temperature & top_p to 0–1; clamp n to 1–4; friendly 400s; LLMError -> 502 {error}; fail fast if key missing.

FRONTEND (shared design system — dark, modern, responsive; reuse the SAME static/css/theme.css from Week 1)
Design tokens: --bg #0B0F17, --surface #141A24, --surface-2 #1C2430, --border rgba(255,255,255,.08), --text #E8EDF4, --text-dim #9AA7B8, --brand #6366F1, --brand-2 #A855F7, --accent #22D3EE; radius 14px; Inter UI / JetBrains Mono code. Gradient wordmark "DecodeLabs · GenAI Suite"; right label "Week 2 · Copywriting Studio"; footer "Built by Nikhil · DecodeLabs GenAI Internship 2026 · powered by Gemini".
Layout (desktop two-column, stacked mobile to ~360px):
  LEFT input card: Product Name; Product Description textarea; Platform select (icons); Tone select/chips; Temperature slider 0–1 step .05 (live value + hint "higher = more creative"); Top-P slider 0–1 (live value + hint); Variations stepper 1–4; Generate (gradient) + Clear.
  RIGHT results: a card per variation = copy text + live char meter "{count}/{limit}" (green/amber/red) + copy-to-clipboard + per-card regenerate; Email variations render Subject + Body; platform+tone badges. A collapsible "Compiled Prompt" inspector (monospace) showing the exact dynamic template sent (caption: "Dynamic template compiled from your variables"). A "Compare temperatures" button -> 3 columns (Low .2 / Balanced .7 / High 1.0). Export: "Copy all" + "Download .md".
  Loading skeletons, success, clean error toast, empty state.

DELIVERABLES (create all)
app.py, llm_client.py, prompt_compiler.py, requirements.txt (flask, google-genai, python-dotenv, gunicorn — pinned), .env.example (LLM_PROVIDER=gemini, GEMINI_API_KEY=your_key_here), .gitignore, templates/index.html, static/css/theme.css, static/js/app.js, README.md, REQUIREMENTS.md, SCREENSHOT_PLAN.md.
README order: title + pitch, screenshots, Overview, Problem Statement, Solution Architecture (ASCII diagram), Features (R1–R7 checklist), Tech Stack, Folder Structure, Setup, Configuration, Usage, Deployment (Render: gunicorn app:app + env vars), Requirement Compliance (link REQUIREMENTS.md), Future Improvements, Author (Nikhil).
REQUIREMENTS.md: table mapping R1–R7 to feature/file, all checked.
SCREENSHOT_PLAN.md: empty state, filled inputs, results with char meters, compiled-prompt inspector, compare-temps, over-limit example, Email subject+body.

CODING STANDARDS
Modular files, docstrings, type hints on public funcs, centralized typed errors with friendly messages, python logging (no secrets), input validation per route, pinned requirements. R2 (dynamic template) and R3 (temp/top-p) must be REAL and visibly affect output — no faking.

ACCEPTANCE — self-verify and report:
  [ ] Inputs present (R1); dynamic template compiled AND shown in inspector (R2).
  [ ] Temperature + Top-P sliders demonstrably change output (R3).
  [ ] Output platform-tailored (R4); length validation + char meter (R5).
  [ ] Compare-temperatures works (R6); multiple variations + export (R7).
  [ ] All files present; runs from README alone; responsive; matches design tokens.
Output a build summary + filled checklist. Ask before adding any dependency/pattern not listed.
```

---
*End of Week 2. Next: `WEEK-3-IMAGE-GENERATION-STUDIO.md`.*
